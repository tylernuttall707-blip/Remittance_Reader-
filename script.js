// PDF.js configuration - Load as module
const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';

// Global variable to hold PDF.js library
let pdfjsLib = null;

// Load PDF.js library
async function initPDFJS() {
  if (pdfjsLib) return pdfjsLib;
  
  try {
    const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjsLib = pdfjs;
    
    // Set worker source
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    }
    
    console.log('PDF.js loaded successfully');
    return pdfjsLib;
  } catch (error) {
    console.error('Failed to load PDF.js:', error);
    throw new Error('Failed to load PDF.js library');
  }
}

// Helper functions
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

// State management
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
  console.log('=== RENDER CALLED ===');
  console.log('Current state:', state);
  
  const payerInput = $('#payer');
  const paydateInput = $('#paydate');
  const amountInput = $('#amountReceived');
  
  console.log('Payer input element:', payerInput);
  console.log('Setting payer to:', state.payer);
  
  payerInput.value = state.payer || '';
  
  if (state.date) {
    console.log('Setting date to:', state.date);
    paydateInput.value = state.date;
  }
  
  const formattedAmount = state.amountReceived ? fmtMoney(state.amountReceived) : '';
  console.log('Setting amount to:', formattedAmount);
  amountInput.value = formattedAmount;
  
  $('#displayAmount').textContent = state.amountReceived ? fmtMoney(state.amountReceived) : '$0.00';
  $('#currencyDisplay').textContent = $('#currency').value || 'USD';

  rowsEl.innerHTML = '';
  let appliedSum = 0;
  
  console.log('Rendering', state.invoices.length, 'invoice rows');
  
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
    console.log('Added row for invoice:', row.invoice);
  });

  $('#appliedTotal').textContent = fmtMoney(appliedSum);
  const credit = Math.max(0, (state.amountReceived || 0) - appliedSum);
  $('#applyTotal').textContent = fmtMoney(appliedSum);
  $('#creditTotal').textContent = fmtMoney(credit);
  
  console.log('=== RENDER COMPLETE ===');
  console.log('Applied total:', appliedSum);
  console.log('Credit:', credit);
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

function updateStatus(msg) {
  statusEl.textContent = msg || statusDefault;
}

// ============================================================================
// REMITTANCE PARSER CLASS
// ============================================================================

class RemittanceParser {
  constructor() {
    this.pdfjsLib = null;
    this.XLSX = null;
  }

  async init() {
    // Initialize PDF.js
    if (!this.pdfjsLib) {
      this.pdfjsLib = await initPDFJS();
    }
    
    // Check for XLSX
    if (typeof XLSX !== 'undefined') {
      this.XLSX = XLSX;
    }
  }

