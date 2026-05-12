const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'schedule.json');
const EXCEL_FILE = path.join(__dirname, 'estimator.xlsx');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function parseExcel() {
  if (!fs.existsSync(EXCEL_FILE)) {
    console.warn('estimator.xlsx not found — using empty panel list');
    return [];
  }
  try {
    const wb = XLSX.readFile(EXCEL_FILE);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const panels = [];
    let idCounter = 1;

    rows.forEach(row => {
      // Normalize keys: lowercase and strip colons, spaces
      const keys = {};
      Object.keys(row).forEach(k => {
        const normalized = k.toLowerCase().replace(/:/g, '').trim();
        keys[normalized] = row[k];
      });

      const customer = String(keys['customer'] || keys['cust'] || '').trim();
      const job      = String(keys['job #'] || keys['job#'] || keys['job'] || keys['job number'] || '').trim();
      const name     = String(keys['panel name'] || keys['panel'] || keys['name'] || keys['description'] || '').trim();
      const qty      = parseInt(keys['qty'] || keys['quantity'] || keys['count'] || '1') || 1;
      const buildHrs = parseFloat(keys['build hours'] || keys['build hrs'] || keys['build'] || keys['hours'] || '0') || 0;

      if (!name || buildHrs === 0) return;

      for (let i = 0; i < qty; i++) {
        panels.push({
          id: idCounter++,
          job,
          customer,
          name: qty > 1 ? `${name} #${i + 1}` : name,
          baseName: name,
          buildHrs,
        });
      }
    });

    console.log(`Parsed ${panels.length} panels from estimator.xlsx`);
    return panels;
  } catch (err) {
    console.error('Excel parse error:', err.message);
    return [];
  }
}

app.get('/api/panels', (req, res) => {
  res.json({ ok: true, panels: parseExcel() });
});

app.get('/api/load', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      res.json({ ok: true, state: JSON.parse(data) });
    } else {
      res.json({ ok: true, state: null });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/save', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid state' });
    }
    const { pool: _pool, ...stateWithoutPool } = state;
    fs.writeFileSync(DATA_FILE, JSON.stringify(stateWithoutPool, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Panel Scheduler running at http://localhost:${PORT}`);
});
