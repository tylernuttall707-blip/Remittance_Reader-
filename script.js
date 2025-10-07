const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let pdfjsPromise;
async function ensurePDF() {
  if (typeof pdfjsLib !== 'undefined') {
    if (pdfjsLib.GlobalWorkerOptions?.workerSrc !== PDF_WORKER_SRC) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    }
    return pdfjsLib;
  }

  if (!pdfjsPromise) {
    pdfjsPromise = import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs')
      .then(mod => {
        const lib = mod?.default || mod;
        const workerOptions = lib.GlobalWorkerOptions || mod.GlobalWorkerOptions;
        if (workerOptions) {
          workerOptions.workerSrc = PDF_WORKER_SRC;
          if (!lib.GlobalWorkerOptions) lib.GlobalWorkerOptions = workerOptions;
        }
        if (typeof window !== 'undefined' && !window.pdfjsLib) window.pdfjsLib = lib;
        return lib;
      });
  }

  const lib = await pdfjsPromise;
  if (lib.GlobalWorkerOptions?.workerSrc !== PDF_WORKER_SRC) {
    lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  }
  return lib;
}

let tesseractPromise;
async function ensureTesseract() {
  if (typeof Tesseract !== 'undefined') return Tesseract;
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TESSERACT_SRC;
      script.async = true;
      script.onload = () => {
        if (typeof Tesseract !== 'undefined') resolve(Tesseract);
        else reject(new Error('Tesseract failed to initialize.'));
      };
      script.onerror = () => reject(new Error('Failed to load OCR engine.'));
      document.head.appendChild(script);
    });
  }
  return tesseractPromise;
}

const $ = (q) => document.querySelector(q);
const rowsEl = $('#rows');
const statusEl = $('#status');

const fmtMoney = (n, cur = ($('#currency').value || 'USD')) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(Number(n || 0));
  } catch (e) {
    return `$${Number(n || 0).toFixed(2)}`;
  }
};

const parseMoney = (s) => Number(String(s || '').replace(/[^0-9.-]/g, '') || 0);

const escapeHTML = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toast = (msg) => {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
};

const statusDefault = 'Review before you save.';

const initialState = () => ({
  payer: '',
  vendor: '',
  date: '',
  amountReceived: 0,
  invoices: [],
  suggestions: []
});

let state = initialState();

function resetState() {
  state = initialState();
  render();
}

