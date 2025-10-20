/**
 * FIXED Invoice Parser - Handles Real Invoice Formats
 * Tested with: Affiliated Metals, TCI, Cahaba, Traco, Pacific Steel, etc.
 */

class EnhancedInvoiceParser {
  constructor() {
    this.pdfjsLib = null;
    this.XLSX = null;
    this.Tesseract = null;
  }

  async init() {
    if (!this.pdfjsLib) {
      try {
        // Load PDF.js as ESM module
        const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
        
        // FIXED: Access the correct export from ESM module
        this.pdfjsLib = pdfjs.default || pdfjs;
        
        // Set worker
        if (this.pdfjsLib.GlobalWorkerOptions) {
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
        }
        
        console.log('✅ PDF.js loaded (getDocument exists:', typeof this.pdfjsLib.getDocument !== 'undefined', ')');
      } catch (error) {
        console.error('❌ Failed to load PDF.js:', error);
        throw error;
      }
    }

    if (typeof XLSX !== 'undefined') {
      this.XLSX = XLSX;
      console.log('✅ XLSX available');
    }

    // Load Tesseract.js for OCR (lazy load only when needed)
    if (!this.Tesseract && typeof Tesseract !== 'undefined') {
      this.Tesseract = Tesseract;
      console.log('✅ Tesseract.js available');
    }
  }

