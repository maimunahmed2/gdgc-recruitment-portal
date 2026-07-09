import type { RequestEvent } from '@sveltejs/kit';
import type { ActivityLog } from '../../types';
import { readLogs, writeLogs } from './db';

function parseUserAgent(userAgentString: string) {
	let device = 'Desktop Device';
	let browser = 'Unknown Browser';

	if (/mobile/i.test(userAgentString)) device = 'Mobile Device';
	if (/tablet/i.test(userAgentString)) device = 'Tablet Device';
	if (/ipad/i.test(userAgentString)) device = 'iPad';
	if (/iphone/i.test(userAgentString)) device = 'iPhone';
	if (/android/i.test(userAgentString)) device = 'Android Device';

	if (/chrome|crios/i.test(userAgentString)) browser = 'Chrome';
	else if (/firefox|fxios/i.test(userAgentString)) browser = 'Firefox';
	else if (/safari/i.test(userAgentString)) browser = 'Safari';
	else if (/edge|edg/i.test(userAgentString)) browser = 'Edge';

	return `${browser} on ${device}`;
}

export function getRequestIp(event: RequestEvent) {
	const forwardedFor = event.request.headers.get('x-forwarded-for');

	if (forwardedFor) {
		return forwardedFor.split(',')[0].trim();
	}

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
) {
	const logs = await readLogs();
	const userAgentString = event.request.headers.get('user-agent') || 'Unknown Device';

	const newLog: ActivityLog = {
		id: `log_${Math.random().toString(36).substring(2, 11)}`,
		userId,
		email,
		type,
		status,
		ip: getRequestIp(event),
		userAgent: parseUserAgent(userAgentString),
		timestamp: new Date().toISOString(),
		details
	};

	logs.unshift(newLog);

	await writeLogs(logs);
}