// Import modules
import RemittanceParser from './remittance-parser.js';
import logger from './logger.js';
import { showError, validateFile } from './error-handler.js';
import ui from './ui-utils.js';
import dataPersistence, { saveRemittanceState, loadRemittanceState, saveRemittanceRecord } from './data-persistence.js';

// Make logger and ui available globally for parser
window.logger = logger;
window.ui = ui;

// Helper functions
const $ = (q) => document.querySelector(q);
const rowsEl = $('#rows');
const statusEl = $('#status');
const toastEl = $('#toast');

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

const toast = (msg, type = 'info', duration = 3000) => {
  ui.toast(msg, type, duration);
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
  logger.debug('Rendering state with', state.invoices.length, 'invoices');

  const payerInput = $('#payer');
  const paydateInput = $('#paydate');
  const amountInput = $('#amountReceived');

  payerInput.value = state.payer || '';

  if (state.date) {
    paydateInput.value = state.date;
  }

  const formattedAmount = state.amountReceived ? fmtMoney(state.amountReceived) : '';
  amountInput.value = formattedAmount;

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

  // Auto-save state to localStorage
  saveRemittanceState(state);

  logger.debug('Render complete - Applied:', appliedSum, 'Credit:', credit);
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

// Global updateStatus function for parser to call
window.updateStatus = function(msg) {
  updateStatus(msg);
};

function updateStatus(msg) {
  statusEl.textContent = msg || statusDefault;
}

// Data validation functions
function validateAmount(amount) {
  const num = parseMoney(amount);
  if (isNaN(num) || num < 0) {
    return { valid: false, message: 'Amount must be a positive number' };
  }
  if (num > 1000000000) { // 1 billion sanity check
    return { valid: false, message: 'Amount seems unreasonably large. Please verify.' };
  }
  return { valid: true };
}

function validateDate(dateStr) {
  if (!dateStr) {
    return { valid: false, message: 'Date is required' };
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, message: 'Invalid date format' };
  }
  // Check if date is in reasonable range (not too far in past or future)
  const now = new Date();
  const yearAgo = new Date();
  yearAgo.setFullYear(now.getFullYear() - 1);
  const yearFromNow = new Date();
  yearFromNow.setFullYear(now.getFullYear() + 1);

  if (date < yearAgo) {
    logger.warn('Date is more than a year in the past');
  }
  if (date > yearFromNow) {
    return { valid: false, message: 'Date cannot be more than a year in the future' };
  }
  return { valid: true };
}

