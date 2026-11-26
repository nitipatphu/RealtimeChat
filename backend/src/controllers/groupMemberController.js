import { query, getOne, transaction } from '../config/database.js';
import { sendGroupUpdate, sendToUser, removeUserFromGroupRoom } from '../utils/socketEvents.js';
import { hasPermission, isGroupMember, cleanPermissions, getMemberRole, getAssignedRoleIds } from '../utils/permissions.js';
import { addGroupLog, getUserName } from '../utils/logs.js';
import { makeId } from '../utils/id.js';
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

async function sendAndReturn(req, res, groupId) {
  const group = await loadGroup(groupId);
  sendGroupUpdate(req, group);
  res.json(viewGroupFor(group, req.userId));
}

export const addGroupMember = async (req, res) => {
  const { email } = req.body;
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_members', res, 'คุณไม่มีสิทธิ์เพิ่มสมาชิก');

  const user = await getOne('SELECT id, name FROM users WHERE lower(email) = lower($1)', [String(email || '').trim()]);
  if (!user) {
    res.status(404);
    throw new Error('ไม่พบผู้ใช้ที่ใช้อีเมลนี้');
  }
  if (group.bans.some(b => b.userId === user.id)) {
    res.status(400);
    throw new Error('ผู้ใช้นี้ถูกแบนจากกลุ่ม ต้องปลดแบนก่อน');
  }
  if (isGroupMember(group, user.id)) {
    res.status(400);
    throw new Error('ผู้ใช้นี้เป็นสมาชิกในกลุ่มแล้ว');
  }

  const myName = await getUserName(req.userId);
  await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [group.id, user.id]);
  await addGroupLog(group.id, req.userId, 'member_add', myName + ' เพิ่ม ' + user.name + ' เข้ากลุ่ม');
  await addNotification(req, user.id, {
    type: 'group',
    title: myName + ' เพิ่มคุณเข้ากลุ่ม ' + group.name,
    body: '',
    target: { type: 'group', groupId: group.id }
  });

  sendToUser(req, user.id, 'group:added', { groupId: group.id });
  await sendAndReturn(req, res, group.id);
};

export const removeGroupMember = async (req, res) => {
  const { memberId } = req.params;
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_members', res, 'คุณไม่มีสิทธิ์นำสมาชิกออก');

  if (memberId === group.ownerId) {
    res.status(400);
    throw new Error('นำเจ้าของกลุ่มออกไม่ได้');
  }
  if (!isGroupMember(group, memberId)) {
    res.status(404);
    throw new Error('ไม่พบสมาชิกคนนี้');
  }
  if (req.userId !== group.ownerId && hasPermission(group, memberId, 'manage_members')) {
    res.status(403);
    throw new Error('นำคนที่มีสิทธิ์จัดการสมาชิกออกได้เฉพาะเจ้าของกลุ่ม');
  }

  const text = (await getUserName(req.userId)) + ' นำ ' + (await getUserName(memberId)) + ' ออกจากกลุ่ม';
  await transaction(async (client) => {
    await removeMemberFromGroup(client, group.id, memberId);
    await addGroupLog(group.id, req.userId, 'member_kick', text, client);
  });

  sendToUser(req, memberId, 'group:removed', { groupId: group.id });
  removeUserFromGroupRoom(req, memberId, group.id);
  await sendAndReturn(req, res, group.id);
};

function requireCanGrant(group, userId, permissions, res) {
  if (userId === group.ownerId) return;
  const missing = permissions.filter(key => !hasPermission(group, userId, key));
  if (missing.length === 0) return;
  res.status(403);
  throw new Error('คุณจัดการ Role ที่มีสิทธิ์มากกว่าตัวเองไม่ได้');
}

function findRole(group, roleId, res) {
  const role = group.roles.find(r => r.id === roleId);
  if (!role) {
    res.status(404);
    throw new Error('ไม่พบ Role นี้');
  }
  return role;
}

