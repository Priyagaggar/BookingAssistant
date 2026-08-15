const express = require('express');
const { handleChatMessage } = require('../services/bookingChat');

const router = express.Router();

router.post('/', async (req, res) => {
  const { message, history } = req.body || {};

  try {
    const result = await handleChatMessage({ message, history: Array.isArray(history) ? history : [] });
    res.json(result);
  } catch (err) {
    console.error('POST /api/chat error:', err);
    res.status(500).json({
      reply: "Something went wrong on my end — could you try again in a moment?",
      status: null,
      appointment: null,
    });
  }
});

module.exports = router;
