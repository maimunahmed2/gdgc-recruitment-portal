import { env } from '$env/dynamic/private';
import nodemailer from 'nodemailer';
import type { SimulatedEmail } from '../../types';
import { readEmails, writeEmails } from './db';

export function hasSmtpConfig() {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

export async function sendRealEmail(
	to: string,
	subject: string,
	html: string
): Promise<void> {
	const host = env.SMTP_HOST?.trim();
	const port = env.SMTP_PORT
		? Number.parseInt(env.SMTP_PORT, 10)
		: 587;

	const secure = env.SMTP_SECURE === 'true';
	const user = env.SMTP_USER?.trim();
	const pass = env.SMTP_PASS?.trim();

	if (!host || !user || !pass) {
		console.error('SMTP configuration is incomplete:', {
			hasHost: Boolean(host),
			hasUser: Boolean(user),
			hasPassword: Boolean(pass),
			port,
			secure
		});

		throw new Error(
			'SMTP environment variables are not fully configured'
		);
	}

	if (Number.isNaN(port)) {
		throw new Error('SMTP_PORT must be a valid number');
	}

	const from =
		env.SMTP_FROM?.trim() ||
		`"GDGC Recruitment Portal" <${user}>`;

	const transporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: {
			user,
			pass
		}
	});

	/*
	 * Keep this while debugging.
	 * It checks the SMTP connection and authentication without
	 * sending a message.
	 */
	await transporter.verify();

	console.log('SMTP connection verified successfully');

	const info = await transporter.sendMail({
		from,
		to,
		subject,
		html
	});

	console.log('SMTP send result:', {
		messageId: info.messageId,
		accepted: info.accepted,
		rejected: info.rejected,
		response: info.response
	});

	if (!info.accepted?.length) {
		throw new Error(
			`SMTP server did not accept the recipient: ${to}`
		);
	}

	if (info.rejected?.length) {
		console.warn('Rejected SMTP recipients:', info.rejected);
	}
}

export async function sendEmail(
	simulatedEmail: SimulatedEmail
): Promise<void> {
	const emails = await readEmails();

	if (!Array.isArray(emails)) {
		throw new Error(
			'readEmails() did not return an array'
		);
	}

	emails.unshift(simulatedEmail);
	await writeEmails(emails);

	// Wait until the SMTP operation completes.
	await sendRealEmail(
		simulatedEmail.to,
		simulatedEmail.subject,
		simulatedEmail.body
	);
}

export function buildVerificationEmail(to: string, name: string, code: string): SimulatedEmail {
  return {
    id: `mail_${Math.random().toString(36).substring(2, 11)}`,
    to,
    subject: 'GDGC Recruitment: Verify Your Email Address',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">GDGC Recruitment Portal</h2>
        <p>Hi ${name},</p>
        <p>Thank you for registering for the GDGC recruitment. Please use the following One-Time Password (OTP) to verify your email address:</p>
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1F2937; margin: 20px 0;">
          ${code}
        </div>
        <p style="font-size: 13px; color: #6B7280;">This OTP is valid for 15 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 11px; text-align: center; color: #9CA3AF;">GDGC Recruitment Committee © 2026</p>
      </div>
    `,
    timestamp: new Date().toISOString(),
    read: false
  };
}

export function buildTwoFactorEmail(to: string, name: string, code: string): SimulatedEmail {
  return {
    id: `mail_${Math.random().toString(36).substring(2, 11)}`,
    to,
    subject: 'GDGC Security: Your Two-Factor Authentication Code',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">GDGC Security Verification</h2>
        <p>Hi ${name},</p>
        <p>Your account is protected by Two-Factor Authentication. Please use the following One-Time Password (OTP) to log in:</p>
        <div style="background-color: #EEF2F6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1E293B; margin: 20px 0; border: 1px solid #E2E8F0;">
          ${code}
        </div>
        <p style="font-size: 13px; color: #64748B;">This code is valid for 10 minutes. If you did not request this, please secure your account immediately.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; text-align: center; color: #94A3B8;">GDGC Recruitment Security © 2026</p>
      </div>
    `,
    timestamp: new Date().toISOString(),
    read: false
  };
}

export function buildPasswordResetEmail(to: string, name: string, code: string, resetUrl: string): SimulatedEmail {
  return {
    id: `mail_${Math.random().toString(36).substring(2, 11)}`,
    to,
    subject: 'GDGC Recruitment: Password Reset Request',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">GDGC Recruitment Portal</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Use the following OTP code to proceed with resetting your password:</p>
        <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #92400E; margin: 20px 0;">
          ${code}
        </div>
        <p>Alternatively, you can click the link below to go directly to the reset password page with this code pre-filled:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Reset Password Directly</a>
        </div>
        <p style="font-size: 13px; color: #6B7280;">This code is valid for 15 minutes. If you did not request a password reset, please secure your account immediately.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 11px; text-align: center; color: #9CA3AF;">GDGC Recruitment Committee © 2026</p>
      </div>
    `,
    timestamp: new Date().toISOString(),
    read: false
  };
}
