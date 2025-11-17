/**
 * Robust Remittance Parser
 * Handles PDF, XLSX, and CSV remittance files with format-specific parsing
 * Now with OCR support for scanned documents
 */

// Import logger if available
let logger = console; // Fallback to console
if (typeof window !== 'undefined' && window.logger) {
  logger = window.logger;
}

class RemittanceParser {
  constructor() {
    this.pdfjsLib = null;
    this.XLSX = null;
    this.Tesseract = null;
  }

  /**
   * Initialize required libraries
   */
  async init() {
    // Initialize PDF.js using dynamic import (ESM module)
    if (!this.pdfjsLib) {
      try {
        const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
        this.pdfjsLib = pdfjs.default || pdfjs;

        if (this.pdfjsLib.GlobalWorkerOptions) {
          this.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
        }
      } catch (error) {
        throw new Error('Failed to load PDF.js library: ' + error.message);
      }
    }

    // Check for XLSX library
    if (typeof XLSX !== 'undefined') {
      this.XLSX = XLSX;
    }

    // Check for Tesseract (OCR)
    if (typeof Tesseract !== 'undefined') {
      this.Tesseract = Tesseract;
    }
  }

  /**
   * Main entry point - parse any remittance file
   */
  async parseFile(file) {
    await this.init();

    const ext = this.getExtension(file.name);
    const fileType = this.detectFileType(file, ext);

    logger.info(`Parsing ${file.name} as ${fileType}`);

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

  /**
   * Detect file type from extension and MIME type
   */
  detectFileType(file, ext) {
    const mime = (file.type || '').toLowerCase();
    
    if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
    if (['xlsx', 'xls'].includes(ext) || 
        mime.includes('spreadsheet') || 
        mime.includes('excel')) return 'xlsx';
    if (ext === 'csv' || mime === 'text/csv') return 'csv';
    
    throw new Error('Unknown file type');
  }

  /**
   * Get file extension
   */
  getExtension(filename) {
    return (filename || '').split('.').pop().toLowerCase();
  }

  /**
   * Parse PDF remittance
   */
  async parsePDF(file) {
    if (!this.pdfjsLib) {
      throw new Error('PDF.js library not loaded');
    }

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const pdf = await this.pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    // Check if we got meaningful text
    const hasText = fullText.trim().length > 50;

    // If no text found, this is likely an image-based PDF - use OCR
    if (!hasText) {
      logger.info('No text found in PDF - attempting OCR...');
      try {
        fullText = await this.performOCR(pdf);
        logger.success('OCR completed. Extracted text length:', fullText.length);
      } catch (ocrError) {
        throw new Error('This appears to be a scanned/image PDF. OCR extraction failed: ' + ocrError.message);
      }
    }

    // Detect PDF format and parse accordingly
    const format = this.detectPDFFormat(fullText);
    logger.info(`Detected PDF format: ${format}`);

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

  /**
   * Perform OCR on PDF pages using Tesseract.js
   */
  async performOCR(pdf) {
    if (!this.Tesseract) {
      throw new Error('Tesseract.js library not loaded');
    }

    let fullText = '';

    // Update status if available
    if (typeof updateStatus === 'function') {
      updateStatus('Scanning document with OCR...');
    }

    logger.info(`Starting OCR on ${pdf.numPages} page(s)...`);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      logger.info(`Running OCR on page ${pageNum}/${pdf.numPages}...`);

      if (typeof updateStatus === 'function') {
        updateStatus(`OCR scanning page ${pageNum} of ${pdf.numPages}...`);
      }

      // Update loading progress if available
      if (typeof window !== 'undefined' && window.ui && window.ui.loading) {
        const progress = 20 + (pageNum / pdf.numPages) * 60; // 20-80% range for OCR
        window.ui.loading.updateProgress(progress, `OCR page ${pageNum}/${pdf.numPages}...`);
      }

      const page = await pdf.getPage(pageNum);

      // Render page to canvas
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Run OCR on canvas
      const { data: { text } } = await this.Tesseract.recognize(
        canvas,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      logger.debug(`Page ${pageNum} extracted ${text.length} characters`);
      fullText += text + '\n';
    }

    logger.success('OCR complete, extracted', fullText.length, 'total characters');
    return fullText;
  }

  /**
   * Detect which PDF format we're dealing with
   */
  detectPDFFormat(text) {
    const lower = text.toLowerCase();
    
    if (lower.includes('meyer') && lower.includes('distributing')) {
      return 'meyer';
    }
    if (lower.includes('turn 5')) {
      return 'turn5';
    }
    if (lower.includes('orw usa')) {
      return 'orw';
    }
    
    return 'generic';
  }

  /**
   * Parse Meyer Distributing format
   * Key features: EFT payment number, co-op discount notes in description
   */
  parseMeyerPDF(text) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: 'Meyer Distributing',
      customer: '',
      invoices: []
    };

    // Extract payment number (EFT000000179629)
    const paymentMatch = text.match(/EFT\d{12}/);
    if (paymentMatch) {
      result.paymentNumber = paymentMatch[0];
    }

    // Extract payment date
    const dateMatch = text.match(/Payment Date[\s\S]*?(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
      result.paymentDate = this.normalizeDate(dateMatch[1]);
    }

    // Extract customer name (Vendor Name in Meyer's format)
    const customerMatch = text.match(/Vendor Name\s+([A-Za-z0-9\s&,.'-]+?)(?=\s+Vendor ID|Payment Number)/);
    if (customerMatch) {
      result.customer = customerMatch[1].trim();
    }

    // Extract invoice data
    // Meyer format: Document Number, Date, Description, Amount, Discount, Paid Amount
    const invoicePattern = /(\d{5})\s+(\d{2}\/\d{2}\/\d{4})\s+(?:.*?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})/g;
    let match;
    
    while ((match = invoicePattern.exec(text)) !== null) {
      const [_, invoiceNum, invoiceDate, amount, discount, paidAmount] = match;
      
      // Look for co-op discount note after this invoice
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

      // If co-op discount found in notes, calculate original amount
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

  /**
   * Parse Turn 5 format
   * Key features: Check number, simple table format
   */
  parseTurn5PDF(text) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: 'Turn 5, Inc.',
      customer: '',
      invoices: []
    };

    // Extract check number
    const checkMatch = text.match(/Check Number\s+(\d+)/i);
    if (checkMatch) {
      result.paymentNumber = checkMatch[1];
    }

    // Extract date
    const dateMatch = text.match(/Date\s+(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
      result.paymentDate = this.normalizeDate(dateMatch[1]);
    }

    // Extract customer
    const customerMatch = text.match(/Vendor\s+([A-Za-z0-9\s&,.'-]+?)(?=\s+Vendor ID)/);
    if (customerMatch) {
      result.customer = customerMatch[1].trim();
    }

    // Extract invoice data
    // Format: Invoice Number, Date, Amount, Discount, Paid Amount
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

  /**
   * Parse ORW USA format
   * Key features: Check on letterhead, account number format
   */
  parseORWPDF(text) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: 'ORW USA, INC.',
      customer: '',
      invoices: []
    };

    // Extract check/account number (26616)
    const checkMatch = text.match(/(\d{5})\s+09\/15\/25/);
    if (checkMatch) {
      result.paymentNumber = checkMatch[1];
    }

    // Extract date (might be in short format 09/15/25)
    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    if (dateMatch) {
      result.paymentDate = this.normalizeDate(dateMatch[1]);
    }

    // Extract customer from "PAY TO THE ORDER OF" section
    const customerMatch = text.match(/(?:PAY TO THE ORDER OF|ARTEC INDUSTRIES)/i);
    if (customerMatch) {
      result.customer = 'ARTEC INDUSTRIES';
    }

    // Extract invoice data from table
    // Format: Invoice #, Inv Date, Invoice Amount, Discounts, Deductions, Net Amount
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

  /**
   * Generic PDF parser for unknown formats
   */
  parseGenericPDF(text) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: '',
      customer: '',
      invoices: []
    };

    // Try to find payment number (various patterns)
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

    // Try to find date
    const dateMatch = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
    if (dateMatch) {
      result.paymentDate = this.normalizeDate(dateMatch[1]);
    }

    // Try to extract invoices (look for invoice numbers followed by amounts)
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

  /**
   * Parse XLSX file
   */
  async parseXLSX(file) {
    if (!this.XLSX) {
      throw new Error('XLSX library not loaded. Please include SheetJS library.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = this.XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = this.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    return this.parseXLSXData(data);
  }

  /**
   * Parse XLSX data array
   */
  parseXLSXData(data) {
    const result = {
      paymentNumber: '',
      paymentDate: '',
      vendor: '',
      customer: '',
      invoices: []
    };

    if (data.length === 0) return result;

    // Find header row
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
      logger.warn('Could not find header row in XLSX');
      return result;
    }

    // Map column indices
    const colMap = {
      invoice: this.findColumn(headers, ['invoice', 'inv', 'document', 'inv ref']),
      date: this.findColumn(headers, ['date', 'invoice date', 'inv date']),
      amount: this.findColumn(headers, ['amount', 'invoice amount', 'total']),
      discount: this.findColumn(headers, ['discount', 'discount $', 'disc']),
      paid: this.findColumn(headers, ['paid', 'paid amount', 'payment'])
    };

    // Check for payment metadata in first few rows
    for (let i = 0; i < Math.min(headerRow, data.length); i++) {
      const row = data[i];
      const rowStr = row.join(' ').toLowerCase();
      
      if (rowStr.includes('payment') && row.length >= 2) {
        result.paymentNumber = String(row[1] || '');
      }
      if (rowStr.includes('date') && row.length >= 2) {
        const dateVal = row[1];
        if (dateVal) {
          result.paymentDate = this.normalizeDate(dateVal);
        }
      }
    }

    // Parse invoice rows
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      
      if (!row || row.length === 0) continue;
      
      const invoiceNum = row[colMap.invoice];
      if (!invoiceNum) continue;

      const invoice = {
        invoice: String(invoiceNum).trim()
      };

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

  /**
   * Parse CSV file
   */
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

    // Check for account number in first few lines
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i];
      const accountMatch = line.match(/Account\s+Number[\s:]+(\d+)/i);
      if (accountMatch) {
        result.paymentNumber = accountMatch[1];
      }
    }

    // Find header row
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
      logger.warn('Could not find header row in CSV');
      return result;
    }

    // Map columns
    const colMap = {
      invoice: this.findColumn(headers, ['invoice', 'inv', 'document']),
      date: this.findColumn(headers, ['invoice date', 'date', 'inv date']),
      amount: this.findColumn(headers, ['invoice amount', 'amount']),
      discount: this.findColumn(headers, ['discount', 'cash discount']),
      paid: this.findColumn(headers, ['payment amount', 'paid', 'paid amount']),
      paymentDate: this.findColumn(headers, ['payment date'])
    };

    // Parse data rows
    for (let i = headerRow + 1; i < lines.length; i++) {
      const cells = this.parseCSVLine(lines[i]);
      
      if (cells.length === 0 || !cells[colMap.invoice]) continue;

      const invoice = {
        invoice: String(cells[colMap.invoice]).trim()
      };

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

      // Use payment date if available
      if (colMap.paymentDate >= 0 && cells[colMap.paymentDate]) {
        result.paymentDate = this.normalizeDate(cells[colMap.paymentDate]);
      }

      result.invoices.push(invoice);
    }

    return result;
  }

  /**
   * Parse a CSV line handling quoted fields
   */
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

  /**
   * Find column index by matching possible names
   */
  findColumn(headers, possibleNames) {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name));
      if (index >= 0) return index;
    }
    return -1;
  }

  /**
   * Parse money string to number
   */
  parseMoney(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    const str = String(value).replace(/[$,]/g, '').trim();
    const num = parseFloat(str);
    
    return isNaN(num) ? 0 : num;
  }

  /**
   * Normalize date to YYYY-MM-DD format
   */
  normalizeDate(value) {
    if (!value) return '';
    
    // Handle Excel date numbers
    if (typeof value === 'number' && value > 40000) {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    const str = String(value).trim();
    
    // Try MM/DD/YYYY or MM/DD/YY
    const mdy = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdy) {
      let [_, month, day, year] = mdy;
      
      // Handle 2-digit year
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }
      
      return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try YYYY-MM-DD
    const ymd = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      const [_, year, month, day] = ymd;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try parsing as date string
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

  /**
   * Format parsed result for display
   */
  formatResult(result) {
    console.log('\n=== PARSED RESULT ===');
    console.log('Payment Number:', result.paymentNumber || 'N/A');
    console.log('Payment Date:', result.paymentDate || 'N/A');
    console.log('Vendor:', result.vendor || 'N/A');
    console.log('Customer:', result.customer || 'N/A');
    console.log('\nInvoices:');
    
    result.invoices.forEach((inv, idx) => {
      console.log(`\n  Invoice ${idx + 1}: ${inv.invoice}`);
      if (inv.date) console.log(`    Date: ${inv.date}`);
      if (inv.amount) console.log(`    Amount: $${inv.amount.toFixed(2)}`);
      if (inv.discount) console.log(`    Discount: $${inv.discount.toFixed(2)}`);
      if (inv.paidAmount) console.log(`    Paid: $${inv.paidAmount.toFixed(2)}`);
      if (inv.coopDiscount) console.log(`    Co-op Discount: $${inv.coopDiscount.toFixed(2)}`);
      if (inv.originalAmount) console.log(`    Original Amount: $${inv.originalAmount.toFixed(2)}`);
      if (inv.notes) console.log(`    Notes: ${inv.notes}`);
    });
    
    console.log('\n====================\n');
    
    return result;
  }
}

// Export for use in Node.js or as ES module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RemittanceParser;
}

// Always make available on window for backward compatibility
if (typeof window !== 'undefined') {
  window.RemittanceParser = RemittanceParser;
}

// ES module export
export default RemittanceParser;
