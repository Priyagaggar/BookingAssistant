require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const chatRouter = require('./routes/chat');
const appointmentsRouter = require('./routes/appointments');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Test route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello world from BookingAssistant server!' });
});

app.use('/api/chat', chatRouter);
app.use('/api/appointments', appointmentsRouter);

app.get('/', (req, res) => {
  res.send('BookingAssistant API is running.');
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
