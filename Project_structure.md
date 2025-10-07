# Project Structure

Your Remittance Reader project has been organized into separate files for easy maintenance and GitHub Pages deployment.

## 📁 File Overview

```
remittance-reader/
│
├── index.html          # Main HTML structure (7.2 KB)
│   └── Contains: Page layout, forms, tables, file upload UI
│
├── styles.css          # All styling (7.6 KB)
│   └── Contains: QuickBooks-style design, responsive layout, print styles
│
├── script.js           # Application logic (11 KB)
│   └── Contains: File parsing, state management, PDF/Excel processing
│
├── README.md           # Project documentation (7.1 KB)
│   └── Features, installation, usage guide, troubleshooting
│
├── DEPLOYMENT.md       # GitHub Pages setup guide (3.8 KB)
│   └── Step-by-step deployment instructions
│
├── LICENSE             # MIT License (1.1 KB)
│   └── Open source license for the project
│
└── .gitignore          # Git ignore rules (226 bytes)
    └── Excludes system files and temp files from git

Total: ~38 KB (uncompressed)
```

## 🎯 Key Features by File

### index.html
- Sidebar with file upload area
- Payment details form
- Invoice table with checkboxes
- Export/print buttons
- Drag-and-drop support

### styles.css
- CSS custom properties for easy theming
- QuickBooks-inspired color scheme
- Responsive grid layout
- Hover states and focus indicators
- Print-optimized styles
- Mobile-responsive design

### script.js
- PDF text extraction using PDF.js
- Excel/CSV parsing using SheetJS
- Smart column mapping (auto-detects headers)
- Currency formatting (USD, CAD, EUR, GBP)
- Real-time calculations
- Export to CSV/XLSX
- Sample data for testing

## 🔧 How Files Work Together

1. **index.html** loads:
   - Google Fonts (Inter)
   - SheetJS library (via CDN)
   - PDF.js library (via CDN)
   - styles.css
   - script.js

2. **styles.css** provides:
   - Visual design
   - Layout structure
   - Interactive states

3. **script.js** handles:
   - User interactions
   - File processing
   - Data management
   - Export functionality

## 📦 External Dependencies (CDN)

All loaded from CDNs - no npm install needed:

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700
https://cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js
https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs
```

## 🚀 Deployment Checklist

- [x] Separate HTML, CSS, JS files
- [x] All paths are relative (no absolute URLs)
- [x] External dependencies via CDN
- [x] No build process required
- [x] Works with GitHub Pages
- [x] README with documentation
- [x] Deployment guide included
- [x] MIT License included
- [x] .gitignore for clean commits

## 🎨 Customization Guide

### Change Colors
Edit `styles.css` lines 1-10 (CSS variables)

### Modify Layout
Edit `index.html` structure and `styles.css` grid properties

### Add Features
Edit `script.js` - all logic is modular and commented

### Update Parsing Logic
Edit `script.js` functions:
- `parseSheet()` for Excel/CSV
- `parsePDF()` for PDFs
- `mapHeader()` for column detection

## 📝 File Sizes Breakdown

| File | Size | Purpose |
|------|------|---------|
| index.html | 7.2 KB | Page structure |
| styles.css | 7.6 KB | All styling |
| script.js | 11 KB | All functionality |
| README.md | 7.1 KB | Documentation |
| DEPLOYMENT.md | 3.8 KB | Deployment guide |
| LICENSE | 1.1 KB | MIT License |
| .gitignore | 226 B | Git exclusions |
| **Total** | **~38 KB** | Full project |

## 🌟 Next Steps

1. **Test Locally**: Open `index.html` in your browser
2. **Upload to GitHub**: Follow instructions in `DEPLOYMENT.md`
3. **Enable GitHub Pages**: See deployment guide
4. **Customize**: Modify colors, add features, etc.
5. **Share**: Send your GitHub Pages URL to users

## 💡 Pro Tips

- All files must be in the same folder
- File names are case-sensitive on GitHub Pages
- Changes auto-deploy to GitHub Pages (1-2 min delay)
- Use browser DevTools (F12) for debugging
- Test with the "Load sample" button first

---

**Ready to deploy?** Follow the steps in `DEPLOYMENT.md`!
