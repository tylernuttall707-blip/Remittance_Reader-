/**
 * Invoice Parser
 * Extracts supplier invoices from PDF, XLSX, and CSV files
 * Captures: supplier name, invoice ID, dates, terms, line items, totals, comments
 */

class InvoiceParser {
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
        
        // Set worker source
        if (this.pdfjsLib.GlobalWorkerOptions) {
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
        }
        
        console.log('✅ PDF.js loaded successfully in InvoiceParser');
      } catch (error) {
        console.error('Failed to load PDF.js:', error);
      }
    }

    // Wait for XLSX library to load (it loads via script tag)
    if (!this.XLSX && typeof XLSX === 'undefined') {
      console.log('⏳ Waiting for XLSX library to load...');
      // Wait up to 5 seconds for XLSX to load
      const startTime = Date.now();
      while (typeof XLSX === 'undefined' && (Date.now() - startTime) < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Check for XLSX library
    if (typeof XLSX !== 'undefined') {
      this.XLSX = XLSX;
      console.log('✅ XLSX library available');
    } else {
      console.warn('⚠️ XLSX library not loaded - Excel/CSV files will not work');
    }
  }

  /**
   * Main entry point - parse any invoice file
   */
  async parseFile(file) {
    await this.init();

    const ext = this.getExtension(file.name);
    const fileType = this.detectFileType(file, ext);

    console.log(`Parsing invoice ${file.name} as ${fileType}`);

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
   * Parse PDF invoice
   */
  async parsePDF(file) {
    if (!this.pdfjsLib) {
      throw new Error('PDF.js library failed to load. Please check your internet connection and try again.');
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

    console.log('PDF text extracted (first 1000 chars):', fullText.substring(0, 1000));

    // Detect invoice format and parse
    const result = this.parseInvoiceText(fullText);
    return result;
  }

  /**
   * Parse invoice text (from PDF or other sources)
   */
  parseInvoiceText(text) {
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

    // Extract supplier name - prioritize company header over BILL TO
    const supplierPatterns = [
      // Pattern 1: Company name followed by INVOICE (Quality Plating format)
      /([A-Z][A-Za-z\s&,.''-]+(?:Inc\.|LLC|Corp\.|Co\.|Company|Corporation))\s+INVOICE/i,
      // Pattern 2: "Sold By:" followed by company name
      /Sold By:[\s\r\n]+([A-Z][A-Z\s&,.''-]+(?:#\d+|LLC|Inc\.|Corp\.|Co\.)?)[\s\r\n]/i,
      // Pattern 3: Company name at very top (first 300 chars)
      /^(.{0,300}?)([A-Z][A-Za-z\s&,.''-]+(?:Inc\.|LLC|Corp\.|Co\.|Company))[\s\r\n]/m,
      // Pattern 4: "FROM:" followed by company name
      /FROM:[\s\r\n]+([A-Z][A-Za-z\s&,.''-]+(?:LLC|Inc\.|Corp\.|Co\.)?)[\s\r\n]/i
    ];

    for (const pattern of supplierPatterns) {
      const match = text.match(pattern);
      if (match) {
        const supplier = (match[2] || match[1]).trim();
        // Skip BILL TO, SHIP TO, SOLD TO sections and footer text
        if (!/^(BILL TO|SHIP TO|SOLD TO|Artec)/i.test(supplier) && 
            !/(government|authorized|regulations|controlled)/i.test(supplier)) {
          result.supplier = supplier;
          break;
        }
      }
    }

    // Extract invoice number/ID
    const invoiceIdPatterns = [
      /INVOICE\s*#:?\s*([A-Z0-9-]+)/i,
      /Invoice\s*#:?\s*([A-Z0-9-]+)/i,
      /INVOICE\s*(?:NUMBER|NO\.?|ID)?:?\s*([A-Z0-9-]+)/i,
      /Invoice\s*Number:?\s*([A-Z0-9-]+)/i,
      /INV(?:OICE)?[-\s#]*:?\s*([A-Z0-9-]+)/i,
      /(?:No|#):?\s*\d+\s+([A-Z]{2,5}[-]?\d{4,})/,  // "No: 16 IV-612155" format
      /(?:^|\s)([A-Z]{2,5}[-]?\d{4,})(?=\s|$)/m  // Standalone like "IV-612155"
    ];

    for (const pattern of invoiceIdPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length >= 3) {  // At least 3 chars
        result.invoiceId = match[1].trim();
        break;
      }
    }

    // Extract invoice date
    const datePatterns = [
      /Date:?\s*(\d{1,2}[A-Za-z]{3}\d{2})/i,  // Date:02Oct25
      /INVOICE\s+DATE:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /DATE:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:Invoice Date|Dated?):?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.invoiceDate = this.normalizeDate(match[1]);
        break;
      }
    }

    // Extract due date - skip "Date of Release" field
    const duePatterns = [
      /Due:?\s*(\d{1,2}[A-Za-z]{3}\d{2})/i,  // Due:01Nov25
      /DUE\s+DATE:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /PLEASE PAY.*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /Payment Due:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ];

    for (const pattern of duePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1];
        // Skip if it's the "Date of Release" (typically an old date from 2009 or similar)
        const normalized = this.normalizeDate(dateStr);
        const year = normalized ? parseInt(normalized.split('-')[0]) : 0;
        
        // Only use if year is reasonable (2020+)
        if (year >= 2020) {
          result.dueDate = normalized;
          break;
        }
      }
    }

    // Extract net terms
    const termsPatterns = [
      /TERMS?:?\s*(NET\s*\d+(?:\s+DAYS)?|C\.?O\.?D\.?|Credit Card|Due (?:on|upon) receipt)/i,
      /PAYMENT\s+TERMS?:?\s*(NET\s*\d+(?:\s+DAYS)?|C\.?O\.?D\.?|Credit Card)/i,
      /(NET\s*\d+(?:\s+DAYS)?)/i,
      /(C\.?O\.?D\.?)/i
    ];

    for (const pattern of termsPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.netTerms = match[1].trim().toUpperCase();
        break;
      }
    }

    // Extract line items
    result.lineItems = this.extractLineItems(text);

    // Extract total amount
    const totalPatterns = [
      /TOTAL\s+(?:DUE|AMOUNT|INVOICE)?:?\s*\$?\s*([\d,]+\.\d{2})/i,
      /(?:PLEASE PAY|AMOUNT DUE):?\s*\$?\s*([\d,]+\.\d{2})/i,
      /(?:^|\s)TOTAL:?\s*\$?\s*([\d,]+\.\d{2})/im
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.totalAmount = this.parseMoney(match[1]);
        break;
      }
    }

    // Extract comments/notes
    result.comments = this.extractComments(text);

    // Generate description from line items if not set
    if (!result.description && result.lineItems.length > 0) {
      const firstItem = result.lineItems[0].description || '';
      result.description = firstItem.substring(0, 100);
    }

    return result;
  }

  /**
   * Extract line items from text
   */
  extractLineItems(text) {
    const lineItems = [];

    // Pattern 1: Affiliated Metals format (MATERIAL qty PCS @ price EA total)
    const pattern1 = /MATERIAL\s+(\d+(?:\.\d+)?)\s+PCS\s+@\s+([\d,]+\.?\d*)\s+EA\s+([\d,]+\.?\d*)/gi;
    let match;
    
    while ((match = pattern1.exec(text)) !== null) {
      const quantity = parseFloat(match[1]);
      const unitPrice = this.parseMoney(match[2]);
      const extPrice = this.parseMoney(match[3]);
      
      console.log('Affiliated Metals line item found:', {
        quantity,
        unitPrice,
        extPrice
      });
      
      // Try to find description on previous lines
      const beforeMatch = text.substring(Math.max(0, match.index - 300), match.index);
      const descMatch = beforeMatch.match(/\d+\s+([A-Z][A-Z\s\d.-]+?)(?:\s+\d+\s+PCS|\s+ASTM)/i);
      const description = descMatch ? descMatch[1].trim() : 'Material';
      
      lineItems.push({
        quantity: quantity,
        description: description,
        unitPrice: unitPrice,
        amount: extPrice
      });
    }

    console.log(`Pattern 1 (Affiliated Metals) found ${lineItems.length} line items`);

    // Pattern 2: Quality Plating table format (qty qty partno desc unitprice extprice)
    if (lineItems.length === 0) {
      // Match: 60 60 BB1051 Tone Rings 2.2000 /ea. $132.00
      const pattern2 = /(\d+)\s+\d+\s+([A-Z0-9]+)\s+([A-Za-z\s]+?)\s+([\d,]+\.?\d+)\s*\/ea\.\s+\$?([\d,]+\.?\d+)/gi;
      
      while ((match = pattern2.exec(text)) !== null) {
        const quantity = parseFloat(match[1]);
        const partNumber = match[2];
        const description = `${partNumber} ${match[3].trim()}`;
        const unitPrice = this.parseMoney(match[4]);
        const extPrice = this.parseMoney(match[5]);
        
        console.log('Quality Plating line item found:', {
          quantity,
          description,
          unitPrice,
          extPrice
        });
        
        lineItems.push({
          quantity: quantity,
          description: description,
          unitPrice: unitPrice,
          amount: extPrice
        });
      }
      
      console.log(`Pattern 2 (Quality Plating) found ${lineItems.length} line items`);
    }

    // Pattern 3: Standard quantity, description, unit price, extended price
    if (lineItems.length === 0) {
      const pattern3 = /(\d+(?:\.\d+)?)\s+([A-Z0-9][^\$\n]{10,80}?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})/gi;
      
      while ((match = pattern3.exec(text)) !== null) {
        const [_, quantity, description, unitPrice, extPrice] = match;
        
        // Skip SUBTOTAL and other summary lines
        if (/^(subtotal|total|tax|freight|shipping)/i.test(description.trim())) {
          continue;
        }
        
        lineItems.push({
          quantity: parseFloat(quantity),
          description: description.trim(),
          unitPrice: this.parseMoney(unitPrice),
          amount: this.parseMoney(extPrice)
        });
      }
      
      console.log(`Pattern 3 (Standard) found ${lineItems.length} line items`);
    }

    // Pattern 4: Item description with amount on same line
    if (lineItems.length === 0) {
      const pattern4 = /^[\s]*(.{15,100}?)\s+\$?([\d,]+\.\d{2})$/gm;
      
      while ((match = pattern4.exec(text)) !== null) {
        const [_, description, amount] = match;
        
        // Skip common non-item lines
        if (/^(subtotal|total|tax|freight|shipping|payment|balance)/i.test(description)) {
          continue;
        }
        
        lineItems.push({
          quantity: 1,
          description: description.trim(),
          unitPrice: this.parseMoney(amount),
          amount: this.parseMoney(amount)
        });
      }
      
      console.log(`Pattern 4 (Simple) found ${lineItems.length} line items`);
    }

    console.log('Final line items:', lineItems);
    return lineItems;
  }

  /**
   * Extract comments and special notes
   */
  extractComments(text) {
    const comments = [];

    // Look for common comment patterns
    const patterns = [
      /NOTE:?\s*([^\n]{20,200})/gi,
      /COMMENT:?\s*([^\n]{20,200})/gi,
      /MEMO:?\s*([^\n]{20,200})/gi,
      /SPECIAL INSTRUCTIONS?:?\s*([^\n]{20,200})/gi,
      /(?:ACH|WIRE|BANK)\s+(?:ROUTING|ACCOUNT)[^\n]{20,200}/gi,
      /HEAT\s+NUMBER:?\s*[\d]+/gi,
      /(?:PO|P\.O\.|PURCHASE ORDER)(?:\s+#)?:?\s*[\w-]+/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const comment = match[0].trim();
        if (comment.length > 10 && !comments.includes(comment)) {
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
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to text for parsing
    const text = this.XLSX.utils.sheet_to_csv(worksheet);
    
    return this.parseInvoiceText(text);
  }

  /**
   * Parse CSV file
   */
  async parseCSV(file) {
    const text = await file.text();
    return this.parseInvoiceText(text);
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
    
    // Try DDMmmYY format (e.g., "02Oct25")
    const monthMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    
    const ddmmmyy = str.match(/(\d{1,2})([A-Za-z]{3})(\d{2})/i);
    if (ddmmmyy) {
      const day = ddmmmyy[1].padStart(2, '0');
      const month = monthMap[ddmmmyy[2].toLowerCase()];
      let year = ddmmmyy[3];
      
      // Convert 2-digit year to 4-digit
      year = parseInt(year) > 50 ? '19' + year : '20' + year;
      
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }
    
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
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InvoiceParser;
} else if (typeof window !== 'undefined') {
  window.InvoiceParser = InvoiceParser;
}
