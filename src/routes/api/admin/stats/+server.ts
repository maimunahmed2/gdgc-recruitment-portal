import { requireAdmin } from '$lib/server/auth';
import { readEmails, readLogs, readUsers, seedDatabase } from '$lib/server/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
  try {
    await seedDatabase();
    const auth = requireAdmin(event);
    if ('response' in auth) return auth.response;

    const users = await readUsers();
    const logs = await readLogs();
    const emails = readEmails();

    const totalUsers = users.length;
    const adminCount = users.filter((user) => user.role === 'admin').length;
    const verifiedUsers = users.filter((user) => user.isVerified).length;
    const mfaUsers = users.filter((user) => user.twoFactorEnabled).length;
    const successfulLogins = logs.filter((log) => log.type === 'login' && log.status === 'success').length;
    const failedLogins = logs.filter((log) => log.type === 'login' && log.status === 'failed').length;

    return json({
      stats: {
        totalUsers,
        adminCount,
        verifiedUsers,
        verifiedCount: verifiedUsers,
        mfaUsers,
        mfaCount: mfaUsers,
        totalLogins: successfulLogins,
        successfulLogins,
        failedLogins,
        totalEmailsSent: emails.length,
        totalActivityLogs: logs.length
      }
    });
  } catch {
    return json({ error: 'Server error retrieving stats' }, { status: 500 });
  }
};
