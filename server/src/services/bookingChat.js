const Appointment = require('../models/Appointment');
const { extractBookingDetails } = require('./extractBookingDetails');
const { istDateTime, istDayStart, dateOnlyIST, formatIST, isPast, describeConflict } = require('./scheduling');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactCI(str) {
  return new RegExp(`^${escapeRegex(str.trim())}$`, 'i');
}

const NEUTRAL_REPLY = "I can help you book, cancel, or reschedule an appointment — which would you like to do?";

/**
 * Finds the single booked appointment matching whichever identifying
 * fields were extracted (name/date/time/service). Used by cancel and
 * reschedule, both of which need to locate an existing appointment before
 * acting on it.
 * @returns {Promise<{ appointment: object|null, ambiguous: boolean }>}
 */
async function findMatchingAppointment({ name, date, time, service }) {
  const query = { status: 'booked' };
  if (name) query.name = exactCI(name);
  if (date) query.date = istDayStart(date);
  if (time) query.time = time;
  if (service) query.service = exactCI(service);

  const matches = await Appointment.find(query);
  if (matches.length === 1) return { appointment: matches[0], ambiguous: false };
  return { appointment: null, ambiguous: matches.length > 1 };
}

async function handleBook({ service, date, time, name }, now) {
  const requestedDateTime = istDateTime(date, time);
  if (Number.isNaN(requestedDateTime.getTime())) {
    return {
      reply: "I couldn't quite make sense of that date and time — could you rephrase it?",
      status: null,
      appointment: null,
    };
  }
  if (isPast(date, time, now)) {
    return {
      reply: `${formatIST(date, time)} has already passed — could you pick a different date or time?`,
      status: null,
      appointment: null,
    };
  }

  const conflictMessage = await describeConflict(date, time);
  if (conflictMessage) {
    return { reply: conflictMessage, status: null, appointment: null };
  }

  const appointment = await Appointment.create({
    name,
    service,
    date: istDayStart(date),
    time,
    status: 'booked',
  });

  return {
    reply: `You're all set, ${name}! I've booked ${service} for ${formatIST(date, time)}.`,
    status: 'booked',
    appointment,
  };
}

async function handleCancel({ name, date, time, service }) {
  const { appointment, ambiguous } = await findMatchingAppointment({ name, date, time, service });

  if (ambiguous) {
    return {
      reply: "I found more than one matching appointment — could you give me the date and time of the one you'd like to cancel?",
      status: null,
      appointment: null,
    };
  }
  if (!appointment) {
    return {
      reply: `I couldn't find a booked appointment matching that${name ? ` for ${name}` : ''}. Could you double check the name, date, or time?`,
      status: null,
      appointment: null,
    };
  }

  appointment.status = 'cancelled';
  await appointment.save();

  return {
    reply: `Done — I've cancelled the ${appointment.service} appointment for ${appointment.name} on ${formatIST(
      dateOnlyIST(appointment.date),
      appointment.time
    )}.`,
    status: 'cancelled',
    appointment,
  };
}

async function handleReschedule({ name, date, time, service, newDate, newTime }, now) {
  const { appointment, ambiguous } = await findMatchingAppointment({ name, date, time, service });

  if (ambiguous) {
    return {
      reply: "I found more than one matching appointment — could you give me the current date and time of the one you'd like to move?",
      status: null,
      appointment: null,
    };
  }
  if (!appointment) {
    return {
      reply: `I couldn't find a booked appointment matching that${name ? ` for ${name}` : ''} to reschedule. Could you double check the name, date, or time?`,
      status: null,
      appointment: null,
    };
  }

  const newDateTime = istDateTime(newDate, newTime);
  if (Number.isNaN(newDateTime.getTime())) {
    return {
      reply: "I couldn't quite make sense of that new date and time — could you rephrase it?",
      status: null,
      appointment: null,
    };
  }
  if (isPast(newDate, newTime, now)) {
    return {
      reply: `${formatIST(newDate, newTime)} has already passed — could you pick a different date or time?`,
      status: null,
      appointment: null,
    };
  }

  const conflictMessage = await describeConflict(newDate, newTime, appointment._id);
  if (conflictMessage) {
    return { reply: conflictMessage, status: null, appointment: null };
  }

  appointment.date = istDayStart(newDate);
  appointment.time = newTime;
  await appointment.save();

  return {
    reply: `Done — I've moved your ${appointment.service} appointment to ${formatIST(newDate, newTime)}.`,
    status: 'rescheduled',
    appointment,
  };
}

/**
 * Handles one turn of the booking chat: extract intent -> validate -> persist.
 *
 * `extract` and `now` are injectable so this can be unit tested without a
 * real OpenAI call or a wall-clock dependency.
 *
 * @param {object} params
 * @param {string} params.message - latest user message
 * @param {Array<{role: 'user'|'assistant', content: string}>} [params.history] - prior turns
 * @param {Date} [params.now]
 * @param {(messages: any[], now: Date) => Promise<object>} [params.extract]
 * @returns {Promise<{reply: string, status: 'booked'|'cancelled'|'rescheduled'|null, appointment: object|null}>}
 */
async function handleChatMessage({ message, history = [], now = new Date(), extract = extractBookingDetails }) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { reply: "Could you tell me what you'd like to book?", status: null, appointment: null };
  }

  const messages = [...history, { role: 'user', content: message }];
  const extracted = await extract(messages, now);

  // Checked before the isComplete branch below: an "unclear" intent is
  // always isComplete=false per the prompt, so if this were under the
  // isComplete check it would never be reached — the generic fallback
  // question would fire instead of this more specific one.
  if (extracted.intent === 'unclear') {
    return { reply: extracted.clarifyingQuestion || NEUTRAL_REPLY, status: null, appointment: null };
  }

  if (!extracted.isComplete) {
    return {
      reply: extracted.clarifyingQuestion || 'Could you give me a bit more detail on that?',
      status: null,
      appointment: null,
    };
  }

  switch (extracted.intent) {
    case 'book':
      return handleBook(extracted, now);
    case 'cancel':
      return handleCancel(extracted);
    case 'reschedule':
      return handleReschedule(extracted, now);
    default:
      return { reply: NEUTRAL_REPLY, status: null, appointment: null };
  }
}

module.exports = { handleChatMessage };
