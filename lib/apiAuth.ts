import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import { UserRole } from '@/models/User';
import { ZodError } from 'zod';

export interface AuthenticatedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  assignedWardId?: string;
  agencyId?: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

/**
 * Shared requireAuth helper enforcing valid session server-side
 */
export async function requireAuth(req?: Request): Promise<AuthenticatedUser> {
  // In test environment, allow passing test user context via headers for direct route handler testing
  if (process.env.NODE_ENV === 'test' && req) {
    const testUserId = req.headers.get('x-test-user-id');
    const testUserRole = (req.headers.get('x-test-user-role') || 'citizen') as UserRole;
    if (testUserId) {
      return {
        id: testUserId,
        email: req.headers.get('x-test-user-email') || 'test@demo.jaago.app',
        name: 'Test Runner User',
        role: testUserRole,
      };
    }
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AuthError('Authentication required. Please sign in.', 401);
  }
  return session.user as AuthenticatedUser;
}

/**
 * Shared requireRole helper enforcing strict role-based access control server-side
 */
export async function requireRole(allowedRoles: UserRole[], req?: Request): Promise<AuthenticatedUser> {
  const user = await requireAuth(req);
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(
      `Forbidden: Access restricted to roles: [${allowedRoles.join(', ')}]. Current role: '${user.role}'.`,
      403
    );
  }
  return user;
}

/**
 * Standard error formatter for API routes (catches AuthError, ZodError, and general errors)
 */
export function formatApiError(error: any) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    const errorDetails = error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: errorDetails,
        message: errorDetails[0]?.message || 'Invalid input data',
      },
      { status: 400 }
    );
  }

  console.error('[API Handler Error]:', error);
  return NextResponse.json(
    { error: error.message || 'Internal server error' },
    { status: error.status || 500 }
  );
}