  async loadTesseract() {
    if (!this.Tesseract) {
      try {
        console.log('📦 Loading Tesseract.js for OCR...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        this.Tesseract = window.Tesseract;
        console.log('✅ Tesseract.js loaded');
      } catch (error) {
        console.error('❌ Failed to load Tesseract.js:', error);
        throw new Error('OCR library (Tesseract.js) failed to load');
      }
    }
    return this.Tesseract;
  }

  async parseFile(file) {
    await this.init();
    const ext = file.name.split('.').pop().toLowerCase();
    
    console.log(`📄 Parsing ${file.name} (type: ${ext})`);

    if (ext === 'pdf') return await this.parsePDF(file);
    if (['xlsx', 'xls'].includes(ext)) return await this.parseXLSX(file);
    if (ext === 'csv') return await this.parseCSV(file);
    
    throw new Error(`Unsupported file type: ${ext}`);
  }

  async parsePDF(file) {
    if (!this.pdfjsLib) {
      throw new Error('PDF.js not loaded');
    }

    try {
      console.log('📖 Loading PDF...');
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      
      console.log('📊 PDF size:', typedArray.length, 'bytes');
      
      // Load the PDF document
      const loadingTask = this.pdfjsLib.getDocument({ data: typedArray });
      const pdf = await loadingTask.promise;
      
      console.log('📄 PDF loaded, pages:', pdf.numPages);
      
      let fullText = '';
      let totalTextItems = 0;
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`📃 Processing page ${pageNum}/${pdf.numPages}...`);
        
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        totalTextItems += textContent.items.length;
        console.log(`  - Text items on page ${pageNum}:`, textContent.items.length);
        
        // Join text items with space
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        fullText += pageText + '\n\n';
      }

      console.log('✅ Extracted text length:', fullText.length);
      console.log('📝 First 500 chars:', fullText.substring(0, 500));

      // If no text found, this is likely an image-based PDF - use OCR
      if (totalTextItems === 0 || fullText.trim().length < 50) {
        console.log('⚠️ No text found in PDF - this appears to be an image-based/scanned PDF');
        console.log('🔍 Switching to OCR mode...');
        
        return await this.parsePDFWithOCR(file, pdf);
      }

      console.log('📝 Last 200 chars:', fullText.substring(Math.max(0, fullText.length - 200)));

      if (fullText.length < 10) {
        throw new Error('PDF text extraction failed - extracted less than 10 characters');
      }

      return this.intelligentExtract(fullText);
      
    } catch (error) {
      console.error('❌ PDF parsing error:', error);
      throw error;
    }
  }

  async parsePDFWithOCR(file, pdf) {
    console.log('🤖 Starting OCR extraction...');
    
    // Load Tesseract if not already loaded
    await this.loadTesseract();
    
    let fullText = '';
    
    // Process each page with OCR
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`🔍 OCR processing page ${pageNum}/${pdf.numPages}...`);
      
      try {
        const page = await pdf.getPage(pageNum);
        
        // Render page to canvas
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale = better quality
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        console.log(`  - Rendered page ${pageNum} to canvas (${canvas.width}x${canvas.height})`);
        
        // Run OCR on the canvas
        const result = await this.Tesseract.recognize(
          canvas,
          'eng',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`  - OCR progress: ${Math.round(m.progress * 100)}%`);
              }
            }
          }
        );
        
        const pageText = result.data.text;
        fullText += pageText + '\n\n';
        
        console.log(`  ✅ Extracted ${pageText.length} characters from page ${pageNum}`);
        
      } catch (error) {
        console.error(`  ❌ OCR failed for page ${pageNum}:`, error);
      }
    }
    
    console.log('✅ OCR complete. Total text length:', fullText.length);
    console.log('📝 First 500 chars:', fullText.substring(0, 500));
    
    if (fullText.length < 50) {
      throw new Error('OCR extraction failed - no text recognized');
    }
    
    return this.intelligentExtract(fullText);
  }

  intelligentExtract(text) {
    console.log('🧠 Starting extraction...');
    
    const result = {
      supplier: '',
      invoiceId: '',
      invoiceDate: '',
      dueDate: '',
      netTerms: '',
      description: '',
      lineItems: [],
      totalAmount: 0,
      comments: []
    };

    // 1. Extract supplier - SIMPLIFIED
    result.supplier = this.extractSupplierSimple(text);
    console.log('✓ Supplier:', result.supplier);

    // 2. Extract invoice ID - IMPROVED
    result.invoiceId = this.extractInvoiceIdImproved(text);
    console.log('✓ Invoice ID:', result.invoiceId);

    // 3. Extract dates
    const dates = this.extractDates(text);
    result.invoiceDate = dates.invoiceDate;
    result.dueDate = dates.dueDate;
    console.log('✓ Invoice Date:', result.invoiceDate);
    console.log('✓ Due Date:', result.dueDate);

    // 4. Extract terms
    result.netTerms = this.extractTerms(text);
    console.log('✓ Terms:', result.netTerms);

    // 5. Extract line items - FIXED
    result.lineItems = this.extractLineItemsFixed(text);
    console.log('✓ Line items found:', result.lineItems.length);

    // 6. Extract total - IMPROVED
    result.totalAmount = this.extractTotalImproved(text, result.lineItems);
    console.log('✓ Total:', result.totalAmount);

    // 7. Extract comments
    result.comments = this.extractComments(text);

    return result;
  }

  /**
   * SIMPLIFIED supplier extraction - looks for common patterns
   */
  extractSupplierSimple(text) {
    const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    
    // Strategy 1: Look for specific known suppliers first (case-insensitive)
    const knownSuppliers = [
      /PACIFIC\s+STEEL\s+(?:&|AND)\s+RECYCLING/i,
      /AFFILIATED\s+METALS/i,
      /TCI\s+STEEL/i
    ];
    
    for (const pattern of knownSuppliers) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
    
    // Strategy 2: Look in first 30 lines for company with LLC/Inc/Corp
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i];
      
      // Match: "COMPANY NAME LLC" or "Company Name, Inc."
      const entityMatch = line.match(/^([A-Z][A-Za-z\s&,.'()-]+?)\s*(LLC|Inc\.|Corp\.|Co\.|Company|Limited|Ltd\.)/i);
      if (entityMatch && !this.isBlacklistedSupplier(entityMatch[0])) {
        return entityMatch[0].trim();
      }
    }
    
    // Strategy 3: Look for all-caps company name (common in headers)
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i];
      
      // All caps, 10-60 chars, at least 2 words
      if (/^[A-Z][A-Z\s&,'.-]{10,60}$/.test(line) && line.split(/\s+/).length >= 2) {
        if (!this.isBlacklistedSupplier(line)) {
          return line.trim();
        }
      }
    }
    
    // Strategy 4: Look for "Bill From:", "Sold By:", etc.
    const billFromMatch = text.match(/(?:Bill\s+From|Sold\s+By|From|Remit\s+To|Vendor)[\s:]+([A-Z][A-Za-z\s&,.'-]+(?:LLC|Inc\.|Corp\.|Co\.|Company)?)/i);
    if (billFromMatch && !this.isBlacklistedSupplier(billFromMatch[1])) {
      return billFromMatch[1].trim();
    }
    
    return '';
  }

  isBlacklistedSupplier(text) {
    const lower = text.toLowerCase();
    const blacklist = [
      'invoice', 'bill to', 'ship to', 'sold to', 'artec',
      'payment', 'total', 'amount due', 'customer', 'vendor number'
    ];
    return blacklist.some(b => lower.includes(b));
  }

  /**
   * IMPROVED invoice ID extraction
   */
  extractInvoiceIdImproved(text) {
    // Priority order of patterns
    const patterns = [
      // "Invoice 9165009" (Pacific Steel format)
      /Invoice\s+(\d{7,9})/i,
      
      // "Invoice #123456" or "Invoice No: 123456"
      /Invoice\s+(?:Number|No\.?|#)[\s:]+([A-Z0-9-]+)/i,
      
      // "Invoice 123456" (standalone)
      /Invoice[\s:]+([A-Z0-9-]{5,})/i,
      
      // Invoice ID in header: "16 IV-612811"
      /^(\d+\s+[A-Z]{2,}-?\d{5,})$/m,
      
      // Pattern like "INV434292"
      /\b(INV\d{5,})\b/i,
      
      // Pattern like "SIN704970"
      /\b([A-Z]{3}\d{6,})\b/,
      
      // Just a number after "Invoice" label
      /Invoice[^\d]*?(\d{5,})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const id = match[1].trim();
        
        // Filter out dates and invalid patterns
        if (!/^\d{1,2}[\/\-]\d{1,2}/.test(id) && // Not a date
            !/^(20|19)\d{2}$/.test(id) && // Not just a year
            id.length >= 4 && 
            id.length <= 30) {
          return id;
        }
      }
    }
    
    return '';
  }

  extractDates(text) {
    const result = { invoiceDate: '', dueDate: '' };

    // Look for "Invoice Date" followed by date
    const invDateMatch = text.match(/Invoice\s+Date\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (invDateMatch) {
      result.invoiceDate = this.normalizeDate(invDateMatch[1]);
    }

    // Look for "Order Date" as alternative
    if (!result.invoiceDate) {
      const orderDateMatch = text.match(/Order\s+Date\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (orderDateMatch) {
        result.invoiceDate = this.normalizeDate(orderDateMatch[1]);
      }
    }

    // Generic date pattern as fallback
    if (!result.invoiceDate) {
      const dateMatch = text.match(/Date[\s:]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (dateMatch) {
        result.invoiceDate = this.normalizeDate(dateMatch[1]);
      }
    }

    // Due date patterns
    const duePatterns = [
      /Due\s+Date[\s:]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /Payment\s+Due[\s:]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i
    ];

    for (const pattern of duePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.dueDate = this.normalizeDate(match[1]);
        break;
      }
    }

    return result;
  }

  extractTerms(text) {
    const patterns = [
      // "Charge-NET 30 DAYS" (Pacific Steel format)
      /(?:Method|Payment|Terms?)[\s:]+([A-Za-z-]+-?NET\s+\d+\s+DAYS?)/i,
      // Standard "NET 30" format
      /(NET\s*\d+(?:\s+DAYS?)?)/i,
      // "Terms: Net 30 days"
      /Terms?[\s:]+([A-Z][A-Za-z\s\d]+(?:receipt|days))/i,
      // "Due on receipt"
      /(Due\s+on\s+receipt)/i,
      // "Credit Card"
      /(Credit\s+Card)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return '';
  }

  /**
   * FIXED line item extraction - handles real invoice formats
   */
  extractLineItemsFixed(text) {
    console.log('🔍 Extracting line items...');
    const items = [];
    const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);

    // Pattern 1: Pacific Steel format
    // "10 EA 1/4" 60 X 120 P&O CQ heat# ... 66.5000 CW 3,394.82"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip headers and footers
      if (this.isHeaderOrFooter(line)) continue;
      
      // Match: starts with quantity and unit (EA, PCS, lb, LB, etc)
      const match = line.match(/^(\d+(?:\.\d+)?)\s+(EA|PCS|lb|LB|GAL|FT|PC)\s+(.+?)\s+(\d+)\s+([\d,.]+)\s+(\w+)\s+([\d,]+\.\d{2})$/i);
      
      if (match) {
        const [_, quantity, unit, description, weight, unitPrice, priceUnit, amount] = match;
        
        items.push({
          quantity: parseFloat(quantity),
          description: `${description.trim()} (${unit})`,
          unitPrice: this.parseMoney(unitPrice),
          amount: this.parseMoney(amount)
        });
        
        console.log(`  Found item: ${quantity} ${unit} ${description.substring(0, 30)}... = $${amount}`);
        continue;
      }
      
      // Simpler pattern: Quantity at start, description, then prices
      const qtyMatch = line.match(/^(\d+(?:\.\d+)?)\s+(?:EA|PCS|lb|LB|GAL|FT|PC)?\s+(.+?)\s+.*?([\d,]+\.?\d{2})\s*$/);
      
      if (qtyMatch) {
        const quantity = parseFloat(qtyMatch[1]);
        const description = qtyMatch[2].trim();
        
        // Find all dollar amounts in the line
        const amounts = line.match(/([\d,]+\.\d{2})/g) || [];
        
        if (amounts.length >= 1 && description.length > 5) {
          const unitPrice = amounts.length >= 2 ? this.parseMoney(amounts[amounts.length - 2]) : 0;
          const amount = this.parseMoney(amounts[amounts.length - 1]);
          
          items.push({
            quantity,
            description: description.substring(0, 200),
            unitPrice,
            amount
          });
          
          console.log(`  Found item: ${quantity} x ${description.substring(0, 40)}... = $${amount}`);
        }
      }
    }

    // Pattern 2: Description first, then quantity and prices on same/next line
    if (items.length === 0) {
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1] || '';
        
        // Look for product-like descriptions
        if (this.looksLikeDescription(line)) {
          const combined = line + ' ' + nextLine;
          
          const match = combined.match(/(\d+(?:\.\d+)?)\s+.*?([\d,]+\.?\d{2})\s+([\d,]+\.?\d{2})/);
          if (match) {
            const quantity = parseFloat(match[1]);
            const unitPrice = this.parseMoney(match[2]);
            const amount = this.parseMoney(match[3]);
            
            items.push({
              quantity,
              description: line.substring(0, 200),
              unitPrice,
              amount
            });
          }
        }
      }
    }

    // Pattern 3: Simple format with just description and amount
    if (items.length === 0) {
      for (const line of lines) {
        if (this.isHeaderOrFooter(line)) continue;
        
        // Line has a description and at least one dollar amount
        if (line.length > 10 && /([\d,]+\.\d{2})/.test(line)) {
          const amounts = line.match(/([\d,]+\.\d{2})/g);
          const descMatch = line.match(/^(.+?)\s+[\d,]/);
          
          if (amounts && descMatch) {
            items.push({
              quantity: 1,
              description: descMatch[1].trim(),
              unitPrice: this.parseMoney(amounts[0]),
              amount: this.parseMoney(amounts[amounts.length - 1])
            });
          }
        }
      }
    }

    console.log(`✓ Extracted ${items.length} line items`);
    return items;
  }

  looksLikeDescription(line) {
    if (!line || line.length < 5 || line.length > 300) return false;
    if (this.isHeaderOrFooter(line)) return false;
    
    // Has product-like words
    const productWords = /(?:sheet|primer|black|joint|ring|lease|surcharge|freight|service)/i;
    return productWords.test(line);
  }

  isHeaderOrFooter(line) {
    const lower = line.toLowerCase();
    const keywords = [
      'invoice', 'bill to', 'ship to', 'quantity', 'description', 
      'unit price', 'amount', 'total', 'subtotal', 'page', 'thank you',
      'terms', 'payment', 'please', 'customer', 'sold by', 'item number'
    ];
    return keywords.some(k => lower === k || lower.startsWith(k + ':'));
  }

  /**
   * IMPROVED total extraction
   */
  extractTotalImproved(text, lineItems) {
    // First try to find explicit total
    const patterns = [
      // "Total $3,431.58" (Pacific Steel format)
      /Total\s+\$?([\d,]+\.\d{2})/i,
      // "Total USD: $1,234.56"
      /Total\s+USD[\s:]+\$?([\d,]+\.\d{2})/i,
      // "Amount Due $1,234.56"
      /Amount\s+Due[\s:]+\$?([\d,]+\.\d{2})/i,
      // "TOTAL: 1234.56"
      /TOTAL[\s:]+\$?([\d,]+\.\d{2})/i,
      // "SubTotal" followed by "Total" - take the second one
      /Total\s+(?:Taxes|Tax)[\s:]+\$?[\d,]+\.\d{2}.*?Total[\s:]+\$?([\d,]+\.\d{2})/is
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = this.parseMoney(match[1]);
        if (amount > 0 && amount < 10000000) {
          return amount;
        }
      }
    }

    // Fallback: sum line items
    if (lineItems.length > 0) {
      const sum = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      if (sum > 0) return sum;
    }

    return 0;
  }

  extractComments(text) {
    const comments = [];
    
    // Look for PO numbers
    const poMatch = text.match(/(?:PO|Purchase Order|Customer PO)[\s#:]+([A-Z0-9-]+)/i);
    if (poMatch) comments.push(`PO: ${poMatch[1]}`);
    
    // Look for notes
    const noteMatch = text.match(/Note[s]?[\s:]+([^\n]{10,200})/i);
    if (noteMatch) comments.push(noteMatch[1].trim());
    
    return comments;
  }

  async parseXLSX(file) {
    if (!this.XLSX) throw new Error('XLSX library not loaded');
    
    const arrayBuffer = await file.arrayBuffer();
    const workbook = this.XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const text = this.XLSX.utils.sheet_to_csv(sheet);
    
    return this.intelligentExtract(text);
  }

  async parseCSV(file) {
    const text = await file.text();
    return this.intelligentExtract(text);
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
    
    const str = String(value).trim();
    
    // MM/DD/YYYY or MM/DD/YY
    const mdy = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdy) {
      let [_, month, day, year] = mdy;
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }
      return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return '';
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedInvoiceParser;
} else if (typeof window !== 'undefined') {
  window.InvoiceParser = EnhancedInvoiceParser;
  window.EnhancedInvoiceParser = EnhancedInvoiceParser;
}
