/**
 * UI Utilities - Loading indicators, progress bars, and user feedback
 */

/**
 * Loading Indicator Manager
 */
class LoadingIndicator {
  constructor() {
    this.overlay = null;
    this.progressBar = null;
    this.statusText = null;
  }

  /**
   * Create and show loading overlay
   */
  show(message = 'Processing...') {
    // Create overlay if it doesn't exist
    if (!this.overlay) {
      this._createOverlay();
    }

    this.statusText.textContent = message;
    this.overlay.classList.remove('hidden');
    this.overlay.style.display = 'flex';
  }

  /**
   * Hide loading overlay
   */
  hide() {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
      setTimeout(() => {
        this.overlay.style.display = 'none';
      }, 300); // Allow fade out animation
    }
  }

  /**
   * Update progress (0-100)
   */
  updateProgress(percent, message) {
    if (this.progressBar) {
      this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (message && this.statusText) {
      this.statusText.textContent = message;
    }
  }

  /**
   * Create overlay HTML
   */
  _createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'loading-overlay hidden';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(2px);
    `;

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      text-align: center;
      min-width: 300px;
    `;

    // Spinning animation
    const spinnerIcon = document.createElement('div');
    spinnerIcon.style.cssText = `
      width: 48px;
      height: 48px;
      border: 4px solid #e5e7eb;
      border-top-color: #0077c5;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    `;

    // Add keyframe animation
    if (!document.getElementById('spinner-keyframes')) {
      const style = document.createElement('style');
      style.id = 'spinner-keyframes';
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    this.statusText = document.createElement('div');
    this.statusText.style.cssText = `
      font-size: 16px;
      font-weight: 500;
      color: #1f2937;
      margin-bottom: 12px;
    `;

    // Progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 100%;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 16px;
    `;

    this.progressBar = document.createElement('div');
    this.progressBar.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #0077c5, #0095ff);
      border-radius: 4px;
      transition: width 0.3s ease;
    `;

    progressContainer.appendChild(this.progressBar);
    spinner.appendChild(spinnerIcon);
    spinner.appendChild(this.statusText);
    spinner.appendChild(progressContainer);
    this.overlay.appendChild(spinner);
    document.body.appendChild(this.overlay);
  }
}

// Create singleton instance
const loadingIndicator = new LoadingIndicator();

/**
 * Toast notification with better styling
 */
export function toast(message, type = 'info', duration = 3000) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) {
    console.warn('Toast element not found');
    return;
  }

  // Add type-specific styling
  toastEl.className = 'toast';
  toastEl.classList.remove('hidden', 'error', 'success', 'warning', 'info');
  toastEl.classList.add(type);

  // Set appropriate icon
  const icons = {
    error: '❌',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const icon = icons[type] || icons.info;
  toastEl.textContent = `${icon} ${message}`;

  // Show toast
  toastEl.classList.remove('hidden');

  // Hide after duration
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, duration);
}

/**
 * Show confirmation dialog
 */
export function confirm(message, title = 'Confirm') {
  return new Promise((resolve) => {
    // For now, use native confirm
    // TODO: Create custom modal
    const result = window.confirm(`${title}\n\n${message}`);
    resolve(result);
  });
}

/**
 * Data validation feedback
 */
export function showValidationError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  // Add error styling
  field.style.borderColor = '#dc2626';
  field.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';

  // Show error message
  let errorMsg = field.parentElement.querySelector('.validation-error');
  if (!errorMsg) {
    errorMsg = document.createElement('div');
    errorMsg.className = 'validation-error';
    errorMsg.style.cssText = `
      color: #dc2626;
      font-size: 12px;
      margin-top: 4px;
    `;
    field.parentElement.appendChild(errorMsg);
  }

  errorMsg.textContent = message;

  // Clear error on input
  field.addEventListener('input', function clearError() {
    field.style.borderColor = '';
    field.style.boxShadow = '';
    if (errorMsg) errorMsg.remove();
    field.removeEventListener('input', clearError);
  }, { once: true });
}

/**
 * Clear all validation errors
 */
export function clearValidationErrors() {
  document.querySelectorAll('.validation-error').forEach(el => el.remove());
  document.querySelectorAll('[style*="border-color"]').forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });
}

export default {
  loading: loadingIndicator,
  toast,
  confirm,
  showValidationError,
  clearValidationErrors
};
