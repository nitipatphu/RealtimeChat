import { query, getOne, transaction } from '../config/database.js';
import { sendGroupUpdate, sendToUser, removeUserFromGroupRoom } from '../utils/socketEvents.js';
import { hasPermission, isGroupMember } from '../utils/permissions.js';
import { addGroupLog, getUserName } from '../utils/logs.js';
import { makeInviteCode } from '../utils/id.js';
import { addNotification } from '../utils/notifications.js';
import { loadGroup, loadGroupOr404 } from '../models/groupModel.js';
import { viewGroupFor } from '../utils/groupView.js';
import { removeMemberFromGroup } from './groupController.js';

function requirePermission(group, userId, permission, res, message) {
  if (!hasPermission(group, userId, permission)) {
    res.status(403);
    throw new Error(message);
  }
}

function requireCanModerate(group, userId, memberId, permission, res) {
  if (memberId === group.ownerId) {
    res.status(400);
    throw new Error('ทำรายการนี้กับเจ้าของกลุ่มไม่ได้');
  }
  if (memberId === userId) {
    res.status(400);
    throw new Error('ทำรายการนี้กับตัวเองไม่ได้');
  }
  if (userId !== group.ownerId && hasPermission(group, memberId, permission)) {
    res.status(403);
    throw new Error('ทำรายการนี้กับคนที่มีสิทธิ์เดียวกันไม่ได้ ต้องให้เจ้าของกลุ่มทำ');
  }
}

function formatMinutes(minutes) {
  if (minutes % (24 * 60) === 0) return (minutes / (24 * 60)) + ' วัน';
  if (minutes % 60 === 0) return (minutes / 60) + ' ชั่วโมง';
  return minutes + ' นาที';
}

async function sendAndReturn(req, res, groupId) {
  const group = await loadGroup(groupId);
  sendGroupUpdate(req, group);
  res.json(viewGroupFor(group, req.userId));
}

export const banMember = async (req, res) => {
  const { memberId } = req.body;
  const reason = String(req.body.reason || '').trim().slice(0, 200);
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'ban_members', res, 'คุณไม่มีสิทธิ์แบนสมาชิก');
  requireCanModerate(group, req.userId, memberId, 'ban_members', res);

  const target = await getOne('SELECT id FROM users WHERE id = $1', [memberId]);
  if (!target) {
    res.status(404);
    throw new Error('ไม่พบผู้ใช้');
  }
  if (group.bans.some(b => b.userId === memberId)) {
    res.status(400);
    throw new Error('ผู้ใช้นี้ถูกแบนอยู่แล้ว');
  }

  const wasMember = isGroupMember(group, memberId);
  const reasonText = reason ? ' (เหตุผล: ' + reason + ')' : '';
  const text = (await getUserName(req.userId)) + ' แบน ' + (await getUserName(memberId)) + reasonText;

  await transaction(async (client) => {
    if (wasMember) {
      await removeMemberFromGroup(client, group.id, memberId);
    }
    await query('INSERT INTO group_bans (group_id, user_id, reason, banned_by) VALUES ($1, $2, $3, $4)', [group.id, memberId, reason, req.userId], client);
    await addGroupLog(group.id, req.userId, 'member_ban', text, client);
  });

  await addNotification(req, memberId, {
    type: 'system',
    title: 'คุณถูกแบนจากกลุ่ม ' + group.name,
    body: reason ? 'เหตุผล: ' + reason : '',
    target: null
  });

  if (wasMember) {
    sendToUser(req, memberId, 'group:removed', { groupId: group.id });
    removeUserFromGroupRoom(req, memberId, group.id);
  }
  await sendAndReturn(req, res, group.id);
};

export const unbanMember = async (req, res) => {
  const { memberId } = req.params;
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'ban_members', res, 'คุณไม่มีสิทธิ์ปลดแบน');

  const removed = await query('DELETE FROM group_bans WHERE group_id = $1 AND user_id = $2', [group.id, memberId]);
  if (removed.rowCount === 0) {
    res.status(404);
    throw new Error('ผู้ใช้นี้ไม่ได้ถูกแบน');
  }

  await addGroupLog(group.id, req.userId, 'member_unban', (await getUserName(req.userId)) + ' ปลดแบน ' + (await getUserName(memberId)));
  await sendAndReturn(req, res, group.id);
};

