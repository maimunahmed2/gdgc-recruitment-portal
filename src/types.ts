export type UserRole = 'user' | 'admin';

export type ActivityType =
	| 'register'
	| 'login'
	| 'logout'
	| 'email_verify_request'
	| 'email_verify_success'
	| 'password_reset_request'
	| 'password_reset_success'
	| 'password_change'
	| 'two_factor_toggle'
	| 'admin_delete';

export interface User {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	isVerified: boolean;
	createdAt: string;
	twoFactorEnabled?: boolean;
}

export interface UserWithPassword extends User {
	passwordHash: string;
	verificationCode?: string | null;
	verificationCodeExpires?: number | null;
	twoFactorCode?: string | null;
	twoFactorCodeExpires?: number | null;
	passwordResetCode?: string | null;
	passwordResetCodeExpires?: number | null;
}

export interface ActivityLog {
	id: string;
	userId: string;
	email: string;
	type: ActivityType;
	status: 'success' | 'failed';
	ip: string;
	userAgent: string;
	timestamp: string;
	details?: string;
}

export interface SimulatedEmail {
	id: string;
	to: string;
	subject: string;
	body: string;
	timestamp: string;
	read: boolean;
}
