/**
 * Data Persistence - Automatic saving to localStorage
 * Prevents data loss on page refresh or accidental navigation
 */

import logger from './logger.js';

const STORAGE_KEYS = {
  REMITTANCE_STATE: 'remittance_current_state',
  REMITTANCE_HISTORY: 'remittance_history',
  INVOICE_STATE: 'invoice_current_state',
  INVOICE_HISTORY: 'invoice_history',
  AUTO_SAVE_ENABLED: 'auto_save_enabled'
};

class DataPersistence {
  constructor() {
    this.autoSaveEnabled = this._getAutoSaveEnabled();
    this.saveDebounceTimer = null;
  }

  /**
   * Save current state (debounced to avoid excessive writes)
   */
  saveState(key, state, debounceMs = 1000) {
    if (!this.autoSaveEnabled) return;

    clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      try {
        const data = {
          ...state,
          _savedAt: new Date().toISOString(),
          _version: '1.0'
        };
        localStorage.setItem(key, JSON.stringify(data));
        logger.debug('State saved to localStorage');
      } catch (error) {
        logger.error('Failed to save state:', error);

        // Handle quota exceeded error
        if (error.name === 'QuotaExceededError') {
          this._handleQuotaExceeded();
        }
      }
    }, debounceMs);
  }

  /**
   * Load saved state
   */
  loadState(key) {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;

      const state = JSON.parse(data);
      logger.info('State loaded from localStorage', new Date(state._savedAt));
      return state;
    } catch (error) {
      logger.error('Failed to load state:', error);
      return null;
    }
  }

  /**
   * Clear saved state
   */
  clearState(key) {
    try {
      localStorage.removeItem(key);
      logger.info('State cleared');
    } catch (error) {
      logger.error('Failed to clear state:', error);
    }
  }

  /**
   * Save to history (for undo/redo or viewing past records)
   */
  saveToHistory(key, record) {
    try {
      const historyKey = key + '_history';
      const history = this.getHistory(historyKey) || [];

      // Add timestamp and ID
      const recordWithMeta = {
        ...record,
        _id: Date.now(),
        _savedAt: new Date().toISOString()
      };

      history.unshift(recordWithMeta);

      // Keep only last 50 records
      const trimmedHistory = history.slice(0, 50);

      localStorage.setItem(historyKey, JSON.stringify(trimmedHistory));
      logger.info('Record saved to history');

      return recordWithMeta._id;
    } catch (error) {
      logger.error('Failed to save to history:', error);

      if (error.name === 'QuotaExceededError') {
        this._handleQuotaExceeded();
      }
      return null;
    }
  }

  /**
   * Get history records
   */
  getHistory(key, limit = 50) {
    try {
      const data = localStorage.getItem(key);
      if (!data) return [];

      const history = JSON.parse(data);
      return history.slice(0, limit);
    } catch (error) {
      logger.error('Failed to load history:', error);
      return [];
    }
  }

  /**
   * Delete a record from history
   */
  deleteFromHistory(key, recordId) {
    try {
      const history = this.getHistory(key);
      const filtered = history.filter(r => r._id !== recordId);
      localStorage.setItem(key, JSON.stringify(filtered));
      logger.info('Record deleted from history');
    } catch (error) {
      logger.error('Failed to delete from history:', error);
    }
  }

  /**
   * Export all data as JSON
   */
  exportAllData() {
    const data = {
      remittanceState: this.loadState(STORAGE_KEYS.REMITTANCE_STATE),
      remittanceHistory: this.getHistory(STORAGE_KEYS.REMITTANCE_HISTORY),
      invoiceState: this.loadState(STORAGE_KEYS.INVOICE_STATE),
      invoiceHistory: this.getHistory(STORAGE_KEYS.INVOICE_HISTORY),
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import data from JSON
   */
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (data.remittanceState) {
        this.saveState(STORAGE_KEYS.REMITTANCE_STATE, data.remittanceState, 0);
      }
      if (data.remittanceHistory) {
        localStorage.setItem(STORAGE_KEYS.REMITTANCE_HISTORY, JSON.stringify(data.remittanceHistory));
      }
      if (data.invoiceState) {
        this.saveState(STORAGE_KEYS.INVOICE_STATE, data.invoiceState, 0);
      }
      if (data.invoiceHistory) {
        localStorage.setItem(STORAGE_KEYS.INVOICE_HISTORY, JSON.stringify(data.invoiceHistory));
      }

      logger.success('Data imported successfully');
      return true;
    } catch (error) {
      logger.error('Failed to import data:', error);
      return false;
    }
  }

  /**
   * Clear all stored data
   */
  clearAllData() {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      logger.info('All data cleared');
    } catch (error) {
      logger.error('Failed to clear all data:', error);
    }
  }

  /**
   * Get storage usage info
   */
  getStorageInfo() {
    let totalSize = 0;
    const details = {};

    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const item = localStorage.getItem(key);
      const size = item ? item.length : 0;
      details[name] = {
        size: size,
        sizeKB: (size / 1024).toFixed(2),
        exists: !!item
      };
      totalSize += size;
    });

    return {
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      details,
      // Estimate quota (usually 5-10MB per origin)
      estimatedQuota: 5 * 1024 * 1024,
      percentUsed: ((totalSize / (5 * 1024 * 1024)) * 100).toFixed(1)
    };
  }

  /**
   * Handle quota exceeded error
   */
  _handleQuotaExceeded() {
    logger.warn('localStorage quota exceeded, clearing old history');

    // Try to clear old history entries
    try {
      [STORAGE_KEYS.REMITTANCE_HISTORY, STORAGE_KEYS.INVOICE_HISTORY].forEach(key => {
        const history = this.getHistory(key);
        if (history.length > 10) {
          // Keep only the 10 most recent
          const trimmed = history.slice(0, 10);
          localStorage.setItem(key, JSON.stringify(trimmed));
          logger.info(`Trimmed ${key} history`);
        }
      });
    } catch (error) {
      logger.error('Failed to free up space:', error);
      alert('Storage is full. Please export your data and clear history.');
    }
  }

  /**
   * Enable/disable auto-save
   */
  setAutoSave(enabled) {
    this.autoSaveEnabled = enabled;
    localStorage.setItem(STORAGE_KEYS.AUTO_SAVE_ENABLED, enabled ? 'true' : 'false');
    logger.info('Auto-save ' + (enabled ? 'enabled' : 'disabled'));
  }

  /**
   * Check if auto-save is enabled
   */
  _getAutoSaveEnabled() {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE_ENABLED);
    return saved === null ? true : saved === 'true'; // Default to enabled
  }

  /**
   * Check if there's unsaved data
   */
  hasUnsavedData(key) {
    const state = this.loadState(key);
    if (!state) return false;

    // Check if saved within last 5 minutes
    const savedAt = new Date(state._savedAt);
    const now = new Date();
    const ageMinutes = (now - savedAt) / 1000 / 60;

    return ageMinutes < 5 && (state.invoices?.length > 0 || state.lineItems?.length > 0);
  }

  /**
   * Prompt user to restore unsaved data
   */
  promptRestoreData(key, restoreCallback) {
    if (!this.hasUnsavedData(key)) return;

    const state = this.loadState(key);
    const savedAt = new Date(state._savedAt).toLocaleString();
    const message = `You have unsaved data from ${savedAt}. Would you like to restore it?`;

    if (window.confirm(message)) {
      restoreCallback(state);
      logger.info('Restored previous session');
    } else {
      this.clearState(key);
    }
  }
}

// Create singleton instance
const dataPersistence = new DataPersistence();

// Export convenience functions
export function saveRemittanceState(state) {
  dataPersistence.saveState(STORAGE_KEYS.REMITTANCE_STATE, state);
}

export function loadRemittanceState() {
  return dataPersistence.loadState(STORAGE_KEYS.REMITTANCE_STATE);
}

export function saveInvoiceState(state) {
  dataPersistence.saveState(STORAGE_KEYS.INVOICE_STATE, state);
}

export function loadInvoiceState() {
  return dataPersistence.loadState(STORAGE_KEYS.INVOICE_STATE);
}

export function saveRemittanceRecord(record) {
  return dataPersistence.saveToHistory(STORAGE_KEYS.REMITTANCE_STATE, record);
}

export function saveInvoiceRecord(record) {
  return dataPersistence.saveToHistory(STORAGE_KEYS.INVOICE_STATE, record);
}

export default dataPersistence;
export { STORAGE_KEYS };