export const timeoutMember = async (req, res) => {
  const { memberId } = req.params;
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'timeout_members', res, 'คุณไม่มีสิทธิ์ Timeout สมาชิก');
  requireCanModerate(group, req.userId, memberId, 'timeout_members', res);

  if (!isGroupMember(group, memberId)) {
    res.status(404);
    throw new Error('ไม่พบสมาชิกคนนี้');
  }

  const amount = Math.round(Number(req.body.minutes) || 0);
  if (amount < 0 || amount > 7 * 24 * 60) {
    res.status(400);
    throw new Error('Timeout ได้ไม่เกิน 7 วัน');
  }

  const myName = await getUserName(req.userId);
  const memberName = await getUserName(memberId);

  if (amount === 0) {
    await query('UPDATE group_members SET timeout_until = NULL WHERE group_id = $1 AND user_id = $2', [group.id, memberId]);
    await addGroupLog(group.id, req.userId, 'member_timeout', myName + ' ยกเลิก Timeout ของ ' + memberName);
  } else {
    await query(
      "UPDATE group_members SET timeout_until = now() + ($3 || ' minutes')::interval WHERE group_id = $1 AND user_id = $2",
      [group.id, memberId, String(amount)]
    );
    await addGroupLog(group.id, req.userId, 'member_timeout', myName + ' Timeout ' + memberName + ' เป็นเวลา ' + formatMinutes(amount));
    await addNotification(req, memberId, {
      type: 'system',
      title: 'คุณถูก Timeout ในกลุ่ม ' + group.name,
      body: 'ส่งข้อความไม่ได้เป็นเวลา ' + formatMinutes(amount),
      target: { type: 'group', groupId: group.id, id: group.id }
    });
  }

  await sendAndReturn(req, res, group.id);
};

export const createInvite = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'create_invites', res, 'คุณไม่มีสิทธิ์สร้างลิงก์เชิญ');

  if (group.invites.length >= 50) {
    res.status(400);
    throw new Error('สร้างลิงก์เชิญได้สูงสุด 50 อัน ลบอันเก่าก่อน');
  }

  const minutes = Math.round(Number(req.body.expiresInMinutes) || 0);
  const uses = Math.round(Number(req.body.maxUses) || 0);
  if (minutes < 0 || minutes > 365 * 24 * 60 || uses < 0 || uses > 1000) {
    res.status(400);
    throw new Error('ค่าที่ระบุไม่ถูกต้อง');
  }

  let code = makeInviteCode();
  while (await getOne('SELECT 1 FROM group_invites WHERE code = $1 UNION SELECT 1 FROM groups WHERE invite_code = $1', [code])) {
    code = makeInviteCode();
  }

  const expiresAt = minutes > 0 ? new Date(Date.now() + minutes * 60 * 1000) : null;
  await query('INSERT INTO group_invites (code, group_id, created_by, expires_at, max_uses) VALUES ($1, $2, $3, $4, $5)', [code, group.id, req.userId, expiresAt, uses]);
  await addGroupLog(group.id, req.userId, 'invite_create', (await getUserName(req.userId)) + ' สร้างลิงก์เชิญ ' + code);

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.status(201).json(updated.invites.find(i => i.code === code));
};

export const deleteInvite = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  const invite = group.invites.find(i => i.code === req.params.code);
  if (!invite) {
    res.status(404);
    throw new Error('ไม่พบลิงก์เชิญนี้');
  }
  if (invite.createdBy !== req.userId && !hasPermission(group, req.userId, 'manage_group')) {
    res.status(403);
    throw new Error('ลบได้เฉพาะลิงก์ที่ตัวเองสร้าง');
  }

  await query('DELETE FROM group_invites WHERE code = $1', [invite.code]);
  await addGroupLog(group.id, req.userId, 'invite_delete', (await getUserName(req.userId)) + ' ลบลิงก์เชิญ ' + invite.code);
  await sendAndReturn(req, res, group.id);
};
