import { getOne, getMany } from '../config/database.js';

export function toIso(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.system_role, u.account_status, u.suspend_reason, u.avatar, u.title, u.bio,
         u.banner_color, u.presence, u.settings, u.custom_theme, u.created_at, u.last_login_at,
         v.tier AS vip_tier, v.since AS vip_since, v.expires_at AS vip_expires_at, v.granted_by AS vip_granted_by,
         v.source AS vip_source, v.warned_for AS vip_warned_for,
         COALESCE((SELECT array_agg(m.room_key) FROM muted_rooms m WHERE m.user_id = u.id), '{}') AS muted_rooms
  FROM users u
  LEFT JOIN user_vip v ON v.user_id = u.id
`;

export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    systemRole: row.system_role,
    accountStatus: row.account_status,
    suspendReason: row.suspend_reason || '',
    avatar: row.avatar,
    title: row.title,
    bio: row.bio,
    bannerColor: row.banner_color,
    presence: row.presence,
    settings: row.settings || {},
    customTheme: row.custom_theme || null,
    mutedRooms: row.muted_rooms || [],
    createdAt: toIso(row.created_at),
    lastLoginAt: toIso(row.last_login_at),
    vip: row.vip_tier ? {
      tier: row.vip_tier,
      since: toIso(row.vip_since),
      expiresAt: toIso(row.vip_expires_at),
      grantedBy: row.vip_granted_by,
      source: row.vip_source,
      warnedFor: toIso(row.vip_warned_for)
    } : null
  };
}

export async function findUserById(id, client) {
  if (!id) return null;
  const row = await getOne(USER_SELECT + ' WHERE u.id = $1', [id], client);
  return toUser(row);
}

export async function findUsersByIds(ids, client) {
  if (!ids || ids.length === 0) return [];
  const rows = await getMany(USER_SELECT + ' WHERE u.id = ANY($1)', [ids], client);
  return rows.map(toUser);
}

export async function listUsers() {
  const rows = await getMany(USER_SELECT + ' ORDER BY u.created_at');
  return rows.map(toUser);
}

export async function findLoginByEmail(email) {
  return getOne('SELECT id, email, password_hash, account_status, reset_code, reset_expires FROM users WHERE lower(email) = lower($1)', [String(email || '').trim()]);
}

export async function getUserName(id, client) {
  if (!id) return 'ผู้ใช้ที่ถูกลบ';
  const row = await getOne('SELECT name FROM users WHERE id = $1', [id], client);
  return row ? row.name : 'ผู้ใช้ที่ถูกลบ';
}

export async function isSystemAdmin(userId) {
  const row = await getOne("SELECT 1 FROM users WHERE id = $1 AND system_role = 'administrator' AND account_status = 'active'", [userId]);
  if (row) return true;
  return false;
}

export async function getBlockedIds(userId) {
  const rows = await getMany('SELECT blocked_user_id FROM user_blocks WHERE user_id = $1', [userId]);
  return rows.map(r => r.blocked_user_id);
}

export async function isBlocked(ownerId, otherId) {
  const row = await getOne('SELECT 1 FROM user_blocks WHERE user_id = $1 AND blocked_user_id = $2', [ownerId, otherId]);
  if (row) return true;
  return false;
}
