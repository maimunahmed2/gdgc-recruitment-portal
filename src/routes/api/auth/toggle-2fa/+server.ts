import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { readUsers, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
  try {
    const auth = requireAuth(event);
    if ('response' in auth) return auth.response;

    const users = readUsers();
    const userIndex = users.findIndex((user) => user.id === auth.user.id);

    if (userIndex === -1) return json({ error: 'User not found' }, { status: 404 });

    const user = users[userIndex];
    user.twoFactorEnabled = !user.twoFactorEnabled;
    users[userIndex] = user;
    writeUsers(users);

    logActivity(event, user.id, user.email, 'two_factor_toggle', 'success', `Two-Factor Authentication toggled ${user.twoFactorEnabled ? 'ON' : 'OFF'}`);

    return json({
      message: `Two-Factor Authentication has been ${user.twoFactorEnabled ? 'enabled' : 'disabled'}.`,
      twoFactorEnabled: user.twoFactorEnabled
    });
  } catch {
    return json({ error: 'Server error toggling 2FA' }, { status: 500 });
  }
};
