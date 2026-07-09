import { json, type RequestHandler } from '@sveltejs/kit';
import type { ActivityLog } from '$lib/types';
import { requireAdmin } from '$lib/server/auth';
import { getRequestIp } from '$lib/server/activity';
import { readLogs, readUsers, writeLogs, writeUsers } from '$lib/server/db';

export const DELETE: RequestHandler = async (event) => {
  try {
    const auth = requireAdmin(event);
    if ('response' in auth) return auth.response;

    const targetUserId = event.params.id;

    if (targetUserId === auth.user.id) {
      return json({ error: 'Self-deletion is forbidden. You cannot delete your own admin account.' }, { status: 400 });
    }

    const users = readUsers();
    const filteredUsers = users.filter((user) => user.id !== targetUserId);

    if (users.length === filteredUsers.length) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    writeUsers(filteredUsers);

    const logs = readLogs();
    const newLog: ActivityLog = {
      id: `log_${Math.random().toString(36).substring(2, 11)}`,
      userId: auth.user.id,
      email: auth.user.email,
      type: 'logout',
      status: 'success',
      ip: getRequestIp(event),
      userAgent: 'GDGC Portal System',
      timestamp: new Date().toISOString(),
      details: `Admin deleted user ID: ${targetUserId}`
    };

    logs.unshift(newLog);
    writeLogs(logs);

    return json({ message: 'User deleted successfully' });
  } catch {
    return json({ error: 'Server error deleting user' }, { status: 500 });
  }
};
