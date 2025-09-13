// lib/validation.ts
import { z } from 'zod';

// Email validation
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .max(255, 'Email too long')
  .refine(
    (email) => {
      // Additional email validation rules
      const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      const domain = email.split('@')[1];
      
      // Check for suspicious patterns
      if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
        return false;
      }
      
      return true;
    },
    {
      message: 'Invalid email format',
    }
  );

// Password validation with detailed requirements
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .refine(
    (password) => /[a-z]/.test(password),
    {
      message: 'Password must contain at least one lowercase letter',
    }
  )
  .refine(
    (password) => /[A-Z]/.test(password),
    {
      message: 'Password must contain at least one uppercase letter',
    }
  )
  .refine(
    (password) => /\d/.test(password),
    {
      message: 'Password must contain at least one number',
    }
  )
  .refine(
    (password) => /[@$!%*?&]/.test(password),
    {
      message: 'Password must contain at least one special character (@$!%*?&)',
    }
  )
  .refine(
    (password) => {
      // Check for common weak passwords
      const commonPasswords = [
        'password',
        '12345678',
        'qwerty123',
        'admin123',
        'letmein',
        'welcome123'
      ];
      return !commonPasswords.some(common => 
        password.toLowerCase().includes(common)
      );
    },
    {
      message: 'Password contains common patterns and is not secure',
    }
  );

// Name validation
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name too long')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .refine(
    (name) => {
      // Check for reasonable name format
      const trimmed = name.trim();
      return trimmed.length >= 2 && !trimmed.includes('  '); // No double spaces
    },
    {
      message: 'Please enter a valid name',
    }
  );

// IP address validation
export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Password strength checker
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} {
  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;
  else feedback.push('Consider using 12+ characters for better security');

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Add uppercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push('Add special characters');

  // Additional checks
  if (!/(.)\1{2,}/.test(password)) score += 1;
  else feedback.push('Avoid repeating characters');

  if (!/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    score += 1;
  } else {
    feedback.push('Avoid sequential characters');
  }

  const isStrong = score >= 6;

  return {
    score,
    feedback,
    isStrong
  };
}

// Rate limiting token generator
export function generateRateLimitToken(ip: string, userAgent?: string): string {
  // Combine IP and user agent for more granular rate limiting
  const baseToken = ip;
  if (userAgent) {
    // Use a hash of user agent to avoid storing full user agent
    const uaHash = userAgent.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `${baseToken}_${uaHash}`;
  }
  return baseToken;
}