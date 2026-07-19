import jwt from 'jsonwebtoken';
import { json, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const JWT_SECRET = env.JWT_SECRET || 'gdgc-recruitment-secret-key-2026';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  isVerified: boolean;
}

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export function createToken(user: AuthUser, expiresIn: string) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    },
    JWT_SECRET,
    { expiresIn }
  );
}

export function requireAuth(event: RequestEvent): { user: AuthUser } | { response: Response } {
  const authHeader = event.request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return {
      response: json({ error: 'Access token is required. Please login.' }, { status: 401 })
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return { user: decoded };
  } catch {
    return {
      response: json({ error: 'Session expired or invalid. Please login again.' }, { status: 403 })
    };
  }
}

export function requireAdmin(event: RequestEvent): { user: AuthUser } | { response: Response } {
  const auth = requireAuth(event);

  if ('response' in auth) return auth;

  if (auth.user.role !== 'admin') {
    return {
      response: json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 })
    };
  }

  return auth;
}

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
