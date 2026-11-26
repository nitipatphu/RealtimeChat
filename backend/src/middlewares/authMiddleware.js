import { getOne, query } from '../config/database.js';
import { hashToken, makeToken } from '../utils/id.js';

const SESSION_DAYS = 30;

export async function createSession(userId) {
  const token = makeToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), userId, expiresAt]);
  return token;
}

export async function deleteSession(token) {
  await query('DELETE FROM sessions WHERE token = $1', [hashToken(token)]);
}

export async function findSessionUser(token) {
  if (!token) return null;
  return getOne(
    `SELECT u.id, u.name, u.system_role, u.account_status
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
}

export function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

export const requireAuth = async (req, res, next) => {
  const token = readToken(req);
  const user = await findSessionUser(token);

  if (!user) {
    res.status(401);
    throw new Error('กรุณาเข้าสู่ระบบใหม่');
  }
  if (user.account_status !== 'active') {
    res.status(403);
    throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
  }

  req.userId = user.id;
  req.authUser = user;
  req.token = token;

  next();
};

export const requireSelf = (req, res, next) => {
  if (req.params.id !== req.userId) {
    res.status(403);
    throw new Error('ทำรายการนี้แทนผู้ใช้อื่นไม่ได้');
  }
  next();
};

const loginFails = {};

export function checkLoginLimit(key, res) {
  const item = loginFails[key];
  if (!item) return;
  if (Date.now() > item.resetAt) {
    delete loginFails[key];
    return;
  }
  if (item.count >= 5) {
    const minutes = Math.ceil((item.resetAt - Date.now()) / 60000);
    res.status(429);
    throw new Error('ลองผิดหลายครั้งเกินไป กรุณารอ ' + minutes + ' นาทีแล้วลองใหม่');
  }
}

export function addLoginFail(key) {
  const item = loginFails[key];
  if (!item || Date.now() > item.resetAt) {
    loginFails[key] = { count: 1, resetAt: Date.now() + 15 * 60 * 1000 };
  } else {
    item.count = item.count + 1;
  }
}

export function clearLoginFails(key) {
  delete loginFails[key];
}
