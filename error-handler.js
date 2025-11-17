/**
 * Error Handler - Provides user-friendly error messages
 * Translates technical errors into actionable guidance for users
 */

import logger from './logger.js';

/**
 * Custom error class with user-friendly messages
 */
export class UserFriendlyError extends Error {
  constructor(userMessage, technicalMessage, suggestions = []) {
    super(technicalMessage || userMessage);
    this.name = 'UserFriendlyError';
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
    this.suggestions = suggestions;
  }
}

/**
 * Error type categories
 */
export const ERROR_TYPES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  LIBRARY_LOAD_FAILED: 'LIBRARY_LOAD_FAILED',
  PARSE_FAILED: 'PARSE_FAILED',
  OCR_FAILED: 'OCR_FAILED',
  NO_DATA_FOUND: 'NO_DATA_FOUND',
  INVALID_DATA: 'INVALID_DATA',
  NETWORK_ERROR: 'NETWORK_ERROR'
};

/**
 * Error messages with actionable guidance
 */
const ERROR_MESSAGES = {
  [ERROR_TYPES.FILE_TOO_LARGE]: {
    message: 'File is too large to process',
    suggestions: [
      'Try compressing the file',
      'Split into multiple smaller files',
      'Maximum recommended size is 10MB'
    ]
  },
  [ERROR_TYPES.UNSUPPORTED_FILE]: {
    message: 'This file type is not supported',
    suggestions: [
      'Supported formats: PDF, XLSX, XLS, CSV',
      'Try converting your file to one of these formats',
      'Make sure the file extension matches the actual file type'
    ]
  },
  [ERROR_TYPES.LIBRARY_LOAD_FAILED]: {
    message: 'Failed to load required components',
    suggestions: [
      'Check your internet connection',
      'Disable browser extensions (especially ad blockers)',
      'Try refreshing the page',
      'If behind a firewall, contact your IT department'
    ]
  },
  [ERROR_TYPES.PARSE_FAILED]: {
    message: 'Could not extract data from this file',
    suggestions: [
      'Make sure the file is not corrupted',
      'Check if the file contains the expected data',
      'Try opening the file to verify it\'s valid',
      'For best results, use standard invoice/remittance formats'
    ]
  },
  [ERROR_TYPES.OCR_FAILED]: {
    message: 'Could not read text from scanned document',
    suggestions: [
      'Make sure the scan quality is clear and legible',
      'Try rescanning at a higher resolution (300 DPI or higher)',
      'Ensure text is not at an angle',
      'If possible, get a digital copy instead of a scan'
    ]
  },
  [ERROR_TYPES.NO_DATA_FOUND]: {
    message: 'No invoice or payment data found in the file',
    suggestions: [
      'Make sure you uploaded the correct file',
      'Verify the file contains invoice/remittance information',
      'File might be in an unusual format - try manual entry',
      'Check that text is selectable in PDF files'
    ]
  },
  [ERROR_TYPES.INVALID_DATA]: {
    message: 'The extracted data doesn\'t look right',
    suggestions: [
      'Please review and correct the values manually',
      'Common issues: dates, currency amounts, invoice numbers',
      'You can edit any field before saving'
    ]
  },
  [ERROR_TYPES.NETWORK_ERROR]: {
    message: 'Network connection issue',
    suggestions: [
      'Check your internet connection',
      'Try again in a few moments',
      'If problem persists, the service may be temporarily unavailable'
    ]
  }
};

/**
 * Convert technical errors into user-friendly errors
 */
