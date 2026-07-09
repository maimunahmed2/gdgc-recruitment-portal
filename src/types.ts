/**
 * Shared Type Definitions for Secure Authentication System
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  createdAt: string;
  twoFactorEnabled?: boolean;
}

export interface UserWithPassword extends User {
  passwordHash: string;
  verificationCode?: string | null;
  verificationCodeExpires?: number | null;
  passwordResetCode?: string | null;
  passwordResetCodeExpires?: number | null;
  twoFactorCode?: string | null;
  twoFactorCodeExpires?: number | null;
}

export interface ActivityLog {
  id: string;
  userId: string;
  email: string;
  type:
    | 'login'
    | 'logout'
    | 'register'
    | 'password_reset_request'
    | 'password_reset_success'
    | 'email_verify_request'
    | 'email_verify_success'
    | 'password_change'
    | 'two_factor_toggle';
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

export interface AuthResponse {
  user: User;
  token: string;
}