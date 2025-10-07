# Remittance Reader

A client-side web application for AI-assisted capture of remittance advice, invoices, and bills. Upload PDF, image, or email files to auto-fill payment information and invoice details—similar to the Intuit Assist experience inside QuickBooks.

![Remittance Reader Interface](https://img.shields.io/badge/status-beta-teal)

## 🌟 Features

- **AI Capture Flow**: Drag-and-drop documents and let the capture engine rebuild payment data automatically
- **Multi-Channel Input**: Works with PDF remittances, scanned images (OCR), or forwarded emails/text files
- **Intelligent Extraction**: Automatically detects and extracts:
  - Customer/Payer name
  - Payment date
  - Invoice numbers
  - Payment amounts
  - Open balances
- **QuickBooks-Style Interface**: Clean, professional design inspired by accounting software
- **Real-Time Calculations**: Automatic totaling and credit calculations
- **Category Suggestions**: Lightweight heuristics recommend possible expense categories based on document language
- **Export Options**: Export captured data to CSV for reconciliation
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
- **PDF**: Text-based or generated remittance PDFs
- **Images**: `.png`, `.jpg`, `.jpeg` (processed with OCR)
- **Email/Text**: `.eml`, `.msg`, `.txt` files for forwarded remittance emails

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

- **Export CSV**: Download the processed data
- **Print**: Print a formatted payment record
- **Record and close**: Save your work (displays confirmation)

## 🛠️ Configuration

### Currency Settings

Change the currency in the sidebar to format amounts correctly:
- USD (default)
- CAD
- EUR
- GBP

### Document Type Hint

Help the capture engine understand the document you uploaded:
- **Auto-detect** (recommended): Let the system decide
- **Customer invoice**: Prioritises customer-facing wording when extracting
- **Vendor bill**: Looks for supplier-style terminology
- **Receipt**: Collapses totals into a single captured line item when needed

## 📊 Capture Tips

### PDFs

- Text-based PDFs produce the cleanest results
- Include clear labels such as "Invoice", "Amount", "Total", and "Payment Date"
- Export remittance summaries straight from your accounting/banking portal when possible

### Images / Receipts

- Ensure the entire document is in frame with good lighting
- Higher contrast between text and background improves OCR accuracy
- Crop unrelated notes or scribbles before uploading

### Emails / Text Files

- Forward machine-generated remittance emails directly as `.eml`/`.msg`
- Keep the message body intact so the parser can understand vendor and totals

## 🔧 Dependencies

All dependencies are loaded via CDN:

- **PDF.js** v4.5.136 - PDF text extraction
- **Tesseract.js** v5 - OCR for images and scanned PDFs
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

### "Capture failed" error

- **Check file format**: Ensure it's a supported PDF, image, or email file
- **Try a different document hint**: Switch between invoice, bill, or receipt to guide extraction
- **Check browser console**: Open DevTools (F12) for detailed errors

### Invoice data not extracted

- **PDF files**: Text-based exports work best; scanned PDFs may need OCR via the image flow
- **Images**: Retake the photo with better lighting or higher resolution
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
- Export a remittance PDF from your accounting system
- Snap a photo of a receipt or bill with your phone and upload it
- Forward a vendor remittance email and save it as `.eml`
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

- **Batch Processing**: Capture documents one at a time, then merge CSV exports in your spreadsheet tool
- **Keyboard Shortcuts**: Tab through fields for faster data entry
- **Print to PDF**: Use the Print button and "Save as PDF" for digital records
- **Document hygiene**: Remove sticky notes or handwriting before scanning for better OCR results

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
