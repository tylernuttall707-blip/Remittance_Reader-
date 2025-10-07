// --- PDF.js Configuration ---
// Configure PDF.js worker (must be done before importing)
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
}

// --- Helpers ---
const $ = (q) => document.querySelector(q);
const rowsEl = $('#rows');

const fmtMoney = (n, cur = ($('#currency').value || 'USD')) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(Number(n || 0));
  } catch (e) {
    return `$${Number(n || 0).toFixed(2)}`;
  }
};

const parseMoney = (s) => Number(String(s || '').replace(/[^0-9.-]/g, '') || 0);

const toast = (msg) => {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
};

// State
let state = { payer: '', date: '', amountReceived: 0, invoices: [] };

function render() {
  $('#payer').value = state.payer || '';
  if (state.date) $('#paydate').value = state.date;
  $('#amountReceived').value = state.amountReceived ? fmtMoney(state.amountReceived) : '';
  $('#displayAmount').textContent = state.amountReceived ? fmtMoney(state.amountReceived) : '$0.00';
  $('#currencyDisplay').textContent = $('#currency').value || 'USD';

  rowsEl.innerHTML = '';
  let appliedSum = 0;
  state.invoices.forEach((row, idx) => {
    appliedSum += Number(row.applied || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" ${row.applied > 0 ? 'checked' : ''} data-idx="${idx}" class="chk"/></td>
      <td>
        <div class="invoice-cell">${row.invoice || ''}</div>
      </td>
      <td><div class="invoice-date">${row.date || ''}</div></td>
      <td>${fmtMoney(row.open || 0)}</td>
      <td>${fmtMoney(row.open || 0)}</td>
      <td>
        <input data-idx="${idx}" class="amt amount-input" value="${row.applied ? fmtMoney(row.applied) : ''}"/>
      </td>`;
    rowsEl.appendChild(tr);
  });

  $('#appliedTotal').textContent = fmtMoney(appliedSum);
  const credit = Math.max(0, (state.amountReceived || 0) - appliedSum);
  $('#applyTotal').textContent = fmtMoney(appliedSum);
  $('#creditTotal').textContent = fmtMoney(credit);
}

function upsertInvoice(partial) {
  const id = partial.invoice?.trim();
  if (!id) return;
  const found = state.invoices.find(r => String(r.invoice).trim() === id);
  if (found) {
    Object.assign(found, partial);
  } else {
    state.invoices.push({
      invoice: id,
      open: partial.open || partial.applied || 0,
      applied: partial.applied || 0,
      date: partial.date || ''
    });
  }
}

// --- UI Events ---
$('#btnClear').onclick = () => {
  state = { payer: '', date: '', amountReceived: 0, invoices: [] };
  render();
  toast('Cleared');
};

$('#btnPrint').onclick = () => window.print();
$('#btnSave').onclick = () => toast('Payment recorded successfully!');
$('#currency').onchange = () => render();

// Edit events
rowsEl.addEventListener('input', (e) => {
  if (e.target.classList.contains('amt')) {
    const idx = Number(e.target.dataset.idx);
    state.invoices[idx].applied = parseMoney(e.target.value);
    render();
  }
});

rowsEl.addEventListener('change', (e) => {
  if (e.target.classList.contains('chk')) {
    const idx = Number(e.target.dataset.idx);
    const r = state.invoices[idx];
    r.applied = e.target.checked ? (r.open || 0) : 0;
    render();
  }
});

// Export
function exportData(type = 'csv') {
  const rows = state.invoices.map(r => ({
    Payer: state.payer,
    PaymentDate: state.date,
    Invoice: r.invoice,
    AmountApplied: r.applied,
    OpenBalance: r.open,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Remittance');
  if (type === 'csv') XLSX.writeFile(wb, 'remittance.csv', { bookType: 'csv' });
  else XLSX.writeFile(wb, 'remittance.xlsx', { bookType: 'xlsx' });
  toast(`Exported as ${type.toUpperCase()}`);
}

$('#btnExportCSV').onclick = () => exportData('csv');
$('#btnExportXLSX').onclick = () => exportData('xlsx');

// Header inputs
$('#payer').oninput = e => { state.payer = e.target.value; render(); };
$('#paydate').oninput = e => { state.date = e.target.value; render(); };
$('#amountReceived').oninput = e => {
  state.amountReceived = parseMoney(e.target.value);
  render();
};

// --- File Handling ---
const pick = $('#pick'), drop = $('#drop'), file = $('#file');
pick.onclick = () => file.click();

['dragenter', 'dragover'].forEach(ev =>
  drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.style.borderColor = '#0077c5';
    drop.style.background = '#e6f3fb';
  })
);

['dragleave', 'drop'].forEach(ev =>
  drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.style.borderColor = '#c1c4c8';
    drop.style.background = '#f7f8fa';
  })
);

drop.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files?.[0];
  if (f) handleFile(f);
});

file.onchange = (e) => {
  const f = e.target.files?.[0];
  if (f) handleFile(f);
};

function extOf(name) {
  return (name || '').split('.').pop().toLowerCase();
}

async function handleFile(f) {
  $('#status').textContent = `Reading "${f.name}"…`;
  const forced = $('#mode').value;
  const ext = extOf(f.name);
  const kind = forced === 'auto' ?
    (ext === 'pdf' ? 'pdf' :
      (['xlsx', 'xls'].includes(ext) ? 'xlsx' :
        (ext === 'csv' ? 'csv' : 'unknown')))
    : forced;

  try {
    if (kind === 'xlsx' || kind === 'csv') await parseSheet(f);
    else if (kind === 'pdf') await parsePDF(f);
    else if (f.type.startsWith('image/')) {
      toast('Image OCR not included. Convert to PDF first.');
    } else {
      toast('Unsupported file type. Use PDF/XLSX/CSV.');
    }
    render();
    $('#status').textContent = `Parsed ${state.invoices.length} invoice line(s). Review and adjust.`;
    toast('File loaded successfully!');
  } catch (err) {
    console.error(err);
    toast('Parse error. See console for details.');
    $('#status').textContent = 'Parse failed.';
  }
}

// --- Spreadsheet Parsing ---
async function parseSheet(file) {
  // Ensure XLSX library is loaded
  if (typeof XLSX === 'undefined') {
    throw new Error('XLSX library not loaded. Please refresh the page.');
  }
  
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });

  const mapHeader = (keys, ...alts) => {
    const joined = keys.map(k => k.toString().toLowerCase());
    const find = (name) => joined.findIndex(k => alts.some(a => new RegExp(a, 'i').test(k)));
    return {
      invoiceIdx: find('^inv(oi|)ce|^inv\\b|document|doc #|ref(erence)?'),
      amountIdx: find('amount|paid|payment|apply|applied|credited|remittance|total'),
      openIdx: find('open|balance|bal'),
      dateIdx: find('date|payment date|remittance date|deposit'),
      payerIdx: find('payer|from|customer|client|company|remitter|supplier'),
    };
  };

  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const idxs = mapHeader(headers);

  state.payer = state.payer || (idxs.payerIdx > -1 ? rows[0][headers[idxs.payerIdx]] : state.payer);
  state.date = state.date || normalizeDate(rows[0][headers[idxs.dateIdx]]);

  rows.forEach(r => {
    const inv = idxs.invoiceIdx > -1 ? r[headers[idxs.invoiceIdx]] : (r.Invoice || r.INVOICE || r.Inv || r['Invoice #'] || r['Doc #']);
    const amt = idxs.amountIdx > -1 ? r[headers[idxs.amountIdx]] : (r.Amount || r.Paid || r['Amount Paid']);
    const open = idxs.openIdx > -1 ? r[headers[idxs.openIdx]] : (r.Open || r['Open Balance'] || 0);
    const d = idxs.dateIdx > -1 ? r[headers[idxs.dateIdx]] : (r.Date || '');

    if (inv && (amt || open)) {
      upsertInvoice({
        invoice: String(inv).trim(),
        applied: parseMoney(amt),
        open: parseMoney(open) || parseMoney(amt),
        date: normalizeDate(d)
      });
    }
  });

  if (!state.amountReceived) {
    state.amountReceived = state.invoices.reduce((a, b) => a + Number(b.applied || 0), 0);
  }
}

function normalizeDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();

  const mdy = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (mdy) {
    const [_, m, d, y] = mdy;
    const yyyy = y.length === 2 ? ('20' + y) : y;
    return `${yyyy.padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const ymd = s.match(/(\d{4})[\-\/.](\d{1,2})[\-\/.](\d{1,2})/);
  if (ymd) {
    const [_, y, m, d] = ymd;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return '';
}

// --- PDF Parsing ---
async function parsePDF(file) {
  const mod = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
  
  // Configure worker
  mod.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
  
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await mod.getDocument({ data }).promise;
  let fullText = '';

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map(i => i.str).join('\n');
    fullText += '\n' + text;
  }

  // Extract payer
  const payerMatch = fullText.match(/(?:From|Payer|Remitter|Customer)[:\-\s]*([A-Za-z0-9 &.,'\-]+)/i);
  if (payerMatch) state.payer = state.payer || payerMatch[1].trim();

  // Extract date
  const dateMatch = fullText.match(/(?:Date|Payment Date|Remittance Date)[:\s]*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})/i);
  if (dateMatch) state.date = state.date || normalizeDate(dateMatch[1]);

  // Extract invoice lines
  const lines = fullText.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const invRegex = /(invoice|inv|bill)[#:\s-]*([A-Za-z0-9_-]{2,})/i;
  const amtRegex = /(\$?[-+]?\d{1,3}(?:,\d{3})*(?:\.\d{2}))/;

  lines.forEach((ln, i) => {
    const invM = ln.match(invRegex);
    if (invM) {
      let amtStr = (ln.match(amtRegex) || [])[1] || '';
      if (!amtStr && lines[i + 1]) amtStr = (lines[i + 1].match(amtRegex) || [])[1] || '';
      const dStr = (ln.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/) || [])[0] || '';
      upsertInvoice({
        invoice: invM[2],
        applied: parseMoney(amtStr),
        open: parseMoney(amtStr),
        date: normalizeDate(dStr)
      });
    }
  });

  if (!state.amountReceived) {
    const totalMatch = fullText.match(/(?:Total\s+(?:Paid|Payment|Amount))[:\s]*\$?([\d,]+\.\d{2})/i);
    if (totalMatch) state.amountReceived = parseMoney(totalMatch[1]);
    else state.amountReceived = state.invoices.reduce((a, b) => a + (b.applied || 0), 0);
  }
}

// --- Sample Data ---
$('#btnSample').onclick = () => {
  state = {
    payer: 'Expedition Trailers',
    date: new Date().toISOString().slice(0, 10),
    amountReceived: 4990.08,
    invoices: [
      {
        invoice: '2085-33',
        open: 4990.08,
        applied: 4990.08,
        date: new Date().toISOString().slice(0, 10)
      },
      {
        invoice: '2085-34',
        open: 10910.50,
        applied: 0,
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      },
    ]
  };
  render();
  toast('Sample data loaded');
};

// Initialize
// Wait for XLSX library to load before enabling file upload
window.addEventListener('load', () => {
  let checkCount = 0;
  const checkXLSX = setInterval(() => {
    if (typeof XLSX !== 'undefined' || checkCount > 50) {
      clearInterval(checkXLSX);
      if (typeof XLSX === 'undefined') {
        toast('Warning: Excel/CSV parsing may not work. Try refreshing the page.');
      }
      render();
    }
    checkCount++;
  }, 100);
});