function validateCustomerName(name) {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: 'Customer name is required' };
  }
  if (name.length < 2) {
    return { valid: false, message: 'Customer name is too short' };
  }
  if (name.length > 200) {
    return { valid: false, message: 'Customer name is too long' };
  }
  return { valid: true };
}

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
$('#btnSave').onclick = async () => {
  try {
    // Clear previous validation errors
    ui.clearValidationErrors();

    // Validate customer name
    const nameValidation = validateCustomerName(state.payer);
    if (!nameValidation.valid) {
      ui.showValidationError('payer', nameValidation.message);
      toast(nameValidation.message, 'warning');
      return;
    }

    // Validate date if provided
    if (state.date) {
      const dateValidation = validateDate(state.date);
      if (!dateValidation.valid) {
        ui.showValidationError('paydate', dateValidation.message);
        toast(dateValidation.message, 'warning');
        return;
      }
    }

    // Validate amount
    const amountValidation = validateAmount(state.amountReceived);
    if (!amountValidation.valid) {
      ui.showValidationError('amountReceived', amountValidation.message);
      toast(amountValidation.message, 'warning');
      return;
    }

    // Validate we have invoices
    if (state.invoices.length === 0) {
      toast('Please add at least one invoice', 'warning');
      return;
    }

    // Confirm save
    const confirmed = await ui.confirm(
      `Save payment record for ${state.payer}?\nAmount: ${fmtMoney(state.amountReceived)}`,
      'Record Payment'
    );

    if (!confirmed) return;

    // Save to history
    const recordId = saveRemittanceRecord({
      ...state,
      recordedAt: new Date().toISOString()
    });

    // Show success
    toast('Payment recorded successfully!', 'success');
    logger.success('Payment recorded with ID:', recordId);

    // Ask if user wants to clear and start new
    const startNew = await ui.confirm(
      'Payment saved! Start a new payment entry?',
      'Success'
    );

    if (startNew) {
      resetState();
      updateStatus(statusDefault);
    }

  } catch (error) {
    logger.error('Failed to save payment:', error);
    toast('Failed to save payment', 'error');
  }
};
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
    // Validate file first
    validateFile(f);

    // Show loading indicator
    ui.loading.show(`Processing ${f.name}...`);
    updateStatus(`Processing ${f.name}...`);

    // Use parser
    const parser = new RemittanceParser();

    // Parse the file
    ui.loading.updateProgress(20, 'Reading file...');
    const result = await parser.parseFile(f);

    ui.loading.updateProgress(80, 'Extracting data...');

    logger.info('Parse result:', result.invoices.length, 'invoices found');

    // Validate we got some data
    if (!result.invoices || result.invoices.length === 0) {
      throw new Error('No invoice data found in this file');
    }

    // Clear existing state
    state = initialState();

    // Apply payment info
    // For AP (Accounts Payable) exports like SAP:
    //   - "customer" field (BP number) = VENDOR receiving payment
    //   - Payer = whoever ran the report (not in the file, user must fill in)
    // For AR (Accounts Receivable) exports:
    //   - "customer" field = CUSTOMER making payment
    //   - Vendor = us (recipient)

    // Check if this looks like an AP report (has BP number and payment to vendor)
    const isAccountsPayable = result.customer && !result.vendor;

    if (isAccountsPayable) {
      // AP report: Leave payer blank (user's company), put BP in memo
      state.payer = '';  // User needs to fill this in
      state.vendor = result.customer;  // BP number = vendor receiving payment
      // Add note about the vendor
      if (result.customer) {
        const memoEl = $('#memo');
        if (memoEl) {
          memoEl.value = `Payment to vendor: ${result.customer}`;
        }
      }
      // Update status to inform user
      updateStatus(`⚠️ Please enter who sent this payment (this is an AP report showing payment to ${result.customer})`);
    } else {
      // AR report or other: Use whichever fields are available
      state.payer = result.customer || result.vendor || '';
      state.vendor = result.vendor || '';
    }

    state.date = result.paymentDate || '';

    // Process invoices
    result.invoices.forEach((inv, idx) => {
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

      upsertInvoice(invoice);
    });

    // Calculate total amount received
    if (!state.amountReceived && state.invoices.length) {
      state.amountReceived = state.invoices.reduce(
        (sum, inv) => sum + (inv.applied || 0),
        0
      );
    }

    ui.loading.updateProgress(100, 'Complete!');

    render();

    const summary = `✓ Extracted ${result.invoices.length} invoice(s) from ${result.vendor || 'remittance'}`;
    updateStatus(summary);
    toast('Document captured successfully!', 'success');

    logger.success('File processed successfully');

  } catch (err) {
    logger.error('Capture failed:', err);
    showError(err, toastEl);
    updateStatus('Capture failed. Please try again or enter data manually.');
  } finally {
    // Always hide loading indicator
    ui.loading.hide();
  }
}

// Initialize
window.addEventListener('load', () => {
  logger.info('Application loaded');

  // Check for unsaved data and prompt to restore
  dataPersistence.promptRestoreData('remittance_current_state', (savedState) => {
    state = savedState;
    render();
    toast('Previous session restored', 'info', 5000);
  });

  // If no restoration, just render default state
  if (!dataPersistence.hasUnsavedData('remittance_current_state')) {
    render();
  }

  updateStatus(statusDefault);
});
