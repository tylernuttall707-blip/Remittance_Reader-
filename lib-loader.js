/**
 * Library Loader - Manages external dependencies with proper async loading
 * Handles CDN failures with fallbacks and provides clear error messages
 */

class LibraryLoader {
  constructor() {
    this.loadedLibraries = new Set();
    this.loadingPromises = new Map();
  }

  /**
   * Load a library if not already loaded
   * @param {string} name - Library name (e.g., 'xlsx', 'tesseract')
   * @param {Object} config - Library configuration
   * @returns {Promise<Object>} The loaded library
   */
  async load(name, config) {
    // Check if already loaded
    if (this.loadedLibraries.has(name)) {
      return this.getLibrary(name);
    }

    // Check if currently loading
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name);
    }

    // Start loading
    const loadPromise = this._loadLibrary(name, config);
    this.loadingPromises.set(name, loadPromise);

    try {
      const lib = await loadPromise;
      this.loadedLibraries.add(name);
      this.loadingPromises.delete(name);
      return lib;
    } catch (error) {
      this.loadingPromises.delete(name);
      throw error;
    }
  }

  /**
   * Internal method to load a library
   */
  async _loadLibrary(name, config) {
    const { globalName, primaryCDN, fallbackCDN, timeout = 10000 } = config;

    // Check if already available globally
    if (globalName && typeof window[globalName] !== 'undefined') {
      console.log(`✅ ${name} already available`);
      return window[globalName];
    }

    // Try primary CDN
    try {
      console.log(`📦 Loading ${name} from primary CDN...`);
      const lib = await this._loadScript(primaryCDN, globalName, timeout);
      console.log(`✅ ${name} loaded successfully`);
      return lib;
    } catch (primaryError) {
      console.warn(`⚠️ Primary CDN failed for ${name}:`, primaryError.message);

      // Try fallback CDN if available
      if (fallbackCDN) {
        try {
          console.log(`📦 Trying fallback CDN for ${name}...`);
          const lib = await this._loadScript(fallbackCDN, globalName, timeout);
          console.log(`✅ ${name} loaded from fallback`);
          return lib;
        } catch (fallbackError) {
          throw new Error(
            `Failed to load ${name} from both CDNs.\n` +
            `Primary: ${primaryError.message}\n` +
            `Fallback: ${fallbackError.message}\n` +
            `Please check your internet connection or firewall settings.`
          );
        }
      }

      throw primaryError;
    }
  }

  /**
   * Load a script and wait for it to be available
   */
  _loadScript(url, globalName, timeout) {
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout loading from ${url}`));
      }, timeout);

      // Create script element
      const script = document.createElement('script');
      script.src = url;

      script.onload = () => {
        clearTimeout(timeoutId);

        // If no global name specified, assume it loaded successfully
        if (!globalName) {
          resolve(true);
          return;
        }

        // Wait a bit for global to be available
        const checkInterval = setInterval(() => {
          if (typeof window[globalName] !== 'undefined') {
            clearInterval(checkInterval);
            resolve(window[globalName]);
          }
        }, 50);

        // Give up after 2 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (typeof window[globalName] === 'undefined') {
            reject(new Error(`${globalName} not available after script loaded`));
          }
        }, 2000);
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Network error loading ${url}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Get a library that's already loaded
   */
  getLibrary(name) {
    const configs = {
      xlsx: { globalName: 'XLSX' },
      tesseract: { globalName: 'Tesseract' }
    };

    const config = configs[name];
    if (!config || !config.globalName) {
      return null;
    }

    return window[config.globalName];
  }

  /**
   * Check if a library is loaded
   */
  isLoaded(name) {
    return this.loadedLibraries.has(name);
  }
}

// Create singleton instance
const libraryLoader = new LibraryLoader();

// Library configurations
export const LIBRARY_CONFIGS = {
  xlsx: {
    globalName: 'XLSX',
    primaryCDN: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    fallbackCDN: 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
  },
  tesseract: {
    globalName: 'Tesseract',
    primaryCDN: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
    fallbackCDN: 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js'
  }
};

/**
 * Load XLSX library
 */
export async function loadXLSX() {
  return libraryLoader.load('xlsx', LIBRARY_CONFIGS.xlsx);
}

/**
 * Load Tesseract OCR library
 */
export async function loadTesseract() {
  return libraryLoader.load('tesseract', LIBRARY_CONFIGS.tesseract);
}

/**
 * Check if XLSX is loaded
 */
export function isXLSXLoaded() {
  return libraryLoader.isLoaded('xlsx') || typeof window.XLSX !== 'undefined';
}

/**
 * Check if Tesseract is loaded
 */
export function isTesseractLoaded() {
  return libraryLoader.isLoaded('tesseract') || typeof window.Tesseract !== 'undefined';
}

export default libraryLoader;
