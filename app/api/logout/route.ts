import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      // Already logged out, but return success for idempotency
      const response = NextResponse.json({
        message: 'Logout successful',
        code: 'LOGOUT_SUCCESS'
      });

      // Clear cookie anyway
      response.cookies.set({
        name: 'session',
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0
      });

      return response;
    }

    // Database connection
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mydb');

    // Find and delete the session
    const session = await db.collection('sessions').findOne({ token: sessionToken });
    
    if (session) {
      await db.collection('sessions').deleteOne({ token: sessionToken });
      
      // Log logout
      console.log(`User logged out: Session ${sessionToken} at ${new Date().toISOString()}`);
    }

    // Create response
    const response = NextResponse.json({
      message: 'Logout successful',
      code: 'LOGOUT_SUCCESS'
    });

    // Clear session cookie
    response.cookies.set({
      name: 'session',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, we should clear the cookie
    const response = NextResponse.json(
      { 
        message: 'Logout completed with warnings',
        code: 'LOGOUT_WARNING'
      }, 
      { status: 200 } // Use 200 instead of 500 for logout
    );

    response.cookies.set({
      name: 'session',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });

    return response;
  }
}

// Optional: Add a GET endpoint to logout all sessions
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json({
        message: 'No active session found',
        code: 'NO_SESSION'
      }, { status: 400 });
    }

    // Database connection
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mydb');

    // Find current session to get user ID
    const currentSession = await db.collection('sessions').findOne({ token: sessionToken });
    
    if (!currentSession) {
      return NextResponse.json({
        message: 'Invalid session',
        code: 'INVALID_SESSION'
      }, { status: 401 });
    }

    // Delete all sessions for this user
    const deleteResult = await db.collection('sessions').deleteMany({
      userId: new ObjectId(currentSession.userId)
    });

    console.log(`Logged out from all devices: User ID ${currentSession.userId}, ${deleteResult.deletedCount} sessions deleted at ${new Date().toISOString()}`);

    // Create response
    const response = NextResponse.json({
      message: `Logout successful from all devices (${deleteResult.deletedCount} sessions)`,
      code: 'LOGOUT_ALL_SUCCESS',
      sessionsDeleted: deleteResult.deletedCount
    });

    // Clear session cookie
    response.cookies.set({
      name: 'session',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('Logout all error:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }, 
      { status: 500 }
    );
  }
}