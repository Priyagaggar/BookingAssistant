const express = require('express');
const Appointment = require('../models/Appointment');

const router = express.Router();

// GET /api/appointments — list everything, soonest first. No auth: this
// project is explicitly skipping login for the admin view.
router.get('/', async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ date: 1, time: 1 });
    res.json(appointments);
  } catch (err) {
    console.error('GET /api/appointments error:', err);
    res.status(500).json({ error: 'Failed to load appointments.' });
  }
});

// PATCH /api/appointments/:id — update status (used by the admin Cancel button).
router.patch('/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!['booked', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: "status must be 'booked' or 'cancelled'." });
  }

  try {
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    res.json(appointment);
  } catch (err) {
    console.error('PATCH /api/appointments/:id error:', err);
    res.status(500).json({ error: 'Failed to update appointment.' });
  }
});

module.exports = router;
