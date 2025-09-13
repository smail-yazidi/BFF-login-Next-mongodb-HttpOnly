import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .optional(),
  preferences: z.object({
    notifications: z.boolean().optional(),
    theme: z.enum(['light', 'dark']).optional()
  }).optional()
});

// Helper function to get user from session
async function getUserFromSession(sessionToken: string) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mydb');

  // Find valid session
  const session = await db.collection('sessions').findOne({
    token: sessionToken,
    expiresAt: { $gt: new Date() }
  });

  if (!session) {
    return null;
  }

  // Get user data
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(session.userId) },
    { projection: { password: 0 } } // Exclude password from response
  );

  return { user, session };
}

// GET - Get user profile
export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { 
          message: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        }, 
        { status: 401 }
      );
    }

    const result = await getUserFromSession(sessionToken);
    if (!result) {
      return NextResponse.json(
        { 
          message: 'Invalid or expired session',
          code: 'INVALID_SESSION'
        }, 
        { status: 401 }
      );
    }

    const { user } = result;

    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        preferences: user.preferences || { notifications: true, theme: 'light' }
      },
      code: 'PROFILE_RETRIEVED'
    });

  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }, 
      { status: 500 }
    );
  }
}

// PATCH - Update user profile
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { 
          message: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        }, 
        { status: 401 }
      );
    }

    const sessionResult = await getUserFromSession(sessionToken);
    if (!sessionResult) {
      return NextResponse.json(
        { 
          message: 'Invalid or expired session',
          code: 'INVALID_SESSION'
        }, 
        { status: 401 }
      );
    }

    const { user } = sessionResult;

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

    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        field: err.path.join('.'),
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

    const { name, currentPassword, newPassword, preferences } = validation.data;

    // Database connection
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mydb');

    const updateData: any = {
      updatedAt: new Date()
    };

    // Update name if provided
    if (name !== undefined) {
      updateData.name = name;
    }

    // Update preferences if provided
    if (preferences) {
      updateData.preferences = {
        ...user.preferences,
        ...preferences
      };
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { 
            message: 'Current password is required to change password',
            code: 'CURRENT_PASSWORD_REQUIRED'
          }, 
          { status: 400 }
        );
      }

      // Get user with password for verification
      const userWithPassword = await db.collection('users').findOne(
        { _id: new ObjectId(user._id) }
      );

      if (!userWithPassword) {
        return NextResponse.json(
          { 
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }, 
          { status: 404 }
        );
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password);
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { 
            message: 'Current password is incorrect',
            code: 'INVALID_CURRENT_PASSWORD'
          }, 
          { status: 400 }
        );
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
      updateData.password = hashedNewPassword;

      // Invalidate all other sessions except current one
      await db.collection('sessions').deleteMany({
        userId: new ObjectId(user._id),
        token: { $ne: sessionToken }
      });

      console.log(`Password changed for user: ${user.email} at ${new Date().toISOString()}`);
    }

    // Update user
    const updateResult = await db.collection('users').updateOne(
      { _id: new ObjectId(user._id) },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { 
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }, 
        { status: 404 }
      );
    }

    // Get updated user data (without password)
    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(user._id) },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      message: 'Profile updated successfully',
      code: 'PROFILE_UPDATED',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        emailVerified: updatedUser.emailVerified,
        createdAt: updatedUser.createdAt,
        lastLogin: updatedUser.lastLogin,
        preferences: updatedUser.preferences || { notifications: true, theme: 'light' }
      }
    });

  } catch (error) {
    console.error('Profile PATCH error:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }, 
      { status: 500 }
    );
  }
}

// DELETE - Delete user account
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { 
          message: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        }, 
        { status: 401 }
      );
    }

    const sessionResult = await getUserFromSession(sessionToken);
    if (!sessionResult) {
      return NextResponse.json(
        { 
          message: 'Invalid or expired session',
          code: 'INVALID_SESSION'
        }, 
        { status: 401 }
      );
    }

    const { user } = sessionResult;

    // Parse request body for password confirmation
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON format', code: 'INVALID_JSON' }, 
        { status: 400 }
      );
    }

    const { password: confirmPassword } = body;

    if (!confirmPassword) {
      return NextResponse.json(
        { 
          message: 'Password confirmation is required to delete account',
          code: 'PASSWORD_REQUIRED'
        }, 
        { status: 400 }
      );
    }

    // Database connection
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mydb');

    // Get user with password for verification
    const userWithPassword = await db.collection('users').findOne(
      { _id: new ObjectId(user._id) }
    );

    if (!userWithPassword) {
      return NextResponse.json(
        { 
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }, 
        { status: 404 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(confirmPassword, userWithPassword.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { 
          message: 'Password is incorrect',
          code: 'INVALID_PASSWORD'
        }, 
        { status: 400 }
      );
    }

    // Start transaction for data deletion
    const session = client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Delete all user sessions
        await db.collection('sessions').deleteMany(
          { userId: new ObjectId(user._id) },
          { session }
        );

        // Delete user account
        await db.collection('users').deleteOne(
          { _id: new ObjectId(user._id) },
          { session }
        );

        // You might want to delete other related data here
        // such as user posts, files, etc.
      });

      console.log(`Account deleted for user: ${user.email} at ${new Date().toISOString()}`);

    } finally {
      await session.endSession();
    }

    // Clear session cookie
    const response = NextResponse.json({
      message: 'Account deleted successfully',
      code: 'ACCOUNT_DELETED'
    });

    response.cookies.set({
      name: 'session',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // Expire immediately
    });

    return response;

  } catch (error) {
    console.error('Profile DELETE error:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }, 
      { status: 500 }
    );
  }
}