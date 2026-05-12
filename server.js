const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'schedule.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Load schedule state
app.get('/api/load', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      res.json({ ok: true, state: JSON.parse(data) });
    } else {
      res.json({ ok: true, state: null }); // no saved state yet
    }
  } catch (err) {
    console.error('Load error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Save schedule state
app.post('/api/save', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid state' });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Panel Scheduler running at http://localhost:${PORT}`);
});