function render() {
  $('#payer').value = state.payer || '';
  if (state.date) $('#paydate').value = state.date;
  $('#amountReceived').value = state.amountReceived ? fmtMoney(state.amountReceived) : '';
  $('#displayAmount').textContent = state.amountReceived ? fmtMoney(state.amountReceived) : '$0.00';
  $('#currencyDisplay').textContent = $('#currency').value || 'USD';

  rowsEl.innerHTML = '';
  let appliedSum = 0;
  state.invoices.forEach((row, idx) => {
    const appliedVal = Number(row.applied || 0);
    appliedSum += appliedVal;
    const originalAmount = row.original ?? row.open ?? appliedVal;
    const openAmount = row.open ?? Math.max(0, originalAmount - appliedVal);
    const metaParts = [];
    if (row.description) metaParts.push(`<div class="invoice-desc">${escapeHTML(row.description)}</div>`);
    if (typeof row.discount === 'number' && row.discount) {
      metaParts.push(`<div class="invoice-discount">Discount: ${fmtMoney(row.discount)}</div>`);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" ${appliedVal > 0 ? 'checked' : ''} data-idx="${idx}" class="chk"/></td>
      <td>
        <div class="invoice-cell">
          <div class="invoice-number">${escapeHTML(row.invoice || '')}</div>
          ${metaParts.length ? `<div class="invoice-meta">${metaParts.join('')}</div>` : ''}
        </div>
      </td>
      <td>
        <div class="invoice-date">${escapeHTML(row.date || '')}</div>
      </td>
      <td>${fmtMoney(originalAmount)}</td>
      <td>${fmtMoney(openAmount)}</td>
      <td>
        <input data-idx="${idx}" class="amt amount-input" value="${appliedVal ? fmtMoney(appliedVal) : ''}"/>
      </td>`;
    rowsEl.appendChild(tr);
  });

  $('#appliedTotal').textContent = fmtMoney(appliedSum);
  const credit = Math.max(0, (state.amountReceived || 0) - appliedSum);
  $('#applyTotal').textContent = fmtMoney(appliedSum);
  $('#creditTotal').textContent = fmtMoney(credit);
}

function upsertInvoice(partial) {
  const id = partial.invoice?.toString().trim();
  if (!id) return;
  const normalized = {
    invoice: id,
    applied: Number.isFinite(partial.applied) ? partial.applied : parseMoney(partial.applied),
    open: Number.isFinite(partial.open) ? partial.open : parseMoney(partial.open),
    original: Number.isFinite(partial.original) ? partial.original : undefined,
    date: partial.date ? normalizeDate(partial.date) : ''
  };
  if ('discount' in partial) normalized.discount = Number.isFinite(partial.discount) ? partial.discount : parseMoney(partial.discount);
  if (partial.description) normalized.description = partial.description;

  if (!normalized.original && (normalized.open || normalized.applied)) {
    normalized.original = Math.max(normalized.open || 0, normalized.applied || 0);
  }
  if (!normalized.open && normalized.applied) normalized.open = normalized.applied;

  const existing = state.invoices.find(r => r.invoice === id);
  if (existing) {
    Object.assign(existing, normalized);
  } else {
    state.invoices.push({
      invoice: id,
      open: normalized.open ?? normalized.applied ?? 0,
      applied: normalized.applied ?? 0,
      original: normalized.original ?? normalized.open ?? normalized.applied ?? 0,
      discount: normalized.discount,
      description: normalized.description,
      date: normalized.date
    });
  }
}

function applyDocumentInsights(result) {
  if (!result) return;
  state.payer = result.customer || result.payer || state.payer;
  state.vendor = result.vendor || state.vendor;
  state.date = result.paymentDate || state.date || '';
  if (Number.isFinite(result.totalAmount) && result.totalAmount > 0) {
    state.amountReceived = result.totalAmount;
  }

  state.invoices = [];
  result.lines?.forEach(line => upsertInvoice(line));
  state.suggestions = result.suggestions || [];

  if (!state.amountReceived && state.invoices.length) {
    state.amountReceived = state.invoices.reduce((sum, row) => sum + Number(row.applied || 0), 0);
  }
}

function updateStatus(msg) {
  statusEl.textContent = msg || statusDefault;
}

class DocumentProcessor {
  constructor(onStatus) {
    this.onStatus = onStatus || (() => {});
  }

  resolveKind(file, docHint) {
    const ext = extOf(file.name);
    const mime = (file.type || '').toLowerCase();

    if ([ 'xlsx', 'xls', 'csv' ].includes(ext)) {
      const err = new Error('Spreadsheet capture is not available. Export the file as a PDF or image and retry.');
      err.code = 'unsupported';
      throw err;
    }

    if (ext === 'pdf' || mime === 'application/pdf') {
      return { kind: 'pdf', label: 'PDF document', docType: docHint };
    }

    if (mime.startsWith('image/') || [ 'png', 'jpg', 'jpeg', 'heic', 'heif' ].includes(ext)) {
      return { kind: 'image', label: 'image', docType: docHint || 'receipt' };
    }

    if ([ 'eml', 'msg', 'txt', 'html' ].includes(ext) || mime.startsWith('text/')) {
      return { kind: 'text', label: 'email/text document', docType: docHint };
    }

    return { kind: 'text', label: 'document', docType: docHint };
  }

  async process(file, docHint) {
    this.onStatus(`Analyzing ${file.name}…`);
    const meta = this.resolveKind(file, docHint);
    let text = '';

    if (meta.kind === 'pdf') {
      this.onStatus('Reading PDF pages…');
      const pdfjs = await ensurePDF();
      text = await this.extractPDFText(pdfjs, file);
    } else if (meta.kind === 'image') {
      this.onStatus('Running OCR on image…');
      const tesseract = await ensureTesseract();
      text = await this.extractImageText(tesseract, file);
    } else {
      this.onStatus('Reading document text…');
      text = await file.text();
    }

    this.onStatus('Extracting key fields…');
    const extraction = this.extractStructuredData(text, meta);
    extraction.kind = meta.kind;
    extraction.docType = meta.docType || 'auto';
    extraction.rawText = text;
    return extraction;
  }

  async extractPDFText(pdfjs, file) {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    let fullText = '';

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map(i => i.str).join('\n');
      fullText += '\n' + text;
    }

    return fullText;
  }

  async extractImageText(tesseract, file) {
    const dataURL = await this.readFileAsDataURL(file);
    const result = await tesseract.recognize(dataURL, 'eng');
    return result?.data?.text || '';
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  extractStructuredData(text, meta) {
    const cleaned = (text || '').replace(/\r/g, '\n');
    const lines = cleaned.split(/\n+/).map(l => l.trim()).filter(Boolean);

    const customer = this.findFirstMatch(lines, [
      /(Bill\s*To|Customer|Client|Company)[:\-\s]*([A-Za-z0-9 &'.,-]+)/i,
      /(Remitter|From)[:\-\s]*([A-Za-z0-9 &'.,-]+)/i
    ]);

    const vendor = this.findFirstMatch(lines, [
      /(Vendor|Payee|Supplier|Issued\s*By)[:\-\s]*([A-Za-z0-9 &'.,-]+)/i,
      /(Remit\s*To)[:\-\s]*([A-Za-z0-9 &'.,-]+)/i
    ]);

    const paymentDate = this.findDate(lines);
    const totalAmount = this.findAmount(lines, [
      /Total\s+(?:Amount|Payment|Paid|Due)[:\s]*([$\-+0-9,\.]+)/i,
      /Amount\s+(?:Due|Paid)[:\s]*([$\-+0-9,\.]+)/i,
      /Payment\s+Total[:\s]*([$\-+0-9,\.]+)/i
    ]);

    const linesData = this.extractLineItems(lines, meta?.docType);
    const suggestions = this.suggestCategories(lines);

    const derivedTotal = totalAmount || (linesData.length ? linesData.reduce((sum, row) => sum + Number(row.applied || 0), 0) : 0);

    return {
      customer: customer || '',
      vendor: vendor || '',
      paymentDate,
      totalAmount: derivedTotal,
      lines: linesData,
      suggestions,
      clearExisting: true
    };
  }

  findFirstMatch(lines, regexes) {
    for (const regex of regexes) {
      for (const line of lines) {
        const match = line.match(regex);
        if (match) {
          const value = match[2] || match[1];
          if (value) return value.toString().trim();
        }
      }
    }
    return '';
  }

  findDate(lines) {
    const dateRegexes = [
      /(\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b)/,
      /(\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b)/,
      /([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})/
    ];
    for (const line of lines) {
      for (const regex of dateRegexes) {
        const match = line.match(regex);
        if (match) {
          const normalized = normalizeDate(match[1]);
          if (normalized) return normalized;
        }
      }
    }
    return '';
  }

  findAmount(lines, regexes) {
    for (const regex of regexes) {
      for (const line of lines) {
        const match = line.match(regex);
        if (match) {
          const amount = parseMoney(match[1] || match[0]);
          if (amount) return amount;
        }
      }
    }
    return 0;
  }

  extractLineItems(lines, docTypeHint) {
    const items = [];
    const seen = new Set();
    const amountRegex = /([$\-+]?\d{1,3}(?:,\d{3})*(?:\.\d{2}))/;

    const considerLine = (invoice, amount, context) => {
      if (!invoice || !amount) return;
      const id = invoice.toString().trim();
      if (!id) return;
      if (seen.has(id) && amount === 0) return;
      seen.add(id);

      const applied = parseMoney(amount);
      if (!applied) return;

      const date = this.findNeighborDate(context);
      const description = this.extractDescription(context, id);

      items.push({
        invoice: id,
        applied,
        open: applied,
        original: applied,
        date,
        description: description || undefined
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const invToken = line.match(/(?:Invoice|Inv|Bill|Reference|Statement)[#:\s-]*([A-Za-z0-9_-]{2,})/i);
      if (invToken) {
        const amt = this.findNeighborAmount(lines, i, amountRegex);
        const context = { current: line, prev: lines[i - 1] || '', next: lines[i + 1] || '' };
        considerLine(invToken[1], amt, context);
        continue;
      }

      const columns = line.split(/\s{3,}|\t+/).map(col => col.trim()).filter(Boolean);
      if (columns.length >= 2) {
        const idCandidate = columns[0];
        const amountCandidate = columns[columns.length - 1];
        if (/^[A-Za-z0-9_-]{3,}$/.test(idCandidate) && amountRegex.test(amountCandidate)) {
          const context = {
            current: line,
            prev: lines[i - 1] || '',
            next: lines[i + 1] || ''
          };
          considerLine(idCandidate, amountCandidate, context);
        }
      }
    }

    if (!items.length && docTypeHint === 'receipt') {
      const amount = this.findAmount(lines, [/Subtotal[:\s]*([$\-+0-9,\.]+)/i, /Total[:\s]*([$\-+0-9,\.]+)/i]);
      if (amount) {
        items.push({
          invoice: 'RECEIPT',
          applied: amount,
          open: amount,
          original: amount,
          date: this.findDate(lines)
        });
      }
    }

    return items;
  }

  findNeighborAmount(lines, index, amountRegex) {
    const offsets = [0, 1, -1, 2, -2];
    for (const offset of offsets) {
      const target = lines[index + offset];
      if (!target) continue;
      const match = target.match(amountRegex);
      if (match) return match[1];
    }
    return '';
  }

  findNeighborDate({ current, next, prev }) {
    const sources = [current, next, prev];
    for (const src of sources) {
      if (!src) continue;
      const match = src.match(/(\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b)/);
      if (match) {
        const normalized = normalizeDate(match[1]);
        if (normalized) return normalized;
      }
    }
    return '';
  }

  extractDescription(context, invoiceId) {
    const { current, prev, next } = context;
    const removeId = (text) => text.replace(invoiceId, '').trim();
    const candidates = [removeId(current), removeId(next || ''), removeId(prev || '')]
      .map(s => s.replace(/[$\-+]?\d{1,3}(?:,\d{3})*(?:\.\d{2})/, '').trim())
      .filter(Boolean);
    return candidates[0] || '';
  }

  suggestCategories(lines) {
    const joined = lines.join(' ').toLowerCase();
    const suggestions = [];
    if (/(software|subscription|license|saas)/.test(joined)) suggestions.push('Software & Subscriptions');
    if (/(fuel|gas|diesel|mileage)/.test(joined)) suggestions.push('Fuel & Mileage');
    if (/(office|supplies|stationery)/.test(joined)) suggestions.push('Office Supplies');
    if (/(rent|lease)/.test(joined)) suggestions.push('Rent or Lease');
    if (/(consulting|professional|legal)/.test(joined)) suggestions.push('Professional Services');
    if (/(utilities|electric|water|power)/.test(joined)) suggestions.push('Utilities');
    return suggestions.slice(0, 3);
  }
}

function normalizeDate(v) {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();

  const mdy = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (mdy) {
    const [_, m, d, y] = mdy;
    const yyyy = y.length === 2 ? (Number(y) > 50 ? '19' + y : '20' + y.padStart(2, '0')) : y;
    return `${String(yyyy).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const ymd = s.match(/(\d{4})[\-\/.](\d{1,2})[\-\/.](\d{1,2})/);
  if (ymd) {
    const [_, y, m, d] = ymd;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const long = new Date(s);
  if (!isNaN(long)) return long.toISOString().slice(0, 10);
  return '';
}

function extOf(name) {
  return (name || '').split('.').pop().toLowerCase();
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportCSV() {
  if (!state.invoices.length) {
    toast('No line items to export yet.');
    return;
  }

  const header = ['Customer', 'PaymentDate', 'Invoice', 'DueDate', 'AmountApplied', 'Description', 'Discount', 'OpenBalance'];
  const rows = [header.join(',')];

  state.invoices.forEach(row => {
    rows.push([
      csvEscape(state.payer || ''),
      csvEscape(state.date || ''),
      csvEscape(row.invoice || ''),
      csvEscape(row.date || ''),
      csvEscape(Number(row.applied || 0).toFixed(2)),
      csvEscape(row.description || ''),
      csvEscape(Number(row.discount || 0).toFixed(2)),
      csvEscape(Number(row.open || 0).toFixed(2))
    ].join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `remittance_capture_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast('Exported CSV');
}

$('#btnExportCSV').onclick = exportCSV;
$('#btnPrint').onclick = () => window.print();
$('#btnSave').onclick = () => toast('Payment recorded successfully!');
$('#currency').onchange = () => render();

$('#payer').oninput = e => { state.payer = e.target.value; render(); };
$('#paydate').oninput = e => { state.date = e.target.value; render(); };
$('#amountReceived').oninput = e => {
  state.amountReceived = parseMoney(e.target.value);
  render();
};

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
    r.applied = e.target.checked ? (r.open || r.original || 0) : 0;
    render();
  }
});

$('#btnClear').onclick = () => {
  resetState();
  updateStatus(statusDefault);
  toast('Cleared');
};

$('#btnSample').onclick = () => {
  state = {
    payer: 'Expedition Trailers',
    vendor: 'Summit Manufacturing',
    date: new Date().toISOString().slice(0, 10),
    amountReceived: 4990.08,
    invoices: [
      {
        invoice: '2085-33',
        open: 4990.08,
        applied: 4990.08,
        original: 4990.08,
        date: new Date().toISOString().slice(0, 10),
        description: 'Trailer deposit'
      },
      {
        invoice: '2085-34',
        open: 10910.50,
        applied: 0,
        original: 10910.50,
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        description: 'Balance due on invoice 2085-34'
      }
    ],
    suggestions: ['Professional Services', 'Software & Subscriptions']
  };
  render();
  updateStatus('Sample data loaded. Suggested categories: Professional Services, Software & Subscriptions');
  toast('Sample data loaded');
};

const pick = $('#pick');
const drop = $('#drop');
const fileInput = $('#file');
const docProcessor = new DocumentProcessor(updateStatus);

pick.onclick = () => fileInput.click();

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
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});

fileInput.onchange = (e) => {
  const f = e.target.files?.[0];
  if (f) handleFile(f);
};

async function handleFile(f) {
  try {
    updateStatus(`Capturing ${f.name}…`);
    const docHint = $('#mode').value;
    const result = await docProcessor.process(f, docHint);
    if (result.clearExisting !== false) {
      state = initialState();
    }
    applyDocumentInsights(result);
    render();

    const summaryParts = [];
    if (state.vendor) summaryParts.push(`Vendor: ${state.vendor}`);
    if (state.payer) summaryParts.push(`Customer: ${state.payer}`);
    summaryParts.push(`Extracted ${result.lines?.length || 0} line(s).`);
    if (state.suggestions?.length) summaryParts.push(`Suggested categories: ${state.suggestions.join(', ')}`);
    updateStatus(summaryParts.join(' '));

    toast('Document captured successfully!');
  } catch (err) {
    console.error('Capture failed', err);
    toast('Capture failed. See console for details.');
    updateStatus(err?.message ? `Capture failed: ${err.message}` : 'Capture failed.');
  }
}

window.addEventListener('load', () => {
  render();
  updateStatus(statusDefault);
});