export function handleError(error, context = {}) {
  logger.error('Error occurred:', error);

  // If already a user-friendly error, return it
  if (error instanceof UserFriendlyError) {
    return error;
  }

  // Detect error type from error message
  const errorMessage = error.message?.toLowerCase() || '';
  let errorType = null;

  if (errorMessage.includes('file') && errorMessage.includes('large')) {
    errorType = ERROR_TYPES.FILE_TOO_LARGE;
  } else if (errorMessage.includes('unsupported') || errorMessage.includes('unknown file type')) {
    errorType = ERROR_TYPES.UNSUPPORTED_FILE;
  } else if (errorMessage.includes('library') || errorMessage.includes('cdn') || errorMessage.includes('failed to load')) {
    errorType = ERROR_TYPES.LIBRARY_LOAD_FAILED;
  } else if (errorMessage.includes('ocr')) {
    errorType = ERROR_TYPES.OCR_FAILED;
  } else if (errorMessage.includes('no') && (errorMessage.includes('data') || errorMessage.includes('invoice'))) {
    errorType = ERROR_TYPES.NO_DATA_FOUND;
  } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    errorType = ERROR_TYPES.NETWORK_ERROR;
  } else {
    errorType = ERROR_TYPES.PARSE_FAILED;
  }

  const errorConfig = ERROR_MESSAGES[errorType];

  return new UserFriendlyError(
    errorConfig.message,
    error.message,
    errorConfig.suggestions
  );
}

/**
 * Format error for display to user
 */
export function formatErrorMessage(error) {
  const friendlyError = handleError(error);

  let message = `⚠️ ${friendlyError.userMessage}`;

  if (friendlyError.suggestions && friendlyError.suggestions.length > 0) {
    message += '\n\nWhat to try:\n';
    message += friendlyError.suggestions.map(s => `• ${s}`).join('\n');
  }

  return message;
}

/**
 * Display error to user in a modal or toast
 */
export function showError(error, toastElement) {
  const message = formatErrorMessage(error);

  if (toastElement) {
    // Use existing toast system
    toastElement.textContent = message;
    toastElement.classList.remove('hidden');
    toastElement.style.whiteSpace = 'pre-line'; // Preserve line breaks
    toastElement.style.maxWidth = '500px';
    toastElement.style.padding = '16px';

    // Keep visible longer for errors
    setTimeout(() => {
      toastElement.classList.add('hidden');
    }, 10000);
  } else {
    // Fallback to alert
    alert(message);
  }

  // Log technical details for debugging
  logger.error('Technical details:', error);
}

/**
 * Validate file before processing
 */
export function validateFile(file) {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv', 'png', 'jpg', 'jpeg'];
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/octet-stream' // Generic type sometimes used by email clients
  ];

  logger.debug('Validating file:', file.name, 'type:', file.type, 'size:', `${(file.size / 1024).toFixed(2)}KB`);

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new UserFriendlyError(
      'File is too large to process',
      `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum of 10MB`,
      [
        `Current file size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        'Maximum allowed: 10MB',
        'Try compressing the file or splitting it into smaller files'
      ]
    );
  }

  // Check file extension (if present)
  const hasExtension = file.name.includes('.');
  let extensionValid = false;

  if (hasExtension) {
    const extension = file.name.split('.').pop().toLowerCase();
    extensionValid = ALLOWED_EXTENSIONS.includes(extension);
    logger.debug('File extension:', extension, 'valid:', extensionValid);
  } else {
    logger.warn('File has no extension:', file.name);
  }

  // Check MIME type as fallback (important for email drag-drop)
  const mimeValid = file.type && ALLOWED_MIME_TYPES.includes(file.type);
  logger.debug('MIME type:', file.type, 'valid:', mimeValid);

  // Accept if either extension OR MIME type is valid
  if (!extensionValid && !mimeValid) {
    const extension = hasExtension ? file.name.split('.').pop().toLowerCase() : 'unknown';
    throw new UserFriendlyError(
      `File type "${extension}" is not supported`,
      `Unsupported file - extension: ${extension}, MIME: ${file.type}`,
      [
        'Supported formats: ' + ALLOWED_EXTENSIONS.join(', ').toUpperCase(),
        'Convert your file to a supported format',
        'Make sure the file is a valid PDF, Excel, or CSV file'
      ]
    );
  }

  // Log if we're accepting based on MIME type alone
  if (!extensionValid && mimeValid) {
    logger.info('File accepted based on MIME type despite missing/invalid extension');
  }

  // Sanitize filename to prevent potential issues
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (sanitizedName !== file.name) {
    logger.warn('Filename contains special characters:', file.name);
  }

  return true;
}

export default {
  handleError,
  formatErrorMessage,
  showError,
  validateFile,
  UserFriendlyError,
  ERROR_TYPES
};