export const updateMemberRole = async (req, res) => {
  const { memberId } = req.params;
  const { roleId, assigned } = req.body;
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_roles', res, 'คุณไม่มีสิทธิ์เปลี่ยน Role');

  if (memberId === group.ownerId) {
    res.status(400);
    throw new Error('เปลี่ยน Role ของเจ้าของกลุ่มไม่ได้');
  }
  if (memberId === req.userId) {
    res.status(403);
    throw new Error('เปลี่ยน Role ของตัวเองไม่ได้');
  }
  if (!isGroupMember(group, memberId)) {
    res.status(404);
    throw new Error('ไม่พบสมาชิกคนนี้');
  }

  const role = findRole(group, roleId, res);
  if (role.isDefault) {
    res.status(400);
    throw new Error('ทุกคนมี Role เริ่มต้นอยู่แล้ว');
  }
  requireCanGrant(group, req.userId, role.permissions, res);
  requireCanGrant(group, req.userId, getMemberRole(group, memberId).permissions, res);

  const hasRole = getAssignedRoleIds(group, memberId).includes(role.id);
  const shouldHave = assigned === undefined ? !hasRole : assigned === true;

  if (shouldHave) {
    await query('INSERT INTO member_roles (group_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [group.id, memberId, role.id]);
  } else {
    await query('DELETE FROM member_roles WHERE group_id = $1 AND user_id = $2 AND role_id = $3', [group.id, memberId, role.id]);
  }

  const action = shouldHave ? ' เพิ่ม Role ' + role.name + ' ให้ ' : ' นำ Role ' + role.name + ' ออกจาก ';
  await addGroupLog(group.id, req.userId, 'role_assign', (await getUserName(req.userId)) + action + (await getUserName(memberId)));
  await sendAndReturn(req, res, group.id);
};

export const setNickname = async (req, res) => {
  const { memberId } = req.params;
  const { nickname } = req.body;
  const group = await loadGroupOr404(req.params.groupId, res);

  if (!isGroupMember(group, memberId)) {
    res.status(404);
    throw new Error('ไม่พบสมาชิกคนนี้');
  }

  if (memberId === req.userId) {
    requirePermission(group, req.userId, 'change_nickname', res, 'คุณไม่มีสิทธิ์เปลี่ยนชื่อเล่น');
  } else {
    requirePermission(group, req.userId, 'manage_nicknames', res, 'คุณไม่มีสิทธิ์เปลี่ยนชื่อเล่นของคนอื่น');
    if (memberId === group.ownerId) {
      res.status(403);
      throw new Error('เปลี่ยนชื่อเล่นของเจ้าของกลุ่มไม่ได้');
    }
  }

  const cleanNickname = String(nickname || '').trim();
  if (cleanNickname.length > 32) {
    res.status(400);
    throw new Error('ชื่อเล่นยาวได้ไม่เกิน 32 ตัวอักษร');
  }

  await query('UPDATE group_members SET nickname = $3 WHERE group_id = $1 AND user_id = $2', [group.id, memberId, cleanNickname || null]);

  const myName = await getUserName(req.userId);
  const memberName = await getUserName(memberId);
  const text = cleanNickname
    ? myName + ' ตั้งชื่อเล่นของ ' + memberName + ' เป็น "' + cleanNickname + '"'
    : myName + ' ลบชื่อเล่นของ ' + memberName;
  await addGroupLog(group.id, req.userId, 'nickname', text);
  await sendAndReturn(req, res, group.id);
};

function readRoleInput(req, res) {
  const { name, color, permissions, hoist } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('กรุณาตั้งชื่อ Role');
  }
  if (name.trim().length > 24) {
    res.status(400);
    throw new Error('ชื่อ Role ยาวได้ไม่เกิน 24 ตัวอักษร');
  }
  if (name.trim().toLowerCase() === 'owner') {
    res.status(400);
    throw new Error('ใช้ชื่อ Owner ไม่ได้');
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    res.status(400);
    throw new Error('สีไม่ถูกต้อง');
  }
  return {
    name: name.trim(),
    color: color || '#64748b',
    permissions: cleanPermissions(permissions),
    hoist: hoist === true
  };
}

