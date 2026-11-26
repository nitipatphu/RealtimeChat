import { getOne } from '../config/database.js';

export async function isBanned(groupId, userId) {
  const row = await getOne('SELECT 1 FROM group_bans WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  if (row) return true;
  return false;
}

export function getTimeoutUntil(group, userId) {
  const until = (group.timeouts || {})[userId];
  if (!until) return null;
  if (new Date(until).getTime() <= Date.now()) return null;
  return until;
}

export function requireNotTimedOut(group, userId, res) {
  const until = getTimeoutUntil(group, userId);
  if (!until) return;
  res.status(403);
  throw new Error('คุณถูก Timeout อยู่ ส่งข้อความไม่ได้ชั่วคราว');
}

export async function findInvite(code) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) return null;

  const group = await getOne('SELECT id FROM groups WHERE invite_code = $1', [cleanCode]);
  if (group) return { groupId: group.id, invite: null };

  const invite = await getOne('SELECT * FROM group_invites WHERE code = $1', [cleanCode]);
  if (invite) return { groupId: invite.group_id, invite: invite };
  return null;
}

export function isInviteUsable(invite) {
  if (!invite) return true;
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) return false;
  if (invite.max_uses > 0 && invite.uses >= invite.max_uses) return false;
  return true;
}
