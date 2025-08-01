// src/js/utils/errorHandler.js
import { showToast } from './ui.js';

/**
 * Global error handler configuration
 */
const errorConfig = {
  logToConsole: true,
  showUserNotification: true,
  reportToService: false, // Enable when Sentry is configured
};

/**
 * Error message mapping for user-friendly messages
 */
const errorMessages = {
  // Supabase Auth Errors
  'Invalid login credentials': 'Email or password is incorrect. Please try again.',
  'Email not confirmed': 'Please verify your email before logging in.',
  'User already registered': 'An account with this email already exists.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
  
  // Network Errors
  'NetworkError': 'Connection error. Please check your internet and try again.',
  'Failed to fetch': 'Unable to connect to our servers. Please try again.',
  
  // Cloudinary Errors
  'Upload preset not found': 'Upload configuration error. Please contact support.',
  'Resource not found': 'The requested file could not be found.',
  
  // Generic Errors
  'Unauthorized': 'You need to be logged in to perform this action.',
  'Forbidden': 'You don\'t have permission to perform this action.',
  'Not Found': 'The requested resource was not found.',
  'Server Error': 'Something went wrong on our end. Please try again later.',
};

/**
 * Main error handler function
 */
export function handleError(error, context = '') {
  // Log to console in development
  if (errorConfig.logToConsole) {
    console.error(`[Error${context ? ` in ${context}` : ''}]:`, error);
  }

  // Determine user-friendly message
  let userMessage = 'An unexpected error occurred. Please try again.';
  
  // Check for known error messages
  const errorString = error.message || error.toString();
  for (const [key, message] of Object.entries(errorMessages)) {
    if (errorString.includes(key)) {
      userMessage = message;
      break;
    }
  }
  
  // Special handling for specific error types
  if (error.status) {
    switch (error.status) {
      case 400:
        userMessage = errorMessages['Bad Request'] || 'Invalid request. Please check your input.';
        break;
      case 401:
        userMessage = errorMessages['Unauthorized'];
        break;
      case 403:
        userMessage = errorMessages['Forbidden'];
        break;
      case 404:
        userMessage = errorMessages['Not Found'];
        break;
      case 500:
      case 502:
      case 503:
        userMessage = errorMessages['Server Error'];
        break;
    }
  }

  // Show notification to user
  if (errorConfig.showUserNotification) {
    showToast(userMessage, 'error');
  }

  // Report to error tracking service (when configured)
  if (errorConfig.reportToService && window.Sentry) {
    window.Sentry.captureException(error, {
      extra: {
        context,
        userMessage,
      },
    });
  }

  return {
    error,
    userMessage,
    context,
  };
}

/**
 * Async function wrapper with error handling
 */
export function withErrorHandling(fn, context = '') {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      handleError(error, context);
      throw error; // Re-throw to allow caller to handle if needed
    }
  };
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, 'Unhandled Promise Rejection');
    event.preventDefault();
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    // Ignore script loading errors from external sources
    if (event.filename && !event.filename.includes(window.location.origin)) {
      return;
    }
    
    handleError(event.error || event, 'Global Error');
    event.preventDefault();
  });

  // Handle Supabase auth errors globally
  if (window.supabase) {
    const originalAuthError = window.supabase.auth.onAuthStateChange;
    window.supabase.auth.onAuthStateChange = function(callback) {
      return originalAuthError.call(this, (event, session) => {
        if (event === 'SIGNED_OUT' && session?.error) {
          handleError(session.error, 'Auth State Change');
        }
        return callback(event, session);
      });
    };
  }
}

/**
 * Network request wrapper with timeout
 */
export async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.');
    }
    throw error;
  }
}

/**
 * Retry logic for critical operations
 */
export async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Wait before retrying (with exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}