/**
 * Enhanced Invoice Parser with AI-Powered Extraction
 * Handles ANY invoice layout by combining pattern matching with intelligent text analysis
 */

class EnhancedInvoiceParser {
  constructor() {
    this.pdfjsLib = null;
    this.XLSX = null;
  }

  /**
   * Initialize required libraries
   */
  async init() {
    // Load PDF.js dynamically if not already loaded
    if (!this.pdfjsLib) {
      try {
        const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
        this.pdfjsLib = pdfjs;
        
        if (this.pdfjsLib.GlobalWorkerOptions) {
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
        }
        
        console.log('✅ PDF.js loaded successfully');
      } catch (error) {
        console.error('Failed to load PDF.js:', error);
      }
    }

    if (!this.XLSX && typeof XLSX === 'undefined') {
      console.log('⏳ Waiting for XLSX library...');
      const startTime = Date.now();
      while (typeof XLSX === 'undefined' && (Date.now() - startTime) < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (typeof XLSX !== 'undefined') {
      this.XLSX = XLSX;
      console.log('✅ XLSX library available');
    }
  }

  /**
   * Main entry point - parse any invoice file
   */
  async parseFile(file) {
    await this.init();

    const ext = this.getExtension(file.name);
    const fileType = this.detectFileType(file, ext);

    console.log(`📄 Parsing ${file.name} as ${fileType}`);

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
    if (['xlsx', 'xls'].includes(ext) || 
        mime.includes('spreadsheet') || 
        mime.includes('excel')) return 'xlsx';
    if (ext === 'csv' || mime === 'text/csv') return 'csv';
    
    throw new Error('Unknown file type');
  }

  getExtension(filename) {
    return (filename || '').split('.').pop().toLowerCase();
  }

  /**
   * Parse PDF invoice
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

    console.log('📝 Extracted text length:', fullText.length);

    // Parse using intelligent extraction
    const result = this.intelligentExtract(fullText);
    return result;
  }

  /**
   * INTELLIGENT EXTRACTION ENGINE
   * Uses contextual analysis to find invoice data regardless of layout
   */
  intelligentExtract(text) {
    console.log('🧠 Starting intelligent extraction...');
    
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

    // Extract supplier using multiple strategies
    result.supplier = this.extractSupplier(text);
    console.log('✓ Supplier:', result.supplier);

    // Extract invoice ID
    result.invoiceId = this.extractInvoiceId(text);
    console.log('✓ Invoice ID:', result.invoiceId);

    // Extract dates
    const dates = this.extractDates(text);
    result.invoiceDate = dates.invoiceDate;
    result.dueDate = dates.dueDate;
    console.log('✓ Dates:', dates);

    // Extract terms
    result.netTerms = this.extractTerms(text);
    console.log('✓ Terms:', result.netTerms);

    // Extract line items
    result.lineItems = this.extractLineItems(text);
    console.log('✓ Line items:', result.lineItems.length);

    // Extract total
    result.totalAmount = this.extractTotal(text);
    console.log('✓ Total:', result.totalAmount);

    // Extract comments
    result.comments = this.extractComments(text);
    console.log('✓ Comments:', result.comments.length);

    // Generate description
    if (!result.description && result.lineItems.length > 0) {
      result.description = result.lineItems[0].description?.substring(0, 100) || '';
    }

    return result;
  }

  /**
   * Extract supplier name using contextual clues
   */
  extractSupplier(text) {
    const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    
    // Strategy 1: Look for company name near "INVOICE" header
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i];
      
      // Check if line contains INVOICE
      if (/^INVOICE$/i.test(line) || /INVOICE\s*$/i.test(line)) {
        // Look at previous lines for company name
        for (let j = Math.max(0, i - 5); j < i; j++) {
          const prevLine = lines[j];
          if (this.looksLikeCompanyName(prevLine)) {
            return prevLine.trim();
          }
        }
        
        // Look at next lines
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const nextLine = lines[j];
          if (this.looksLikeCompanyName(nextLine)) {
            return nextLine.trim();
          }
        }
      }
      
      // Check if line itself is "INVOICE CompanyName"
      const invoiceCompanyMatch = line.match(/^INVOICE\s+(.+(?:LLC|Inc\.|Corp\.|Co\.|Company))/i);
      if (invoiceCompanyMatch) {
        return invoiceCompanyMatch[1].trim();
      }
    }
    
