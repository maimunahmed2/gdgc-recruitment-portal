import { env } from '$env/dynamic/private';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';

import type { SimulatedEmail } from '../../types';
import { readEmails, writeEmails } from './db';

export type EmailDeliveryResult = {
	saved: true;
	sent: boolean;
	simulated: boolean;
	messageId?: string;
};

export function hasSmtpConfig(): boolean {
	return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

export async function sendRealEmail(
	to: string,
	subject: string,
	html: string
): Promise<Omit<EmailDeliveryResult, 'saved'>> {
	const host = env.SMTP_HOST?.trim();
	const port = env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) : 587;
	const secure = env.SMTP_SECURE === 'true';
	const user = env.SMTP_USER?.trim();
	const pass = env.SMTP_PASS?.trim();

	if (!host || !user || !pass) {
		console.info('[email] SMTP is not configured; saved email to the simulator inbox.', {
			to,
			subject
		});
		return { sent: false, simulated: true };
	}

	if (!Number.isFinite(port)) throw new Error('SMTP_PORT must be a valid number');

	const from = env.SMTP_FROM?.trim() || `"GDGC Recruitment Portal" <${user}>`;
	const transporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: { user, pass }
	});

	await transporter.verify();
	const info = await transporter.sendMail({ from, to, subject, html });

	if (!info.accepted?.length) {
		throw new Error(`SMTP server did not accept recipient ${to}`);
	}

	return {
		sent: true,
		simulated: false,
		messageId: info.messageId
	};
}

export async function sendEmail(simulatedEmail: SimulatedEmail): Promise<EmailDeliveryResult> {
	const emails = await readEmails();
	emails.unshift(simulatedEmail);
	await writeEmails(emails);

	const delivery = await sendRealEmail(
		simulatedEmail.to,
		simulatedEmail.subject,
		simulatedEmail.body
	);

	return { saved: true, ...delivery };
}

function shell(title: string, greeting: string, body: string): string {
	return `
		<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px">
			<h2 style="color:#4F46E5;text-align:center">${title}</h2>
			<p>${greeting}</p>
			${body}
			<hr style="border:0;border-top:1px solid #e0e0e0;margin:20px 0" />
			<p style="font-size:11px;text-align:center;color:#9CA3AF">GDGC Recruitment Committee © 2026</p>
		</div>
	`;
}

function codeBlock(code: string, tone: 'indigo' | 'amber' = 'indigo'): string {
	const colors = tone === 'amber'
		? 'background:#FEF3C7;border:1px solid #F59E0B;color:#92400E'
		: 'background:#F3F4F6;color:#1F2937';

	return `<div style="${colors};padding:15px;border-radius:8px;text-align:center;font-size:24px;font-weight:bold;letter-spacing:4px;margin:20px 0">${code}</div>`;
}

export function buildVerificationEmail(
	to: string,
	name: string,
	code: string,
	resent = false
): SimulatedEmail {
	return {
		id: `mail_${randomUUID()}`,
		to,
		subject: resent
			? 'GDGC Recruitment: Resend Verification Code'
			: 'GDGC Recruitment: Verify Your Email Address',
		body: shell(
			'GDGC Recruitment Portal',
			`Hi ${name},`,
			`<p>Use the following one-time password to verify your email address:</p>${codeBlock(code)}<p style="font-size:13px;color:#6B7280">This OTP is valid for 15 minutes.</p>`
		),
		timestamp: new Date().toISOString(),
		read: false
	};
}

export function buildTwoFactorEmail(to: string, name: string, code: string): SimulatedEmail {
	return {
		id: `mail_${randomUUID()}`,
		to,
		subject: 'GDGC Security: Your Two-Factor Authentication Code',
		body: shell(
			'GDGC Security Verification',
			`Hi ${name},`,
			`<p>Your account is protected by two-factor authentication. Use this code to sign in:</p>${codeBlock(code)}<p style="font-size:13px;color:#64748B">This code is valid for 10 minutes.</p>`
		),
		timestamp: new Date().toISOString(),
		read: false
	};
}

export function buildPasswordResetEmail(
	to: string,
	name: string,
	code: string,
	resetUrl: string
): SimulatedEmail {
	return {
		id: `mail_${randomUUID()}`,
		to,
		subject: 'GDGC Recruitment: Password Reset Request',
		body: shell(
			'GDGC Recruitment Portal',
			`Hi ${name},`,
			`<p>We received a request to reset your password.</p>${codeBlock(code, 'amber')}<p>You can also use the secure link below:</p><div style="text-align:center;margin:25px 0"><a href="${resetUrl}" style="background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:500;display:inline-block">Reset Password</a></div><p style="font-size:13px;color:#6B7280">This code is valid for 15 minutes.</p>`
		),
		timestamp: new Date().toISOString(),
		read: false
	};
}
