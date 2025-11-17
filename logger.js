/**
 * Centralized Logging System
 * Provides controlled logging with levels and the ability to disable debug output
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    // Set default log level (change to INFO or WARN for production)
    this.level = LOG_LEVELS.DEBUG;
    this.enableTimestamps = false;
  }

  setLevel(level) {
    if (typeof level === 'string') {
      this.level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    } else {
      this.level = level;
    }
  }

  enableProductionMode() {
    this.level = LOG_LEVELS.WARN;
  }

  enableDebugMode() {
    this.level = LOG_LEVELS.DEBUG;
  }

  _log(level, emoji, ...args) {
    if (level > this.level) return;

    const prefix = this.enableTimestamps ? `[${new Date().toISOString()}] ` : '';
    console.log(`${prefix}${emoji}`, ...args);
  }

  error(...args) {
    this._log(LOG_LEVELS.ERROR, '❌', ...args);
  }

  warn(...args) {
    this._log(LOG_LEVELS.WARN, '⚠️', ...args);
  }

  info(...args) {
    this._log(LOG_LEVELS.INFO, 'ℹ️', ...args);
  }

  debug(...args) {
    this._log(LOG_LEVELS.DEBUG, '🔍', ...args);
  }

  success(...args) {
    this._log(LOG_LEVELS.INFO, '✅', ...args);
  }

  // Specialized loggers for specific operations
  parsing(...args) {
    this._log(LOG_LEVELS.DEBUG, '📄', ...args);
  }

  ocr(...args) {
    this._log(LOG_LEVELS.INFO, '🤖', ...args);
  }

  loading(...args) {
    this._log(LOG_LEVELS.INFO, '📦', ...args);
  }
}

// Create singleton instance
const logger = new Logger();

// Export as default
export default logger;

// Also export individual methods for convenience
export const { error, warn, info, debug, success, parsing, ocr, loading } = logger;