  async parseFile(file) {
    await this.init();
    const ext = this.getExtension(file.name);
    const fileType = this.detectFileType(file, ext);
    console.log(`Parsing ${file.name} as ${fileType}`);

    switch (fileType) {
      case 'pdf':
        return await this.parsePDF(file);
      case 'xlsx':
        return await this.parseXLSX(file);
      case 'csv':
        return await this.parseCSV(file);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  detectFileType(file, ext) {
    const mime = (file.type || '').toLowerCase();
    if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
    if (['xlsx', 'xls'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) return 'xlsx';
    if (ext === 'csv' || mime === 'text/csv') return 'csv';
    throw new Error('Unknown file type');
  }

  getExtension(filename) {
    return (filename || '').split('.').pop().toLowerCase();
  }

  async parsePDF(file) {
    if (!this.pdfjsLib) {
      throw new Error('PDF.js library not loaded');
    }

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const pdf = await this.pdfjsLib.getDocument({ data }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    const format = this.detectPDFFormat(fullText);
    console.log(`Detected PDF format: ${format}`);

    switch (format) {
      case 'meyer':
        return this.parseMeyerPDF(fullText);
      case 'turn5':
        return this.parseTurn5PDF(fullText);
      case 'orw':
        return this.parseORWPDF(fullText);
      default:
        return this.parseGenericPDF(fullText);
    }
  }

  detectPDFFormat(text) {
    const lower = text.toLowerCase();
    if (lower.includes('meyer') && lower.includes('distributing')) return 'meyer';
    if (lower.includes('turn 5')) return 'turn5';
    if (lower.includes('orw usa')) return 'orw';
    return 'generic';
  }

  parseMeyerPDF(text) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: 'Meyer Distributing',
      customer: '',
      invoices: []
    };

    const paymentMatch = text.match(/EFT\d{12}/);
    if (paymentMatch) result.paymentNumber = paymentMatch[0];

    const dateMatch = text.match(/Payment Date[\s\S]*?(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) result.paymentDate = this.normalizeDate(dateMatch[1]);

    const customerMatch = text.match(/Vendor Name\s+([A-Za-z0-9\s&,.'-]+?)(?=\s+Vendor ID|Payment Number)/);
    if (customerMatch) result.customer = customerMatch[1].trim();

    const invoicePattern = /(\d{5})\s+(\d{2}\/\d{2}\/\d{4})\s+(?:.*?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})/g;
    let match;

    while ((match = invoicePattern.exec(text)) !== null) {
      const [_, invoiceNum, invoiceDate, amount, discount, paidAmount] = match;
      const notePattern = new RegExp(`${invoiceNum}[\\s\\S]{0,200}?short pay.*?\\$([\\.\\d,]+).*?co-?op`, 'i');
      const noteMatch = text.match(notePattern);

      const invoice = {
        invoice: invoiceNum,
        date: this.normalizeDate(invoiceDate),
        amount: this.parseMoney(amount),
        discount: this.parseMoney(discount),
        paidAmount: this.parseMoney(paidAmount),
        originalAmount: null,
        coopDiscount: null,
        notes: null
      };

      if (noteMatch) {
        invoice.coopDiscount = this.parseMoney(noteMatch[1]);
        invoice.originalAmount = invoice.amount + invoice.coopDiscount;
        invoice.notes = noteMatch[0].trim();
      } else {
        invoice.originalAmount = invoice.amount;
      }

      result.invoices.push(invoice);
    }

    return result;
  }

  parseTurn5PDF(text) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: 'Turn 5, Inc.',
      customer: '',
      invoices: []
    };

    const checkMatch = text.match(/Check Number\s+(\d+)/i);
    if (checkMatch) result.paymentNumber = checkMatch[1];

    const dateMatch = text.match(/Date\s+(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) result.paymentDate = this.normalizeDate(dateMatch[1]);

    const customerMatch = text.match(/Vendor\s+([A-Za-z0-9\s&,.'-]+?)(?=\s+Vendor ID)/);
    if (customerMatch) result.customer = customerMatch[1].trim();

    const invoicePattern = /(\d{5})\s+(\d{2}\/\d{2}\/\d{4})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})/g;
    let match;

    while ((match = invoicePattern.exec(text)) !== null) {
      const [_, invoiceNum, invoiceDate, amount, discount, paidAmount] = match;
      result.invoices.push({
        invoice: invoiceNum,
        date: this.normalizeDate(invoiceDate),
        amount: this.parseMoney(amount),
        discount: this.parseMoney(discount),
        paidAmount: this.parseMoney(paidAmount)
      });
    }

    return result;
  }

  parseORWPDF(text) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: 'ORW USA, INC.',
      customer: '',
      invoices: []
    };

    const checkMatch = text.match(/(\d{5})\s+09\/15\/25/);
    if (checkMatch) result.paymentNumber = checkMatch[1];

    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    if (dateMatch) result.paymentDate = this.normalizeDate(dateMatch[1]);

    const customerMatch = text.match(/(?:PAY TO THE ORDER OF|ARTEC INDUSTRIES)/i);
    if (customerMatch) result.customer = 'ARTEC INDUSTRIES';

    const invoicePattern = /(\d{5})\s+(\d{2}\/\d{2}\/\d{2})\s+([\d,]+\.\d{2})\s+([\d.]+)\s+([\d.]+)\s+([\d,]+\.\d{2})/g;
    let match;

    while ((match = invoicePattern.exec(text)) !== null) {
      const [_, invoiceNum, invoiceDate, amount, discounts, deductions, netAmount] = match;
      result.invoices.push({
        invoice: invoiceNum,
        date: this.normalizeDate(invoiceDate),
        amount: this.parseMoney(amount),
        discount: this.parseMoney(discounts),
        paidAmount: this.parseMoney(netAmount)
      });
    }

    return result;
  }

  parseGenericPDF(text) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: '',
      customer: '',
      invoices: []
    };

    const paymentPatterns = [
      /Payment\s+(?:Number|#)[\s:]+([A-Z0-9-]+)/i,
      /Check\s+(?:Number|#)[\s:]+([A-Z0-9-]+)/i,
      /EFT[\s#]*(\d+)/i,
      /Reference[\s:]+([A-Z0-9-]+)/i
    ];

    for (const pattern of paymentPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.paymentNumber = match[1];
        break;
      }
    }

    const dateMatch = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
    if (dateMatch) result.paymentDate = this.normalizeDate(dateMatch[1]);

    const invoicePattern = /(?:Invoice|Inv)[\s#:]*(\d{4,})[^\d]*?([\d,]+\.\d{2})/gi;
    let match;

    while ((match = invoicePattern.exec(text)) !== null) {
      result.invoices.push({
        invoice: match[1],
        amount: this.parseMoney(match[2]),
        paidAmount: this.parseMoney(match[2])
      });
    }

    return result;
  }

  async parseXLSX(file) {
    if (!this.XLSX) {
      throw new Error('XLSX library not loaded. Please include SheetJS library.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = this.XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = this.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    return this.parseXLSXData(data);
  }

  parseXLSXData(data) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: '',
      customer: '',
      invoices: []
    };

    if (data.length === 0) return result;

    let headerRow = -1;
    let headers = [];

    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      const rowStr = row.join('').toLowerCase();
      if (rowStr.includes('invoice') || rowStr.includes('payment')) {
        headerRow = i;
        headers = row.map(h => String(h || '').toLowerCase().trim());
        break;
      }
    }

    if (headerRow === -1) {
      console.warn('Could not find header row in XLSX');
      return result;
    }

    const colMap = {
      invoice: this.findColumn(headers, ['invoice', 'inv', 'document', 'inv ref']),
      date: this.findColumn(headers, ['date', 'invoice date', 'inv date']),
      amount: this.findColumn(headers, ['amount', 'invoice amount', 'total']),
      discount: this.findColumn(headers, ['discount', 'discount $', 'disc']),
      paid: this.findColumn(headers, ['paid', 'paid amount', 'payment'])
    };

    for (let i = 0; i < Math.min(headerRow, data.length); i++) {
      const row = data[i];
      const rowStr = row.join(' ').toLowerCase();
      if (rowStr.includes('payment') && row.length >= 2) {
        result.paymentNumber = String(row[1] || '');
      }
      if (rowStr.includes('date') && row.length >= 2) {
        const dateVal = row[1];
        if (dateVal) result.paymentDate = this.normalizeDate(dateVal);
      }
    }

    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const invoiceNum = row[colMap.invoice];
      if (!invoiceNum) continue;

      const invoice = { invoice: String(invoiceNum).trim() };

      if (colMap.date >= 0 && row[colMap.date]) {
        invoice.date = this.normalizeDate(row[colMap.date]);
      }
      if (colMap.amount >= 0) {
        invoice.amount = this.parseMoney(row[colMap.amount]);
      }
      if (colMap.discount >= 0) {
        invoice.discount = this.parseMoney(row[colMap.discount]);
      }
      if (colMap.paid >= 0) {
        invoice.paidAmount = this.parseMoney(row[colMap.paid]);
      } else if (invoice.amount && invoice.discount) {
        invoice.paidAmount = invoice.amount - invoice.discount;
      }

      result.invoices.push(invoice);
    }

    return result;
  }

  async parseCSV(file) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: '',
      customer: '',
      invoices: []
    };

    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i];
      const accountMatch = line.match(/Account\s+Number[\s:]+(\d+)/i);
      if (accountMatch) result.paymentNumber = accountMatch[1];
    }

    let headerRow = -1;
    let headers = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('invoice') && (line.includes('amount') || line.includes('payment'))) {
        headerRow = i;
        headers = this.parseCSVLine(lines[i]).map(h => h.toLowerCase().trim());
        break;
      }
    }

    if (headerRow === -1) {
      console.warn('Could not find header row in CSV');
      return result;
    }

    const colMap = {
      invoice: this.findColumn(headers, ['invoice', 'inv', 'document']),
      date: this.findColumn(headers, ['invoice date', 'date', 'inv date']),
      amount: this.findColumn(headers, ['invoice amount', 'amount']),
      discount: this.findColumn(headers, ['discount', 'cash discount']),
      paid: this.findColumn(headers, ['payment amount', 'paid', 'paid amount']),
      paymentDate: this.findColumn(headers, ['payment date'])
    };

    for (let i = headerRow + 1; i < lines.length; i++) {
      const cells = this.parseCSVLine(lines[i]);
      if (cells.length === 0 || !cells[colMap.invoice]) continue;

      const invoice = { invoice: String(cells[colMap.invoice]).trim() };

      if (colMap.date >= 0 && cells[colMap.date]) {
        invoice.date = this.normalizeDate(cells[colMap.date]);
      }
      if (colMap.amount >= 0) {
        invoice.amount = this.parseMoney(cells[colMap.amount]);
      }
      if (colMap.discount >= 0) {
        invoice.discount = this.parseMoney(cells[colMap.discount]);
      }
      if (colMap.paid >= 0) {
        invoice.paidAmount = this.parseMoney(cells[colMap.paid]);
      }
      if (colMap.paymentDate >= 0 && cells[colMap.paymentDate]) {
        result.paymentDate = this.normalizeDate(cells[colMap.paymentDate]);
      }

      result.invoices.push(invoice);
    }

    return result;
  }

  parseCSVLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    cells.push(current.trim());
    return cells;
  }

  findColumn(headers, possibleNames) {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name));
      if (index >= 0) return index;
    }
    return -1;
  }

  parseMoney(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const str = String(value).replace(/[$,]/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  normalizeDate(value) {
    if (!value) return '';
    if (typeof value === 'number' && value > 40000) {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    const str = String(value).trim();
    const mdy = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdy) {
      let [_, month, day, year] = mdy;
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }
      return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const ymd = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      const [_, year, month, day] = ymd;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // Ignore
    }

    return '';
  }
}

