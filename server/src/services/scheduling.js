const Appointment = require('../models/Appointment');

// The whole app assumes every date/time it handles is Indian Standard Time
// (UTC+5:30), regardless of what timezone the server process itself runs
// in. We never rely on the server's local timezone — every Date we build
// pins the offset explicitly.
const IST_OFFSET = '+05:30';

// Business hours used to judge "is this day fully booked" — hourly slots,
// 9am to 5pm start times (last appointment starts at 17:00). This isn't
// specified anywhere in the schema, so it's a hardcoded assumption; change
// this array if the real business hours differ.
const BUSINESS_HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

// An absolute instant for a given IST wall-clock date+time, e.g.
// istDateTime('2026-08-15', '15:00') -> the Date representing 3pm IST on
// that day, correctly comparable to `new Date()` no matter the server tz.
function istDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00${IST_OFFSET}`);
}

// Midnight IST of a given calendar day — used as the value stored in
// Appointment.date, so every appointment on "2026-08-15" (IST) is stored
// and queried with the exact same Date value.
function istDayStart(dateStr) {
  return new Date(`${dateStr}T00:00${IST_OFFSET}`);
}

// Converts a stored Date (always midnight IST, e.g. 2026-08-16T00:00 IST is
// persisted as the UTC instant 2026-08-15T18:30Z) back to its IST calendar
// date string. Do NOT use `date.toISOString().slice(0, 10)` for this — that
// reads the UTC calendar date, which is one day behind for anything stored
// this way.
function dateOnlyIST(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA -> YYYY-MM-DD
}

function formatDateOnly(dateStr) {
  return istDayStart(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function formatTimeOnly(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatIST(dateStr, timeStr) {
  return `${formatDateOnly(dateStr)} at ${formatTimeOnly(timeStr)}`;
}

function isPast(dateStr, timeStr, now) {
  const dt = istDateTime(dateStr, timeStr);
  return Number.isNaN(dt.getTime()) ? null : dt < now;
}

/**
 * Checks whether `timeStr` on `dateStr` is bookable.
 * Returns null if it's free. Returns a conversational message if not —
 * either naming the one conflicting slot (and suggesting open alternatives
 * that day), or, if every business-hours slot that day is taken, saying the
 * whole day is full.
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:mm
 * @param {string} [excludeId] - an appointment id to ignore (used by reschedule, so a booking doesn't conflict with itself)
 */
async function describeConflict(dateStr, timeStr, excludeId) {
  const query = { date: istDayStart(dateStr), status: 'booked' };
  if (excludeId) query._id = { $ne: excludeId };

  const bookedForDay = await Appointment.find(query).select('time');
  const bookedTimes = new Set(bookedForDay.map((a) => a.time));

  if (!bookedTimes.has(timeStr)) return null;

  const availableTimes = BUSINESS_HOURS.filter((t) => !bookedTimes.has(t));
  if (availableTimes.length === 0) {
    return `${formatDateOnly(dateStr)} is fully booked — could you try a different date?`;
  }

  const niceList = availableTimes.map(formatTimeOnly).join(', ');
  return `${formatIST(dateStr, timeStr)} is already booked. Open times that day: ${niceList}.`;
}

module.exports = {
  IST_OFFSET,
  BUSINESS_HOURS,
  istDateTime,
  istDayStart,
  dateOnlyIST,
  formatDateOnly,
  formatTimeOnly,
  formatIST,
  isPast,
  describeConflict,
};
