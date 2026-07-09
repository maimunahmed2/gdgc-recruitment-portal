import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type { ActivityLog, SimulatedEmail, User, UserWithPassword } from '$lib/types';

const DB_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const LOGS_FILE = path.join(DB_DIR, 'logs.json');
const EMAILS_FILE = path.join(DB_DIR, 'emails.json');

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  ensureDbDir();

  if (!fs.existsSync(filePath)) return fallback;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T) {
  ensureDbDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function readUsers(): UserWithPassword[] {
  return readJsonFile<UserWithPassword[]>(USERS_FILE, []);
}

export function writeUsers(users: UserWithPassword[]) {
  writeJsonFile(USERS_FILE, users);
}

export function readLogs(): ActivityLog[] {
  return readJsonFile<ActivityLog[]>(LOGS_FILE, []);
}

export function writeLogs(logs: ActivityLog[]) {
  writeJsonFile(LOGS_FILE, logs);
}

export function readEmails(): SimulatedEmail[] {
  return readJsonFile<SimulatedEmail[]>(EMAILS_FILE, []);
}

export function writeEmails(emails: SimulatedEmail[]) {
  writeJsonFile(EMAILS_FILE, emails);
}

export function toSafeUser(user: UserWithPassword): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    twoFactorEnabled: !!user.twoFactorEnabled
  };
}

export function seedDatabase() {
  const users = readUsers();

  if (users.length > 0) return;

  const demoUser: UserWithPassword = {
    id: 'usr_demo_user',
    name: 'Alex Recruitment',
    email: 'user@gdgc.edu',
    role: 'user',
    isVerified: true,
    createdAt: new Date().toISOString(),
    passwordHash: bcrypt.hashSync('UserPass123!', 10)
  };

  const demoAdmin: UserWithPassword = {
    id: 'usr_demo_admin',
    name: 'GDGC Admin',
    email: 'admin@gdgc.edu',
    role: 'admin',
    isVerified: true,
    createdAt: new Date().toISOString(),
    passwordHash: bcrypt.hashSync('AdminPass123!', 10)
  };

  writeUsers([demoUser, demoAdmin]);
}