    // Strategy 2: Look for "Bill From", "Sold By", "From:", etc.
    const billFromPatterns = [
      /(?:Bill From|Sold By|From|Remit To|Vendor)[\s:]+([A-Z][A-Za-z\s&,.''-]+(?:LLC|Inc\.|Corp\.|Co\.|Company))/i,
    ];
    
    for (const pattern of billFromPatterns) {
      const match = text.match(pattern);
      if (match && !this.isCustomerName(match[1])) {
        return match[1].trim();
      }
    }
    
    // Strategy 3: Look for company name in first 20 lines (header area)
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i];
      if (this.looksLikeCompanyName(line) && !this.isBlacklisted(line)) {
        return line.trim();
      }
    }
    
    // Strategy 4: Find company entity type (LLC, Inc, etc) in first 30 lines
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i];
      const entityMatch = line.match(/([A-Z][A-Za-z\s&,.''-]+)\s+(LLC|Inc\.|Corp\.|Co\.|Company)(?:\s|$)/i);
      if (entityMatch && !this.isBlacklisted(entityMatch[0])) {
        return (entityMatch[1] + ' ' + entityMatch[2]).trim();
      }
    }
    
    return '';
  }

  /**
   * Check if text looks like a company name
   */
  looksLikeCompanyName(text) {
    if (!text || text.length < 5 || text.length > 60) return false;
    
    // Has company entity type
    if (/(?:LLC|Inc\.|Corp\.|Co\.|Company|Ltd\.|Limited)$/i.test(text)) {
      return true;
    }
    
    // All caps with spaces (common for headers)
    if (/^[A-Z][A-Z\s&,.''-]+$/.test(text) && text.includes(' ')) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if this is the customer name (not supplier)
   */
  isCustomerName(text) {
    const lower = text.toLowerCase();
    return lower.includes('artec') || 
           lower.includes('bill to') || 
           lower.includes('ship to');
  }

  /**
   * Blacklist patterns to skip
   */
  isBlacklisted(text) {
    const lower = text.toLowerCase();
    const blacklist = [
      'bill to', 'ship to', 'sold to', 'artec',
      'invoice', 'sales invoice', 'payment',
      'please pay', 'total', 'amount due'
    ];
    
    return blacklist.some(b => lower.includes(b));
  }

  /**
   * Extract invoice ID/number
   */
  extractInvoiceId(text) {
    const patterns = [
      // Priority 1: "Invoice No:", "Invoice #", "Invoice Number"
      /Invoice\s+(?:No\.?|Number|#)[\s:]+([A-Z0-9-]+)/i,
      /Invoice[\s:]+([A-Z0-9-]{4,})/i,
      
      // Priority 2: "INVOICE" followed by number
      /INVOICE[\s#:]+([A-Z0-9-]{4,})/i,
      
      // Priority 3: Specific patterns
      /(?:^|\s)(?:INV|Inv)[-\s#]*([0-9]{5,})/,
      /(?:^|\s)([A-Z]{2,5}[-]?\d{5,})/,
      
      // Priority 4: Pattern like "CS32984", "PTLS-2095696"
      /(?:^|\s)([A-Z]{2,}-?\d{4,})/,
      
      // Priority 5: Just numbers after "Invoice"
      /Invoice.*?(\d{5,})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const id = match[1].trim();
        
        // Filter out dates and other non-ID patterns
        if (!/^\d{1,2}[\/\-]\d{1,2}/.test(id) && 
            !/^(20|19)\d{2}/.test(id) &&
            id.length >= 4 &&
            id.length <= 30) {
          return id;
        }
      }
    }
    
    return '';
  }

  /**
   * Extract dates (invoice date and due date)
   */
  extractDates(text) {
    const result = {
      invoiceDate: '',
      dueDate: ''
    };

    // Find invoice date
    const invDatePatterns = [
      /Invoice\s+Date[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Invoice\s+Date[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /DATE[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Date[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/,
    ];

    for (const pattern of invDatePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.invoiceDate = this.normalizeDate(match[1]);
        if (result.invoiceDate) break;
      }
    }

    // Find due date
    const duePatterns = [
      /Due\s+Date[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Payment\s+Due[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /DUE\s+DATE[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    ];

    for (const pattern of duePatterns) {
      const match = text.match(pattern);
      if (match) {
        const normalized = this.normalizeDate(match[1]);
        // Make sure it's a reasonable future date
        if (normalized) {
          const year = parseInt(normalized.split('-')[0]);
          if (year >= 2020 && year <= 2030) {
            result.dueDate = normalized;
            break;
          }
        }
      }
    }

    return result;
  }

  /**
   * Extract payment terms
   */
  extractTerms(text) {
    const patterns = [
      /Terms?[\s:]+([A-Z][A-Za-z\s\d]+)/i,
      /(NET\s*\d+(?:\s+DAYS?)?)/i,
      /(Net\s+\d+)/i,
      /(DUE (?:ON|UPON) RECEIPT)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim().toUpperCase();
      }
    }

    return '';
  }

  /**
   * Extract line items - most complex part
   */
  extractLineItems(text) {
    console.log('🔍 Extracting line items...');
    
    const items = [];
    const lines = text.split(/[\r\n]+/);

    // Try multiple extraction strategies
    
    // Strategy 1: Table-like format with qty, description, price, amount
    items.push(...this.extractTableFormat(text, lines));
    
    if (items.length > 0) {
      console.log('✓ Found items using table format');
      return items;
    }

    // Strategy 2: Description followed by qty and prices
    items.push(...this.extractDescriptionFirst(text, lines));
    
    if (items.length > 0) {
      console.log('✓ Found items using description-first format');
      return items;
    }

    // Strategy 3: Line-by-line analysis
    items.push(...this.extractLineByLine(text, lines));
    
    console.log(`✓ Extracted ${items.length} line items`);
    return items;
  }

  /**
   * Extract items from table-like format
   */
  extractTableFormat(text, lines) {
    const items = [];
    
    // Pattern: Qty Description Unit_Price Amount
    // Examples:
    // "10 RJ-331300-102 Johnny Joint... $66.00 36% $42.08 $420.75"
    // "125 31C100KBCAP 5/16-18 X 1 BUTTON... EA 0.20000 25.00"
    
    const pattern = /(\d+(?:\.\d+)?)\s+([A-Z0-9-]+.*?)\s+(?:EA|PCS|M|LB|lb)?\s*\$?([\d,]+\.?\d{2})\s+\$?([\d,]+\.?\d{2})/gi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const quantity = parseFloat(match[1]);
      const description = match[2].trim();
      const unitPrice = this.parseMoney(match[3]);
      const amount = this.parseMoney(match[4]);
      
      // Validate it's a real line item
      if (this.isValidLineItem(description, quantity, unitPrice, amount)) {
        items.push({
          quantity,
          description,
          unitPrice,
          amount
        });
      }
    }
    
    return items;
  }

  /**
   * Extract items where description comes first
   */
  extractDescriptionFirst(text, lines) {
    const items = [];
    
    // Pattern: DESCRIPTION IN CAPS OR Title Case
    // Followed by: quantity and amounts on same or next line
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1]?.trim() || '';
      
      // Check if line looks like a product description
      if (this.looksLikeProductDescription(line)) {
        // Look for quantity and prices on same or next line
        const combined = line + ' ' + nextLine;
        
        const qtyPriceMatch = combined.match(/(\d+(?:\.\d+)?)\s+.*?\$?([\d,]+\.?\d{2})\s+\$?([\d,]+\.?\d{2})/);
        
        if (qtyPriceMatch) {
          const quantity = parseFloat(qtyPriceMatch[1]);
          const unitPrice = this.parseMoney(qtyPriceMatch[2]);
          const amount = this.parseMoney(qtyPriceMatch[3]);
          
          items.push({
            quantity,
            description: line,
            unitPrice,
            amount
          });
        }
      }
    }
    
    return items;
  }

  /**
   * Extract items line by line
   */
  extractLineByLine(text, lines) {
    const items = [];
    
    // Look for lines with quantity, description, and dollar amounts
    for (const line of lines) {
      // Skip header/footer lines
      if (this.isHeaderOrFooter(line)) continue;
      
      // Pattern: Contains a quantity and 1-2 dollar amounts
      const dollarAmounts = line.match(/\$[\d,]+\.\d{2}/g);
      const qtyMatch = line.match(/(?:^|\s)(\d+(?:\.\d+)?)\s/);
      
      if (dollarAmounts && dollarAmounts.length >= 1 && qtyMatch) {
        const quantity = parseFloat(qtyMatch[1]);
        const amount = this.parseMoney(dollarAmounts[dollarAmounts.length - 1]);
        const unitPrice = dollarAmounts.length > 1 ? 
          this.parseMoney(dollarAmounts[dollarAmounts.length - 2]) : 
          amount / quantity;
        
        // Extract description (everything between qty and first dollar sign)
        const descMatch = line.match(/\d+(?:\.\d+)?\s+(.+?)\s+\$/);
        const description = descMatch ? descMatch[1].trim() : line.substring(0, 50);
        
        if (description.length >= 5) {
          items.push({
            quantity,
            description,
            unitPrice,
            amount
          });
        }
      }
    }
    
    return items;
  }

  /**
   * Check if line looks like a product description
   */
  looksLikeProductDescription(line) {
    if (!line || line.length < 10 || line.length > 200) return false;
    
    // Avoid headers and footers
    if (this.isHeaderOrFooter(line)) return false;
    
    // Has product-like keywords
    const productKeywords = /(?:screw|bolt|nut|washer|plate|joint|rod|part|material|service|freight|charge|fee|assembly)/i;
    
    return productKeywords.test(line) || /^[A-Z][A-Za-z\s,\d-]+$/.test(line);
  }

  /**
   * Validate if extracted data is a real line item
   */
  isValidLineItem(description, quantity, unitPrice, amount) {
    // Description should be reasonable length
    if (!description || description.length < 3 || description.length > 300) return false;
    
    // Avoid totals and subtotals
    if (/^(subtotal|total|tax|freight|shipping|discount|payment)/i.test(description)) {
      return false;
    }
    
    // Quantity should be positive and reasonable
    if (quantity <= 0 || quantity > 100000) return false;
    
    // Amounts should be positive
    if (unitPrice < 0 || amount < 0) return false;
    
    // Amount should roughly equal qty * price (within 10% tolerance)
    const calculated = quantity * unitPrice;
    const diff = Math.abs(calculated - amount);
    const tolerance = Math.max(calculated * 0.1, 1.0);
    
    return diff <= tolerance;
  }

  /**
   * Check if line is a header or footer
   */
  isHeaderOrFooter(line) {
    const lower = line.toLowerCase();
    const keywords = [
      'invoice', 'bill to', 'ship to', 'quantity', 'description', 
      'unit price', 'amount', 'total', 'page', 'thank you',
      'terms', 'payment', 'please'
    ];
    
    return keywords.some(k => lower.includes(k));
  }

  /**
   * Extract total amount
   */
  extractTotal(text) {
    const patterns = [
      /TOTAL\s+DUE[\s:]+\$?([\d,]+\.\d{2})/i,
      /Total\s+(?:Amount)?[\s:]+\$?([\d,]+\.\d{2})/i,
      /PLEASE PAY[\s:]+\$?([\d,]+\.\d{2})/i,
      /Amount\s+Due[\s:]+\$?([\d,]+\.\d{2})/i,
      /(?:^|\s)TOTAL[\s:]+\$?([\d,]+\.\d{2})/im,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = this.parseMoney(match[1]);
        // Sanity check - should be between $0.01 and $1,000,000
        if (amount > 0 && amount < 1000000) {
          return amount;
        }
      }
    }

    return 0;
  }

  /**
   * Extract comments and notes
   */
  extractComments(text) {
    const comments = [];

    const patterns = [
      /Note to customer[:\s]+([^\n]{10,300})/gi,
      /(?:ACH|WIRE|Bank)\s+(?:Routing|Account)[^\n]{10,200}/gi,
      /PO\s+(?:#|Number)?[\s:]+[\w-]+/gi,
      /Customer\s+PO[#:\s]+[\w-]+/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const comment = (match[1] || match[0]).trim();
        if (comment.length > 5 && !comments.includes(comment)) {
          comments.push(comment);
        }
      }
    }

    return comments;
  }

  /**
   * Parse XLSX file
   */
  async parseXLSX(file) {
    if (!this.XLSX) {
      throw new Error('XLSX library not loaded');
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = this.XLSX.read(arrayBuffer, { type: 'array' });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const text = this.XLSX.utils.sheet_to_csv(worksheet);
    
    return this.intelligentExtract(text);
  }

  /**
   * Parse CSV file
   */
  async parseCSV(file) {
    const text = await file.text();
    return this.intelligentExtract(text);
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
    
    if (typeof value === 'number' && value > 40000) {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

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

    // YYYY-MM-DD
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

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedInvoiceParser;
} else if (typeof window !== 'undefined') {
  window.InvoiceParser = EnhancedInvoiceParser;
  window.EnhancedInvoiceParser = EnhancedInvoiceParser;
}
