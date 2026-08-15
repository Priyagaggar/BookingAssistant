const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  service: {
    type: String,
    required: true,
    trim: true,
  },
  // Calendar date of the appointment (time-of-day lives in `time` below).
  date: {
    type: Date,
    required: true,
  },
  // Free-form time string, e.g. "14:30". Kept separate from `date` to avoid
  // timezone ambiguity from combining both into a single Date value.
  time: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['booked', 'cancelled'],
    default: 'booked',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
