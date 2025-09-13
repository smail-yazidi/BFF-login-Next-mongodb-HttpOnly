import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import rateLimit from '@/lib/rate-limit';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
});

// Rate limiting: 10 login attempts per IP per 15 minutes
const limiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 500,
});

// Account lockout settings
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';
    
    try {
      await limiter.check(10, ip); // 10 requests per 15 minutes per IP
    } catch {
      return NextResponse.json(
        { 
          message: 'Too many login attempts. Please try again later.',
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

    const validation = loginSchema.safeParse(body);
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

    const { email, password, rememberMe } = validation.data;

    // Database connection
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mydb');

    // Find user
    const user = await db.collection('users').findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists for security
      return NextResponse.json(
        { 
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        }, 
        { status: 401 }
      );
    }

    // Check if account is locked
    const now = new Date();
    if (user.lockUntil && user.lockUntil > now) {
      const remainingTime = Math.ceil((user.lockUntil.getTime() - now.getTime()) / (1000 * 60));
      return NextResponse.json(
        { 
          message: `Account is locked. Try again in ${remainingTime} minutes.`,
          code: 'ACCOUNT_LOCKED',
          lockUntil: user.lockUntil
        }, 
        { status: 423 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      // Increment login attempts
      const loginAttempts = (user.loginAttempts || 0) + 1;
      const updateData: any = {
        loginAttempts,
        updatedAt: now
      };

      // Lock account if max attempts reached
      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockUntil = new Date(now.getTime() + LOCKOUT_DURATION);
        
        // Log security event
        console.warn(`Account locked for user: ${email} due to ${loginAttempts} failed login attempts at ${now.toISOString()}`);
      }

      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: updateData }
      );

      return NextResponse.json(
        { 
          message: loginAttempts >= MAX_LOGIN_ATTEMPTS 
            ? 'Too many failed attempts. Account has been locked.'
            : 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
          attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - loginAttempts)
        }, 
        { status: 401 }
      );
    }

    // Successful login - reset attempts and lock
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          lastLogin: now,
          updatedAt: now
        },
        $unset: {
          loginAttempts: "",
          lockUntil: ""
        }
      }
    );

    // Generate session token (use crypto.randomUUID or a more secure method)
    const sessionToken = crypto.randomUUID();
    const sessionExpiry = rememberMe 
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Create session
    await db.collection('sessions').insertOne({
      token: sessionToken,
      userId: user._id,
      createdAt: now,
      expiresAt: sessionExpiry,
      userAgent: req.headers.get('user-agent') || 'unknown',
      ip: ip,
      rememberMe
    });

    // Log successful login
    console.log(`Successful login: ${email} at ${now.toISOString()} from IP: ${ip}`);

    // Create response
    const response = NextResponse.json(
      { 
        message: 'Login successful',
        code: 'LOGIN_SUCCESS',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified
        }
      },
      { status: 200 }
    );

    // Set secure cookie
    const cookieOptions = {
      name: 'session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60 // seconds
    };

    response.cookies.set(cookieOptions);

    return response;

  } catch (error) {
    // Log error for monitoring
    console.error('Login error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip: req.ip ?? req.headers.get('x-forwarded-for')
    });

    return NextResponse.json(
      { 
        message: 'Internal server error. Please try again later.',
        code: 'INTERNAL_ERROR'
      }, 
      { status: 500 }
    );
  }
}