import { randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';

import type { ActivityLog } from '../../types';
import { readLogs, writeLogs } from './db';

function parseUserAgent(userAgent: string): string {
	let device = 'Desktop Device';
	let browser = 'Unknown Browser';

	if (/ipad/i.test(userAgent)) device = 'iPad';
	else if (/iphone/i.test(userAgent)) device = 'iPhone';
	else if (/android/i.test(userAgent)) device = 'Android Device';
	else if (/tablet/i.test(userAgent)) device = 'Tablet Device';
	else if (/mobile/i.test(userAgent)) device = 'Mobile Device';

	if (/edg|edge/i.test(userAgent)) browser = 'Edge';
	else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
	else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
	else if (/safari/i.test(userAgent)) browser = 'Safari';

	return `${browser} on ${device}`;
}

function getIp(event: RequestEvent): string {
	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0].trim();

	try {
		return event.getClientAddress();
	} catch {
		return '127.0.0.1';
	}
}

export async function logActivity(
	event: RequestEvent,
	userId: string,
	email: string,
	type: ActivityLog['type'],
	status: ActivityLog['status'],
	details?: string
): Promise<void> {
	const logs = await readLogs();
	const userAgent = event.request.headers.get('user-agent') ?? 'Unknown Device';

	logs.unshift({
		id: `log_${randomUUID()}`,
		userId,
		email,
		type,
		status,
		ip: getIp(event),
		userAgent: parseUserAgent(userAgent),
		timestamp: new Date().toISOString(),
		details
	});

	await writeLogs(logs);
}