export const createRole = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_roles', res, 'คุณไม่มีสิทธิ์สร้าง Role');

  if (group.roles.length >= 100) {
    res.status(400);
    throw new Error('สร้าง Role ได้สูงสุด 100 อัน');
  }

  const input = readRoleInput(req, res);
  requireCanGrant(group, req.userId, input.permissions, res);

  const defaultRole = group.roles.find(r => r.isDefault);
  const defaultIndex = defaultRole ? group.roles.indexOf(defaultRole) : group.roles.length;
  await transaction(async (client) => {
    await query('UPDATE group_roles SET position = position + 1 WHERE group_id = $1 AND position >= $2', [group.id, defaultIndex], client);
    await query(
      'INSERT INTO group_roles (id, group_id, name, color, permissions, hoist, is_default, position) VALUES ($1, $2, $3, $4, $5, $6, false, $7)',
      [makeId('role'), group.id, input.name, input.color, input.permissions, input.hoist, defaultIndex],
      client
    );
  });

  await addGroupLog(group.id, req.userId, 'role_create', (await getUserName(req.userId)) + ' สร้าง Role ' + input.name);
  res.status(201);
  await sendAndReturn(req, res, group.id);
};

export const updateRole = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_roles', res, 'คุณไม่มีสิทธิ์แก้ไข Role');
  const role = findRole(group, req.params.roleId, res);

  const myRole = getMemberRole(group, req.userId);
  if (!myRole.isOwner && !role.isDefault && myRole.roleIds.includes(role.id)) {
    res.status(403);
    throw new Error('แก้ไข Role ของตัวเองไม่ได้ ให้เจ้าของกลุ่มแก้ให้');
  }

  requireCanGrant(group, req.userId, role.permissions, res);
  const input = readRoleInput(req, res);
  requireCanGrant(group, req.userId, input.permissions, res);

  await query(
    'UPDATE group_roles SET name = $2, color = $3, permissions = $4, hoist = $5 WHERE id = $1',
    [role.id, input.name, input.color, input.permissions, input.hoist]
  );

  const text = role.name === input.name ? 'แก้ไข Role ' + input.name : 'แก้ไข Role ' + role.name + ' (ชื่อใหม่: ' + input.name + ')';
  await addGroupLog(group.id, req.userId, 'role_update', (await getUserName(req.userId)) + ' ' + text);
  await sendAndReturn(req, res, group.id);
};

export const deleteRole = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_roles', res, 'คุณไม่มีสิทธิ์ลบ Role');
  const role = findRole(group, req.params.roleId, res);

  if (role.isDefault) {
    res.status(400);
    throw new Error('ลบ Role เริ่มต้นไม่ได้');
  }
  requireCanGrant(group, req.userId, role.permissions, res);

  const onlyRoleChannel = await getOne(
    `SELECT c.name FROM channels c
     JOIN channel_allowed_roles a ON a.channel_id = c.id AND a.role_id = $1
     WHERE (SELECT count(*) FROM channel_allowed_roles x WHERE x.channel_id = c.id) = 1
     LIMIT 1`,
    [role.id]
  );
  if (onlyRoleChannel) {
    res.status(400);
    throw new Error('Role นี้เป็น Role เดียวที่เข้าห้องส่วนตัว #' + onlyRoleChannel.name + ' ได้ แก้ห้องนั้นก่อนจึงจะลบได้');
  }

  await query('DELETE FROM group_roles WHERE id = $1', [role.id]);
  await addGroupLog(group.id, req.userId, 'role_delete', (await getUserName(req.userId)) + ' ลบ Role ' + role.name);
  await sendAndReturn(req, res, group.id);
};

export const reorderRoles = async (req, res) => {
  const { roleIds } = req.body;
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_roles', res, 'คุณไม่มีสิทธิ์จัดลำดับ Role');

  const validIds = group.roles.map(r => r.id);
  let sameSet = Array.isArray(roleIds) && roleIds.length === validIds.length;
  validIds.forEach(id => {
    if (!Array.isArray(roleIds) || !roleIds.includes(id)) sameSet = false;
  });
  if (!sameSet) {
    res.status(400);
    throw new Error('ลำดับ Role ไม่ถูกต้อง');
  }

  await transaction(async (client) => {
    for (let i = 0; i < roleIds.length; i++) {
      await query('UPDATE group_roles SET position = $2 WHERE id = $1', [roleIds[i], i], client);
    }
  });

  await addGroupLog(group.id, req.userId, 'role_update', (await getUserName(req.userId)) + ' จัดลำดับ Role ใหม่');
  await sendAndReturn(req, res, group.id);
};
