# Remittance Reader

A client-side web application for automatically parsing and processing remittance payment files. Upload PDF, Excel, or CSV files to auto-fill payment information and invoice details.

![Remittance Reader Interface](https://img.shields.io/badge/status-beta-teal)

## 🌟 Features

- **Multi-Format Support**: Parse PDF, XLSX, XLS, and CSV files
- **Intelligent Extraction**: Automatically detects and extracts:
  - Customer/Payer name
  - Payment date
  - Invoice numbers
  - Payment amounts
  - Open balances
- **QuickBooks-Style Interface**: Clean, professional design inspired by accounting software
- **Real-Time Calculations**: Automatic totaling and credit calculations
- **Export Options**: Export to CSV or XLSX format
- **Drag & Drop**: Easy file upload via drag-and-drop
- **Completely Client-Side**: All processing happens in your browser - no server required
- **Privacy First**: Your files never leave your device

## 🚀 Quick Start

### Option 1: GitHub Pages (Recommended)

1. **Fork this repository** to your GitHub account
2. Go to **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Select branch: `main` (or `master`) and folder: `/ (root)`
5. Click **Save**
6. Your app will be live at: `https://your-username.github.io/remittance-reader/`

### Option 2: Run Locally

1. Clone the repository:
```bash
git clone https://github.com/your-username/remittance-reader.git
cd remittance-reader
```

2. Open `index.html` in your browser:
```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# On Windows
start index.html
```

Or use a local server:
```bash
# Python 3
python -m http.server 8000

# Node.js (with http-server)
npx http-server
```

Then visit `http://localhost:8000` in your browser.

## 📁 File Structure

```
remittance-reader/
├── index.html          # Main HTML structure
├── styles.css          # All styling
├── script.js           # Application logic
└── README.md          # This file
```

## 🎯 How to Use

### 1. Upload a File

**Supported formats:**
- **PDF**: Text-based remittance PDFs
- **Excel**: `.xlsx` or `.xls` spreadsheets
- **CSV**: Comma-separated value files

**Upload methods:**
- Click the "Autofill from file" button
- Drag and drop files into the upload area

### 2. Review & Edit

After upload, the app will:
- Extract payer information
- Parse invoice numbers and amounts
- Calculate totals automatically

You can manually:
- Edit any field
- Check/uncheck invoices to apply
- Adjust payment amounts
- Add notes in the memo field

### 3. Export or Print

- **Export CSV/XLSX**: Download the processed data
- **Print**: Print a formatted payment record
- **Record and close**: Save your work (displays confirmation)

## 🛠️ Configuration

### Currency Settings

Change the currency in the sidebar to format amounts correctly:
- USD (default)
- CAD
- EUR
- GBP

### Parsing Mode

Choose how to parse your files:
- **Auto-detect** (recommended): Automatically determines file type
- **PDF**: Force PDF text extraction
- **Spreadsheet**: Force Excel parsing
- **CSV**: Force CSV parsing

## 📊 File Format Requirements

### Excel/CSV Files

The app intelligently maps columns. It looks for headers like:

**Invoices:**
- `Invoice`, `Inv`, `Invoice #`, `Document`, `Doc #`, `Reference`

**Amounts:**
- `Amount`, `Paid`, `Payment`, `Apply`, `Applied`, `Total`

**Dates:**
- `Date`, `Payment Date`, `Remittance Date`

**Payer:**
- `Payer`, `Customer`, `Client`, `Company`, `From`

**Open Balance:**
- `Open`, `Balance`, `Open Balance`

### PDF Files

For best results, PDFs should contain:
- Clear text (not scanned images)
- Labeled fields like "Payer:", "Date:", "Invoice:"
- Amounts in standard currency format ($1,234.56)

## 🔧 Dependencies

All dependencies are loaded via CDN:

- **SheetJS (xlsx.js)** v0.20.3 - Excel file parsing
- **PDF.js** v4.5.136 - PDF text extraction
- **Google Fonts (Inter)** - UI typography

No build process or npm install required!

## 🌐 Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

All modern browsers with ES6+ support are compatible.

## 🔒 Privacy & Security

- **100% client-side**: All file processing happens in your browser
- **No data transmission**: Files are never uploaded to any server
- **No tracking**: No analytics or cookies
- **Local storage**: Nothing is saved to your device automatically

## 🎨 Customization

### Changing Colors

Edit `styles.css` and modify the CSS variables:

```css
:root {
  --bg: #f5f6fa;           /* Background */
  --panel: #ffffff;        /* Panel background */
  --ink: #393a3d;          /* Text color */
  --accent: #0077c5;       /* Primary accent */
  --good: #16a34a;         /* Success color */
  --border: #d9dcdf;       /* Border color */
}
```

### Adding Fields

1. Add HTML input in `index.html`
2. Add corresponding state in `script.js`
3. Update the `render()` function to sync the field

## 🐛 Troubleshooting

### "Parse failed" error

- **Check file format**: Ensure it's a valid PDF, XLSX, or CSV
- **Try different parsing mode**: Switch from auto-detect to specific format
- **Check browser console**: Open DevTools (F12) for detailed errors

### Invoice data not extracted

- **PDF files**: Must be text-based (not scanned images)
- **Spreadsheets**: Check column headers match expected formats
- **Manual entry**: You can always enter data manually after upload

### Amounts not calculating

- Ensure amounts are in valid currency format
- Check that invoices are checked (checkbox selected)
- Verify the "Amount Received" field has a value

## 📝 Development

Want to contribute or modify the code?

### Making Changes

1. Edit the files locally
2. Test in your browser
3. Commit changes to Git
4. Push to GitHub - GitHub Pages will auto-deploy

### Testing

Test with sample files:
- Create a CSV with columns: `Invoice, Amount, Date, Payer`
- Try a simple PDF with text like "Invoice: 1234, Amount: $500"
- Use the "Load sample" button for quick testing

## 📄 License

MIT License - feel free to use, modify, and distribute.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 💡 Tips

- **Batch Processing**: Process multiple remittances by exporting to XLSX for record-keeping
- **Keyboard Shortcuts**: Tab through fields for faster data entry
- **Print to PDF**: Use the Print button and "Save as PDF" for digital records
- **Templates**: Create Excel templates with correct headers for consistent uploads

## 📧 Support

- Create an issue on GitHub for bugs or feature requests
- Check existing issues before creating new ones
- Include browser version and file type when reporting issues

## 🎉 Acknowledgments

- Design inspired by QuickBooks and modern accounting software
- Built with vanilla JavaScript - no frameworks required
- Icons: Inline SVG for fast loading

---

**Made with ❤️ for accounting professionals and small business owners**
