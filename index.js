require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));
app.use(cors({
  origin: ['http://127.0.0.1:5500/NEXTRA%20DIGITAL', 'https://nextra-frontend-testing.vercel.app', 'https://dashboard-mu-ruddy.vercel.app'],
}));

const SLOTS = Array.from({ length: 10 }, (_, i) => `${9 + i}:00 - ${10 + i}:00`);
const MAX_BOOKINGS_PER_SLOT = 5;

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://sourox1919:p5OBnfrCN4CfrTzv@cluster0.yrklaal.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Booking schema
const bookingSchema = new mongoose.Schema({
  name: String,
  email: String,
  service: String,
  date: String,
  slot: String,
  message: String
});

const Booking = mongoose.model('Booking', bookingSchema);

// Example middleware to protect route
function authenticateAdmin(req, res, next) {
  console.log("Authentication Middleware Triggered");
  
  const authHeader = req.headers.authorization;


  console.log("Authorization Header:", authHeader);

  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(403).json({ message: "Forbidden: Invalid or missing token" });
  }

  next();
}


// Get available slots for a date
app.get('/api/available-slots', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: 'Date query is required.' });
  }

  try {
    const bookings = await Booking.find({ date });

    const slotCount = {};
    bookings.forEach(b => {
      slotCount[b.slot] = (slotCount[b.slot] || 0) + 1;
    });

    const availableSlots = SLOTS
      .filter(slot => (slotCount[slot] || 0) < MAX_BOOKINGS_PER_SLOT)
      .map(slot => ({
        slot,
        remaining: MAX_BOOKINGS_PER_SLOT - (slotCount[slot] || 0)
      }));

    res.json(availableSlots);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching available slots.' });
  }
});

// Book a slot
app.post('/api/book', async (req, res) => {
  const { name, email, service, date, slot, message } = req.body;

  if (!name || !slot || !date || !SLOTS.includes(slot)) {
    return res.status(400).json({ message: 'Invalid name, date, or slot.' });
  }

  try {
    const existingBookings = await Booking.countDocuments({ date, slot });
    if (existingBookings >= MAX_BOOKINGS_PER_SLOT) {
      return res.status(400).json({ message: 'Slot is full on this date.' });
    }

    const booking = new Booking({ name, email, service, date, slot, message });
    await booking.save();

    res.json({ message: 'Booking successful.' });
  } catch (err) {
    res.status(500).json({ message: 'Error saving booking.' });
  }
});

// Get all bookings for a date (no authentication)
app.get('/api/bookings', authenticateAdmin, async (req, res) => {
  const { date } = req.query;
  console.log("Date Query Parameter:", date);
  if (!date) {
    return res.status(400).json({ message: 'Date query parameter is required.' });
  }

  try {
    const bookings = await Booking.find({ date });
    const grouped = {};

    bookings.forEach(b => {
      if (!grouped[b.slot]) grouped[b.slot] = [];
      grouped[b.slot].push(b);
    });

    res.json(grouped);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving bookings.' });
  }
});

// Feedback schema
const feedbackSchema = new mongoose.Schema({
  rating: { type: Number, required: true },
  feedback: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

// Submit feedback
app.post('/api/feedback', async (req, res) => {
  const { rating, feedback } = req.body;

  if (!rating || rating < 1 || rating > 5 || !feedback || feedback.trim().length < 5) {
    return res.status(400).json({ message: 'Invalid rating or feedback too short.' });
  }

  try {
    const fb = new Feedback({ rating, feedback });
    await fb.save();
    res.json({ message: 'Feedback received. Thank you!' });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ message: 'Error saving feedback.' });
  }
});

// Get all feedbacks with pagination and filters
app.get('/api/feedbacks', authenticateAdmin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const minRating = parseInt(req.query.minRating);
  const maxRating = parseInt(req.query.maxRating);
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  const search = req.query.search || '';

  const filter = {};

  if (!isNaN(minRating)) {
    filter.rating = { ...filter.rating, $gte: minRating };
  }
  if (!isNaN(maxRating)) {
    filter.rating = { ...filter.rating, $lte: maxRating };
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  if (search.trim() !== '') {
    filter.feedback = { $regex: search.trim(), $options: 'i' }; // case-insensitive search
  }

  try {
    const total = await Feedback.countDocuments(filter);
    const feedbacks = await Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      feedbacks
    });
  } catch (err) {
    console.error("Error fetching feedbacks:", err);
    res.status(500).json({ message: 'Error retrieving feedbacks.' });
  }
});




app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
