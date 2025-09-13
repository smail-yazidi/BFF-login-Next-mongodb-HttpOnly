import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import rateLimit from '@/lib/rate-limit';

// Validation schema
const registerSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
});

// Rate limiting: 5 registration attempts per IP per hour
const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500, // Max 500 unique tokens per interval
});

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';
    
    try {
      await limiter.check(5, ip); // 5 requests per hour per IP
    } catch {
      return NextResponse.json(
        { 
          message: 'Too many registration attempts. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        }, 
        { status: 429 }
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON format', code: 'INVALID_JSON' }, 
        { status: 400 }
      );
    }

    // Validate input
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        field: err.path[0],
        message: err.message
      }));
      
      return NextResponse.json(
        { 
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        }, 
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Database connection
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mydb');
    
    // Check for existing user
    const existingUser = await db.collection('users').findOne(
      { email },
      { projection: { _id: 1 } } // Only fetch _id to minimize data transfer
    );
    
    if (existingUser) {
      // Don't reveal if user exists for security reasons in production
      // But provide clear message for development
      const message = process.env.NODE_ENV === 'development' 
        ? 'An account with this email already exists'
        : 'If an account with this email exists, you will receive a confirmation email';
        
      return NextResponse.json(
        { 
          message,
          code: 'USER_EXISTS'
        }, 
        { status: 409 }
      );
    }

    // Hash password with salt rounds
    const saltRounds = 12; // Higher salt rounds for better security
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with additional fields
    const newUser = {
      email,
      password: hashedPassword,
      name: null,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      loginAttempts: 0,
      lockUntil: null,
      // Add user preferences
      preferences: {
        notifications: true,
        theme: 'light'
      }
    };

    const result = await db.collection('users').insertOne(newUser);

    // Log successful registration (without sensitive data)
    console.log(`New user registered: ${email} at ${new Date().toISOString()}`);

    // In production, you might want to send a verification email here
    // await sendVerificationEmail(email, result.insertedId);

    return NextResponse.json(
      { 
        message: 'Registration successful! Please check your email for verification.',
        userId: result.insertedId,
        code: 'REGISTRATION_SUCCESS'
      }, 
      { status: 201 }
    );

  } catch (error) {
    // Log error for monitoring
    console.error('Registration error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip: req.ip ?? req.headers.get('x-forwarded-for')
    });

    // Don't expose internal errors to client
    return NextResponse.json(
      { 
        message: 'Internal server error. Please try again later.',
        code: 'INTERNAL_ERROR'
      }, 
      { status: 500 }
    );
  }
}