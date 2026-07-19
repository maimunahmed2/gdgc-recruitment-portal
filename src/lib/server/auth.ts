import { env } from '$env/dynamic/private';
import { json, type RequestEvent } from '@sveltejs/kit';
import jwt, { type SignOptions } from 'jsonwebtoken';

import type { UserWithPassword } from '../../types';

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export type TokenUser = {
	id: string;
	email: string;
	role: 'user' | 'admin';
	isVerified: boolean;
};

export type AuthResult =
	| { user: TokenUser }
	| { response: Response };

function getJwtSecret(): string {
	if (env.JWT_SECRET) return env.JWT_SECRET;
	if (env.NODE_ENV !== 'production') return 'gdgc-recruitment-secret-key-2026';
	throw new Error('JWT_SECRET is not configured');
}

export function normalizeEmail(value: unknown): string {
	return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
}

export function generateOtp(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

export function createAccessToken(user: UserWithPassword, rememberMe = false): string {
	const expiresIn: SignOptions['expiresIn'] = rememberMe ? '7d' : '1h';

	return jwt.sign(
		{
			id: user.id,
			email: user.email,
			role: user.role,
			isVerified: user.isVerified
		},
		getJwtSecret(),
		{ expiresIn }
	);
}

export function requireAuth(event: RequestEvent): AuthResult {
	const authorization = event.request.headers.get('authorization');
	const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

	if (!token) {
		return {
			response: json(
				{ error: 'Access token is required. Please login.' },
				{ status: 401 }
			)
		};
	}

	try {
		const decoded = jwt.verify(token, getJwtSecret()) as TokenUser;
		return { user: decoded };
	} catch {
		return {
			response: json(
				{ error: 'Session expired or invalid. Please login again.' },
				{ status: 403 }
			)
		};
	}
}

export function requireAdmin(event: RequestEvent): AuthResult {
	const auth = requireAuth(event);
	if ('response' in auth) return auth;

	if (auth.user.role !== 'admin') {
		return {
			response: json(
				{ error: 'Forbidden. Admin privileges required.' },
				{ status: 403 }
			)
		};
	}

	return auth;
}
