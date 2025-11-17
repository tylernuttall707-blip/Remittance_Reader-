// PDF.js configuration
const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';

// Global variable to hold PDF.js library
let pdfjsLib = null;

// Load PDF.js library
async function initPDFJS() {
  if (pdfjsLib) return pdfjsLib;
  
  try {
    const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjsLib = pdfjs;
    
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
const $$ = (q) => document.querySelectorAll(q);

const fmtMoney = (n, cur = ($('#currency')?.value || 'USD')) => {
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

// State management
const initialState = () => ({
  supplier: '',
  invoiceId: '',
  invoiceDate: '',
  dueDate: '',
  netTerms: '',
  description: '',
  totalAmount: 0,
  lineItems: [],
  comments: []
});

let state = initialState();

function resetState() {
  state = initialState();
  render();
}

function render() {
  console.log('=== RENDER STATE ===', state);
  
  // Update form fields
  $('#supplier').value = state.supplier || '';
  $('#invoiceId').value = state.invoiceId || '';
  $('#invoiceDate').value = state.invoiceDate || '';
  $('#dueDate').value = state.dueDate || '';
  $('#netTerms').value = state.netTerms || '';
  $('#description').value = state.description || '';
  $('#totalAmount').value = state.totalAmount ? fmtMoney(state.totalAmount) : '';
  
  // Update amount display
  $('#displayAmount').textContent = state.totalAmount ? fmtMoney(state.totalAmount) : '$0.00';
  $('#currencyDisplay').textContent = $('#currency').value || 'USD';
  
  // Render line items
  renderLineItems();
  
  // Render comments
  renderComments();
}

function renderLineItems() {
  const tbody = $('#lineItems');
  tbody.innerHTML = '';
  
  let total = 0;
  
  state.lineItems.forEach((item, idx) => {
    const amount = (item.quantity || 0) * (item.unitPrice || 0);
    total += amount;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="number" 
               class="line-qty" 
               data-idx="${idx}" 
               value="${item.quantity || 1}" 
               min="0" 
               step="0.01" />
      </td>
      <td>
        <input type="text" 
               class="line-desc" 
               data-idx="${idx}" 
               value="${escapeHTML(item.description || '')}" 
               placeholder="Item description" />
      </td>
      <td>
        <input type="text" 
               class="line-price" 
               data-idx="${idx}" 
               value="${item.unitPrice ? fmtMoney(item.unitPrice) : ''}" 
               placeholder="$0.00" />
      </td>
      <td>
        <strong>${fmtMoney(amount)}</strong>
      </td>
      <td>
        <button class="btn-delete" data-idx="${idx}">✕</button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Update total
  $('#lineItemsTotal').textContent = fmtMoney(total);
  
  // Update main total if line items exist
  if (state.lineItems.length > 0 && !state.totalAmount) {
    state.totalAmount = total;
    $('#totalAmount').value = fmtMoney(total);
    $('#displayAmount').textContent = fmtMoney(total);
  }
}

function renderComments() {
  const list = $('#commentsList');
  list.innerHTML = '';
  
  state.comments.forEach(comment => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.textContent = comment;
    list.appendChild(div);
  });
}

function addLineItem() {
  state.lineItems.push({
    quantity: 1,
    description: '',
    unitPrice: 0,
    amount: 0
  });
  render();
  
  // Focus on the new description field
  setTimeout(() => {
    const inputs = $$('.line-desc');
    const lastInput = inputs[inputs.length - 1];
    if (lastInput) lastInput.focus();
  }, 50);
}

function deleteLineItem(idx) {
  state.lineItems.splice(idx, 1);
  render();
}

function updateLineItem(idx, field, value) {
  if (!state.lineItems[idx]) return;
  
  if (field === 'quantity') {
    state.lineItems[idx].quantity = parseFloat(value) || 0;
  } else if (field === 'description') {
    state.lineItems[idx].description = value;
  } else if (field === 'unitPrice') {
    state.lineItems[idx].unitPrice = parseMoney(value);
  }
  
  // Recalculate amount
  const item = state.lineItems[idx];
  item.amount = (item.quantity || 0) * (item.unitPrice || 0);
  
  render();
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Event handlers for line items
document.addEventListener('input', (e) => {
  if (e.target.classList.contains('line-qty')) {
    const idx = parseInt(e.target.dataset.idx);
    updateLineItem(idx, 'quantity', e.target.value);
  } else if (e.target.classList.contains('line-desc')) {
    const idx = parseInt(e.target.dataset.idx);
    updateLineItem(idx, 'description', e.target.value);
  } else if (e.target.classList.contains('line-price')) {
    const idx = parseInt(e.target.dataset.idx);
    updateLineItem(idx, 'unitPrice', e.target.value);
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete')) {
    const idx = parseInt(e.target.dataset.idx);
    deleteLineItem(idx);
  }
});

// Form field handlers
$('#supplier').oninput = e => { state.supplier = e.target.value; };
$('#invoiceId').oninput = e => { state.invoiceId = e.target.value; };
$('#invoiceDate').oninput = e => { state.invoiceDate = e.target.value; };
$('#dueDate').oninput = e => { state.dueDate = e.target.value; };
$('#netTerms').oninput = e => { state.netTerms = e.target.value; };
$('#description').oninput = e => { state.description = e.target.value; };
$('#totalAmount').oninput = e => { 
  state.totalAmount = parseMoney(e.target.value);
  $('#displayAmount').textContent = fmtMoney(state.totalAmount);
};

$('#currency').onchange = () => render();
$('#btnAddLine').onclick = () => addLineItem();

// Button handlers
$('#btnClear').onclick = () => {
  resetState();
  toast('Cleared');
};

$('#btnSample').onclick = () => {
  state = {
    supplier: 'Monroe Avex, LLC',
    invoiceId: '117831',
    invoiceDate: '2025-10-03',
    dueDate: '2025-11-02',
    netTerms: 'NET 30',
    description: 'Hardware - clinch nuts for manufacturing',
    totalAmount: 411.00,
    lineItems: [
      {
        quantity: 3000,
        description: '1/4-20 X .045 MAX GRIP CLINCH NUT ZINC PLATED',
        unitPrice: 0.137,
        amount: 411.00
      }
    ],
    comments: [
      'ACH Instructions: Johnson Bank - Routing #075911852',
      'Customer PO: 14228',
      'Ship Via: OUR TRUCK'
    ]
  };
  render();
  toast('Sample invoice loaded');
};

$('#btnSave').onclick = () => {
  if (!state.supplier || !state.invoiceId) {
    toast('⚠️ Please enter supplier name and invoice number');
    return;
  }
  
  console.log('Saving invoice:', state);
  toast('Invoice saved successfully!');
};

$('#btnExport').onclick = () => {
  if (!state.supplier) {
    toast('No invoice data to export');
    return;
  }
  
  const rows = [
    ['Supplier', 'Invoice ID', 'Invoice Date', 'Due Date', 'Net Terms', 'Total Amount', 'Description']
  ];
  
  rows.push([
    state.supplier,
    state.invoiceId,
    state.invoiceDate,
    state.dueDate,
    state.netTerms,
    state.totalAmount.toFixed(2),
    state.description
  ]);
  
  // Add line items
  rows.push([]);
  rows.push(['Line Items']);
  rows.push(['Quantity', 'Description', 'Unit Price', 'Amount']);
  
  state.lineItems.forEach(item => {
    rows.push([
      item.quantity,
      item.description,
      item.unitPrice.toFixed(2),
      item.amount.toFixed(2)
    ]);
  });
  
  // Add comments
  if (state.comments.length > 0) {
    rows.push([]);
    rows.push(['Comments']);
    state.comments.forEach(comment => {
      rows.push([comment]);
    });
  }
  
  const csv = rows.map(row => 
    row.map(cell => {
      const str = String(cell || '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  ).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice_${state.invoiceId || Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast('Exported CSV');
};

$('#btnPrint').onclick = () => window.print();

// File upload handlers
const pick = $('#pick');
const drop = $('#drop');
const fileInput = $('#file');
const statusEl = $('#status');

pick.onclick = () => fileInput.click();

['dragenter', 'dragover'].forEach(ev =>
  drop.addEventListener(ev, e => {
    e.preventDefault();
    e.stopPropagation();
    drop.style.borderColor = '#0077c5';
    drop.style.background = '#e6f3fb';
  })
);

drop.addEventListener('dragleave', e => {
  e.preventDefault();
  e.stopPropagation();
  drop.style.borderColor = '#c1c4c8';
  drop.style.background = '#f7f8fa';
});

drop.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  drop.style.borderColor = '#c1c4c8';
  drop.style.background = '#f7f8fa';
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});

fileInput.onchange = (e) => {
  const f = e.target.files?.[0];
  if (f) handleFile(f);
};

// Main file handler
async function handleFile(file) {
  try {
    statusEl.textContent = `Reading ${file.name}...`;
    
    // Initialize parser
    const parser = new InvoiceParser();
    await parser.init();
    
    // Parse the file
    const result = await parser.parseFile(file);
    
    console.log('=== PARSED INVOICE ===', result);
    
    // Update state with parsed data
    state.supplier = result.supplier || '';
    state.invoiceId = result.invoiceId || '';
    state.invoiceDate = result.invoiceDate || '';
    state.dueDate = result.dueDate || '';
    state.netTerms = result.netTerms || '';
    state.description = result.description || '';
    state.totalAmount = result.totalAmount || 0;
    state.lineItems = result.lineItems || [];
    state.comments = result.comments || [];
    
    // Render the form
    render();
    
    statusEl.textContent = `✓ Captured invoice ${result.invoiceId || 'data'}`;
    toast('Invoice captured successfully!');
    
  } catch (err) {
    console.error('Invoice capture failed:', err);
    statusEl.textContent = '✗ ' + (err.message || 'Capture failed');
    toast('Failed to read invoice. See console for details.');
  }
}

// Initialize
window.addEventListener('load', () => {
  render();
  statusEl.textContent = 'Ready to capture invoice data.';
});
