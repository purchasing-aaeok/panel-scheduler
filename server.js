const express = require('express');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'schedule.json');
const EXCEL_FILE = path.join(__dirname, 'estimator.xlsx');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Parse xlsx using only built-in Node.js (no dependencies)
// xlsx is a ZIP file — we extract the sheet XML and parse it manually
function parseExcel() {
  if (!fs.existsSync(EXCEL_FILE)) {
    console.warn('estimator.xlsx not found');
    return [];
  }
  try {
    // Use the yauzl-style approach: read ZIP entries manually
    // xlsx ZIP format: xl/worksheets/sheet1.xml + xl/sharedStrings.xml
    const data = fs.readFileSync(EXCEL_FILE);
    
    // Find ZIP local file headers (signature: 0x04034b50)
    const entries = {};
    let i = 0;
    while (i < data.length - 4) {
      if (data[i]===0x50 && data[i+1]===0x4B && data[i+2]===0x03 && data[i+3]===0x04) {
        const compression = data.readUInt16LE(i+8);
        const compSize    = data.readUInt32LE(i+18);
        const uncompSize  = data.readUInt32LE(i+22);
        const nameLen     = data.readUInt16LE(i+26);
        const extraLen    = data.readUInt16LE(i+28);
        const name        = data.slice(i+30, i+30+nameLen).toString('utf8');
        const dataStart   = i+30+nameLen+extraLen;
        const compressed  = data.slice(dataStart, dataStart+compSize);
        
        if (name === 'xl/sharedStrings.xml' || name === 'xl/worksheets/sheet1.xml') {
          try {
            entries[name] = compression === 8
              ? zlib.inflateRawSync(compressed).toString('utf8')
              : compressed.toString('utf8');
          } catch(e) {}
        }
        i = dataStart + compSize;
      } else {
        i++;
      }
    }

    // Parse shared strings
    const strings = [];
    const ssXml = entries['xl/sharedStrings.xml'] || '';
    const siMatches = ssXml.match(/<si>[\s\S]*?<\/si>/g) || [];
    siMatches.forEach(si => {
      const texts = si.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
      strings.push(texts.map(t => t.replace(/<[^>]+>/g,'').trim()).join('').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&quot;/g,'"'));
    });

    // Parse sheet cells
    const sheetXml = entries['xl/worksheets/sheet1.xml'] || '';
    
    // Get all rows
    const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
    const rows = rowMatches.map(rowXml => {
      const cells = {};
      const cellMatches = rowXml.match(/<c [^>]*>[\s\S]*?<\/c>/g) || [];
      cellMatches.forEach(cell => {
        const refMatch  = cell.match(/r="([A-Z]+\d+)"/);
        const typeMatch = cell.match(/t="([^"]+)"/);
        const valMatch  = cell.match(/<v>([^<]*)<\/v>/);
        if (!refMatch || !valMatch) return;
        const col = refMatch[1].replace(/\d+/g,'');
        const type = typeMatch ? typeMatch[1] : 'n';
        let val = valMatch[1];
        if (type === 's') val = strings[parseInt(val)] || '';
        cells[col] = val;
      });
      return cells;
    });

    if (rows.length < 2) return [];

    // First data row is headers
    const headerRow = rows[0];
    // Build column map: normalize header text -> column letter
    const colMap = {};
    Object.entries(headerRow).forEach(([col, val]) => {
      const key = String(val).toLowerCase().replace(/:/g,'').trim();
      colMap[key] = col;
    });

    const getCol = (...names) => {
      for (const n of names) {
        if (colMap[n]) return colMap[n];
      }
      return null;
    };

    const custCol  = getCol('customer','cust');
    const jobCol   = getCol('job #','job#','job','job number');
    const nameCol  = getCol('panel name','panel','name','description');
    const qtyCol   = getCol('qty','quantity','count');
    const hrsCol   = getCol('build hours','build hrs','build','hours');

    const panels = [];
    let idCounter = 1;

    rows.slice(1).forEach(row => {
      const customer = custCol ? String(row[custCol]||'').trim() : '';
      const job      = jobCol  ? String(row[jobCol]||'').trim()  : '';
      const name     = nameCol ? String(row[nameCol]||'').trim() : '';
      const qty      = parseInt(qtyCol ? row[qtyCol]||1 : 1) || 1;
      const buildHrs = parseFloat(hrsCol ? row[hrsCol]||0 : 0) || 0;

      if (!name || buildHrs === 0) return;

      for (let i = 0; i < qty; i++) {
        panels.push({
          id: idCounter++,
          job, customer,
          name: qty > 1 ? `${name} #${i+1}` : name,
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
      res.json({ ok: true, state: JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) });
    } else {
      res.json({ ok: true, state: null });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/save', (req, res) => {
  try {
    const { pool: _pool, ...state } = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Panel Scheduler running at http://localhost:${PORT}`);
});
