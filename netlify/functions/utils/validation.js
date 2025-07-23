// netlify/functions/utils/validation.js
// Comprehensive validation utilities for Tayvu Memorial Website

// Import required packages
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

// Custom error class for validation errors
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
    this.statusCode = 400;
  }
}

/**
 * Validation rules for different input types
 */
const ValidationRules = {
  email: {
    required: true,
    maxLength: 255,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    normalizer: (value) => value.toLowerCase().trim()
  },
  password: {
    required: true,
    minLength: 8,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Password must contain uppercase, lowercase, number, and special character'
  },
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-']+$/,
    sanitize: true
  },
  date: {
    required: true,
    validator: (value) => {
      const date = new Date(value);
      const minDate = new Date('1850-01-01');
      const maxDate = new Date();
      return date >= minDate && date <= maxDate;
    },
    message: 'Date must be between 1850 and today'
  },
  text: {
    maxLength: 5000,
    sanitize: true
  },
  richText: {
    maxLength: 50000,
    sanitize: true,
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'span'
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      span: ['style']
    }
  },
  privacy: {
    required: true,
    enum: ['public', 'unlisted', 'private']
  }
};

/**
 * Main validation class
 */
class Validator {
  constructor() {
    this.errors = {};
  }

  /**
   * Validate a single field
   */
  validateField(fieldName, value, rules) {
    const fieldRules = rules || ValidationRules[fieldName];
    if (!fieldRules) return value;

    // Check required
    if (fieldRules.required && !value) {
      throw new ValidationError(fieldName, `${fieldName} is required`);
    }

    // Skip further validation if empty and not required
    if (!value) return null;

    // Type conversion
    let processedValue = value;

    // Apply normalizer if exists
    if (fieldRules.normalizer) {
      processedValue = fieldRules.normalizer(processedValue);
    }

    // Length validation
    if (fieldRules.minLength && processedValue.length < fieldRules.minLength) {
      throw new ValidationError(
        fieldName,
        `${fieldName} must be at least ${fieldRules.minLength} characters`
      );
    }

    if (fieldRules.maxLength && processedValue.length > fieldRules.maxLength) {
      throw new ValidationError(
        fieldName,
        `${fieldName} must not exceed ${fieldRules.maxLength} characters`
      );
    }

    // Pattern validation
    if (fieldRules.pattern && !fieldRules.pattern.test(processedValue)) {
      throw new ValidationError(fieldName, fieldRules.message || `${fieldName} format is invalid`);
    }

    // Custom validator
    if (fieldRules.validator && !fieldRules.validator(processedValue)) {
      throw new ValidationError(fieldName, fieldRules.message || `${fieldName} is invalid`);
    }

    // Enum validation
    if (fieldRules.enum && !fieldRules.enum.includes(processedValue)) {
      throw new ValidationError(
        fieldName,
        `${fieldName} must be one of: ${fieldRules.enum.join(', ')}`
      );
    }

    // Sanitization
    if (fieldRules.sanitize) {
      if (fieldRules.allowedTags) {
        // Rich text sanitization
        processedValue = DOMPurify.sanitize(processedValue, {
          ALLOWED_TAGS: fieldRules.allowedTags,
          ALLOWED_ATTR: fieldRules.allowedAttributes || {},
          KEEP_CONTENT: true
        });
      } else {
        // Plain text sanitization
        processedValue = DOMPurify.sanitize(processedValue, {
          ALLOWED_TAGS: [],
          KEEP_CONTENT: true
        });
      }
    }

    return processedValue;
  }

  /**
   * Validate login credentials
   */
  validateLogin(data) {
    const validated = {};

    // Email validation
    validated.email = this.validateField('email', data.email);

    // Password validation (less strict for login)
    if (!data.password || data.password.length < 6) {
      throw new ValidationError('password', 'Invalid credentials');
    }
    validated.password = data.password;

    return validated;
  }

  /**
   * Validate signup data
   */
  validateSignup(data) {
    const validated = {};

    // Name validation
    validated.name = this.validateField('name', data.name);

    // Email validation
    validated.email = this.validateField('email', data.email);

    // Password validation
    validated.password = this.validateField('password', data.password);

    // Terms acceptance
    if (!data.acceptTerms) {
      throw new ValidationError('acceptTerms', 'You must accept the terms of service');
    }

    return validated;
  }

  /**
   * Rate limiting check (placeholder - implement with your service)
   */
  static async checkRateLimit(identifier, action, limit = 5, window = 300) {
    // This is a placeholder
    // In production, integrate with Redis or Upstash
    return true;
  }
}

// Export the classes and rules
module.exports = {
  Validator,
  ValidationError,
  ValidationRules
};