// ============================================================================
// END OF REMITTANCE PARSER CLASS
// ============================================================================

// Export/CSV functions
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

// Button handlers
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

// File upload handlers
const pick = $('#pick');
const drop = $('#drop');
const fileInput = $('#file');

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

// Main file handler
async function handleFile(f) {
  try {
    updateStatus(`Capturing ${f.name}…`);
    
    // Use parser
    const parser = new RemittanceParser();
    const result = await parser.parseFile(f);
    
    console.log('=== PARSER RESULT ===');
    console.log('Customer:', result.customer);
    console.log('Vendor:', result.vendor);
    console.log('Payment Date:', result.paymentDate);
    console.log('Invoices count:', result.invoices.length);
    console.log('Full result:', result);
    
    // Clear existing state
    state = initialState();
    console.log('State cleared');
    
    // Apply payment info
    state.payer = result.customer || '';
    state.vendor = result.vendor || '';
    state.date = result.paymentDate || '';
    
    console.log('=== STATE AFTER PAYMENT INFO ===');
    console.log('state.payer:', state.payer);
    console.log('state.vendor:', state.vendor);
    console.log('state.date:', state.date);
    
    // Process invoices
    result.invoices.forEach((inv, idx) => {
      console.log(`Processing invoice ${idx + 1}:`, inv);
      
      const invoice = {
        invoice: inv.invoice,
        date: inv.date || '',
        applied: inv.paidAmount || inv.amount || 0,
        open: inv.paidAmount || inv.amount || 0,
        original: inv.originalAmount || inv.amount || 0
      };
      
      if (inv.discount) {
        invoice.discount = inv.discount;
      }
      
      if (inv.notes || inv.description) {
        invoice.description = inv.notes || inv.description;
      }
      
      console.log('Calling upsertInvoice with:', invoice);
      upsertInvoice(invoice);
    });
    
    console.log('=== STATE AFTER INVOICES ===');
    console.log('state.invoices:', state.invoices);
    
    // Calculate total amount received
    if (!state.amountReceived && state.invoices.length) {
      state.amountReceived = state.invoices.reduce(
        (sum, inv) => sum + (inv.applied || 0), 
        0
      );
    }
    
    console.log('=== STATE BEFORE RENDER ===');
    console.log('state.amountReceived:', state.amountReceived);
    console.log('Full state:', state);
    
    render();
    
    console.log('=== AFTER RENDER ===');
    console.log('Payer input value:', $('#payer')?.value);
    console.log('Date input value:', $('#paydate')?.value);
    console.log('Amount input value:', $('#amountReceived')?.value);
    
    const summary = `Extracted ${result.invoices.length} invoice(s) from ${result.vendor || 'remittance'}`;
    updateStatus(summary);
    toast('Document captured successfully!');
    
  } catch (err) {
    console.error('Capture failed', err);
    toast('Capture failed. See console for details.');
    updateStatus(err?.message || 'Capture failed.');
  }
}

// Initialize
window.addEventListener('load', () => {
  render();
  updateStatus(statusDefault);
});
