const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const cors = require('cors');
app.use(cors({
  origin: 'http://127.0.0.1:5500'
}));

const FILE_PATH = path.join(__dirname, 'bookings.json');
const SLOTS = Array.from({ length: 10 }, (_, i) => `${9 + i}:00 - ${10 + i}:00`);
const MAX_BOOKINGS_PER_SLOT = 5;

// Read bookings from file
function readBookings() {
  if (!fs.existsSync(FILE_PATH)) return {};
  const data = fs.readFileSync(FILE_PATH);
  return JSON.parse(data);
}

// Write bookings to file
function writeBookings(data) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

// Get all slots with their availability
app.get('/api/available-slots', (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: 'Date query is required.' });
  }

  const bookings = readBookings();
  const slotsForDate = bookings[date] || {};

  const availableSlots = SLOTS
    .filter(slot => (slotsForDate[slot]?.length || 0) < MAX_BOOKINGS_PER_SLOT)
    .map(slot => ({
      slot,
      remaining: MAX_BOOKINGS_PER_SLOT - (slotsForDate[slot]?.length || 0)
    }));

  res.json(availableSlots);
});

// Book a slot
app.post('/api/book', (req, res) => {
  const { name, slot, date } = req.body;
  if (!name || !slot || !date || !SLOTS.includes(slot)) {
    return res.status(400).json({ message: 'Invalid name, date, or slot.' });
  }

  const bookings = readBookings();
  bookings[date] = bookings[date] || {};
  bookings[date][slot] = bookings[date][slot] || [];

  if (bookings[date][slot].length >= MAX_BOOKINGS_PER_SLOT) {
    return res.status(400).json({ message: 'Slot is full on this date.' });
  }

  bookings[date][slot].push(name);
  writeBookings(bookings);

  res.json({ message: 'Booking successful.' });
});

//Show all bookings on a particular date

app.get('/api/bookings', (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: 'Date query parameter is required.' });
  }

  const bookings = readBookings();
  const bookingsForDate = bookings[date] || {};
  res.json(bookingsForDate);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


