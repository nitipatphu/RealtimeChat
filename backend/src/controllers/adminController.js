import bcrypt from 'bcryptjs';
import { query, getOne, getMany, transaction } from '../config/database.js';
import { addAdminLog, addGroupLog } from '../utils/logs.js';
import { getLastDays } from '../utils/messages.js';
import { getMemberRole } from '../utils/permissions.js';
import { toGroupSummary, GROUP_SUMMARY_SQL } from '../utils/groupView.js';
import { sendGroupUpdate, sendGroupDeleted, sendToUser, sendToEveryone } from '../utils/socketEvents.js';
import { makeAvatar, cleanEmail } from '../utils/id.js';
import { findUserById, toIso } from '../models/userModel.js';
import { loadGroup, getGroupLogs, listChannels } from '../models/groupModel.js';
import { removeUserEverywhere } from './userController.js';
import { createGroupRecords } from './groupController.js';

const SYSTEM_ROLES = ['administrator', 'staff', 'member'];
const ROLE_NAMES = { administrator: 'Administrator', staff: 'Staff', member: 'Member' };

async function findUserOr404(id, res) {
  const user = await findUserById(id);
  if (!user) {
    res.status(404);
    throw new Error('ไม่พบผู้ใช้');
  }
  return user;
}

async function findGroupOr404(id, res) {
  const group = await loadGroup(id);
  if (!group) {
    res.status(404);
    throw new Error('ไม่พบกลุ่ม');
  }
  return group;
}

async function countAdmins() {
  const row = await getOne("SELECT count(*) AS total FROM users WHERE system_role = 'administrator'");
  return Number(row.total);
}

async function fillDays(sql, params) {
  const days = getLastDays(14);
  const rows = await getMany(sql, params || []);
  rows.forEach(row => {
    const day = days.find(d => d.date === row.day);
    if (day) day.count = Number(row.total);
  });
  return days;
}

const DAY_SQL = "to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD')";

const GROUP_MESSAGE_COUNT_SQL = `
  SELECT group_id, sum(total) AS total FROM (
    SELECT c.group_id, count(*) AS total FROM messages m JOIN channels c ON c.id = m.channel_id GROUP BY c.group_id
    UNION ALL
    SELECT p.group_id, count(*) AS total FROM messages m JOIN project_channels pc ON pc.id = m.project_channel_id JOIN projects p ON p.id = pc.project_id GROUP BY p.group_id
  ) x GROUP BY group_id
`;

async function groupMessageCounts() {
  const rows = await getMany(GROUP_MESSAGE_COUNT_SQL);
  const result = {};
  rows.forEach(row => {
    result[row.group_id] = Number(row.total);
  });
  return result;
}

export const getStats = async (req, res) => {
  const users = await getOne(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE system_role = 'administrator') AS administrator,
            count(*) FILTER (WHERE system_role = 'staff') AS staff,
            count(*) FILTER (WHERE system_role = 'member') AS member,
            count(*) FILTER (WHERE account_status = 'suspended') AS suspended,
            (SELECT count(*) FROM user_vip WHERE tier = 'vip' AND expires_at > now()) AS vip,
            (SELECT count(*) FROM user_vip WHERE tier = 'supervip' AND expires_at > now()) AS supervip
     FROM users`
  );
  const groups = await getOne(
    "SELECT count(*) AS total, count(*) FILTER (WHERE visibility = 'public') AS public, count(*) FILTER (WHERE visibility = 'private') AS private FROM groups"
  );
  const messages = await getOne('SELECT count(*) AS total FROM messages');

  const counts = await groupMessageCounts();
  const groupRows = await getMany('SELECT g.id, g.name, g.color, g.visibility, (SELECT count(*) FROM group_members m WHERE m.group_id = g.id) AS member_count FROM groups g');
  const topGroups = groupRows
    .map(g => ({ id: g.id, name: g.name, color: g.color, visibility: g.visibility, memberCount: Number(g.member_count), messageCount: counts[g.id] || 0 }))
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 5);

  const toNumbers = (row) => {
    const result = {};
    Object.keys(row).forEach(key => {
      result[key] = Number(row[key]);
    });
    return result;
  };

  res.json({
    users: toNumbers(users),
    groups: toNumbers(groups),
    messages: { total: Number(messages.total) },
    messageActivity: await fillDays('SELECT ' + DAY_SQL + " AS day, count(*) AS total FROM messages WHERE created_at > now() - interval '15 days' GROUP BY 1"),
    signupActivity: await fillDays('SELECT ' + DAY_SQL + " AS day, count(*) AS total FROM users WHERE created_at > now() - interval '15 days' GROUP BY 1"),
    topGroups: topGroups
  });
};

const PAGE_SIZE = 50;

function buildUserFilter(queryParams) {
  const conditions = [];
  const params = [];
  const text = String(queryParams.q || '').trim().toLowerCase();
  if (text) {
    params.push('%' + text + '%');
    conditions.push('(lower(u.email) LIKE $' + params.length + ' OR lower(u.name) LIKE $' + params.length + ')');
  }
  const role = queryParams.role;
  if (role === 'suspended') {
    conditions.push("u.account_status = 'suspended'");
  } else if (SYSTEM_ROLES.includes(role)) {
    params.push(role);
    conditions.push('u.system_role = $' + params.length);
  }
  if (queryParams.status === 'active') {
    conditions.push("u.account_status = 'active'");
  }
  let where = '';
  if (conditions.length > 0) {
    where = ' WHERE ' + conditions.join(' AND ');
  }
  return { where: where, params: params };
}

export const searchUsers = async (req, res) => {
  const filter = buildUserFilter(req.query);
  let limit = Number(req.query.limit) || 8;
  if (limit > 20) limit = 20;
  const rows = await getMany(
    'SELECT u.id, u.name, u.email, u.avatar, u.system_role, u.account_status FROM users u' + filter.where +
      ' ORDER BY lower(u.email) LIMIT ' + limit,
    filter.params
  );
  res.json(rows.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    systemRole: user.system_role,
    accountStatus: user.account_status
  })));
};

export const getUsers = async (req, res) => {
  const filter = buildUserFilter(req.query);
  const totalRow = await getOne('SELECT count(*) AS total FROM users u' + filter.where, filter.params);
  const total = Number(totalRow.total);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let page = Number(req.query.page) || 1;
  if (page < 1) page = 1;
  if (page > pages) page = pages;

  const rows = await getMany(
    `SELECT u.*,
            (SELECT count(*) FROM group_members m WHERE m.user_id = u.id) AS group_count,
            (SELECT count(*) FROM groups g WHERE g.owner_id = u.id) AS owned_count,
            (SELECT count(*) FROM messages x WHERE x.author_id = u.id) AS message_count
     FROM users u` + filter.where + ' ORDER BY u.created_at LIMIT ' + PAGE_SIZE + ' OFFSET ' + (page - 1) * PAGE_SIZE,
    filter.params
  );
  const users = rows.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    title: user.title || '',
    systemRole: user.system_role,
    accountStatus: user.account_status,
    suspendReason: user.suspend_reason || '',
    createdAt: toIso(user.created_at),
    lastLoginAt: toIso(user.last_login_at),
    groupCount: Number(user.group_count),
    ownedCount: Number(user.owned_count),
    messageCount: Number(user.message_count)
  }));
  res.json({ users: users, total: total, page: page, pages: pages });
};

export const createUser = async (req, res) => {
  const { name, email, password, systemRole } = req.body;
  if (!name || !name.trim() || !email || !email.trim() || !password) {
    res.status(400);
    throw new Error('กรุณากรอกชื่อ อีเมล และรหัสผ่าน');
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  }
  if (await getOne('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email.trim()])) {
    res.status(400);
    throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
  }
  const role = SYSTEM_ROLES.includes(systemRole) ? systemRole : 'member';
  if (role !== 'member' && req.adminUser.systemRole !== 'administrator') {
    res.status(403);
    throw new Error('เฉพาะ Administrator ที่สร้างบัญชีทีมงานได้');
  }

  const id = 'u-' + Date.now();
  const hash = await bcrypt.hash(String(password), 10);
  await transaction(async (client) => {
    await query(
      'INSERT INTO users (id, name, email, password_hash, system_role, avatar) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, name.trim().slice(0, 50), cleanEmail(email), hash, role, makeAvatar(name.trim())],
      client
    );
    await query("INSERT INTO read_markers (user_id, room_key, last_read_at) VALUES ($1, 'all', now())", [id], client);
    await addAdminLog(req.adminUser.id, 'user_create', req.adminUser.name + ' สร้างบัญชี ' + name.trim() + ' (' + ROLE_NAMES[role] + ')', client);
  });

  const user = await findUserById(id);
  sendToEveryone(req, 'user:updated', user);
  res.status(201).json(user);
};

export const updateUser = async (req, res) => {
  const { name, email, systemRole } = req.body;
  if (!name || !name.trim() || !email || !email.trim()) {
    res.status(400);
    throw new Error('กรุณากรอกชื่อและอีเมล');
  }

  const user = await findUserOr404(req.params.id, res);
  const sameEmail = await getOne('SELECT id FROM users WHERE lower(email) = lower($1)', [email.trim()]);
  if (sameEmail && sameEmail.id !== user.id) {
    res.status(400);
    throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
  }

  const newRole = SYSTEM_ROLES.includes(systemRole) ? systemRole : user.systemRole;
  if (user.systemRole === 'administrator' && newRole !== 'administrator' && (await countAdmins()) <= 1) {
    res.status(400);
    throw new Error('ต้องมี Administrator อย่างน้อย 1 คน');
  }

  const changes = [];
  if (user.name !== name.trim()) changes.push('ชื่อ');
  if (user.email !== cleanEmail(email)) changes.push('อีเมล');
  if (user.systemRole !== newRole) changes.push('สิทธิ์ระบบเป็น ' + ROLE_NAMES[newRole]);

  await query('UPDATE users SET name = $2, email = $3, system_role = $4 WHERE id = $1', [user.id, name.trim().slice(0, 50), cleanEmail(email), newRole]);
  if (changes.length > 0) {
    await addAdminLog(req.adminUser.id, 'user_update', req.adminUser.name + ' แก้ไขบัญชี ' + name.trim() + ': ' + changes.join(', '));
  }

  const updated = await findUserById(user.id);
  sendToEveryone(req, 'user:updated', updated);
  res.json(updated);
};

export const setUserStatus = async (req, res) => {
  const { status, reason } = req.body;
  if (status !== 'active' && status !== 'suspended') {
    res.status(400);
    throw new Error('สถานะไม่ถูกต้อง');
  }

  const user = await findUserOr404(req.params.id, res);
  if (user.id === req.adminUser.id) {
    res.status(400);
    throw new Error('เปลี่ยนสถานะบัญชีตัวเองไม่ได้');
  }
  if (req.adminUser.systemRole === 'staff' && user.systemRole !== 'member') {
    res.status(403);
    throw new Error('Staff ระงับได้เฉพาะบัญชี Member');
  }

  const suspendReason = status === 'suspended' ? String(reason || '').trim().slice(0, 200) : '';
  await query('UPDATE users SET account_status = $2, suspend_reason = $3 WHERE id = $1', [user.id, status, suspendReason || null]);

  if (status === 'suspended') {
    await query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    const reasonText = suspendReason ? ' เหตุผล: ' + suspendReason : '';
    await addAdminLog(req.adminUser.id, 'user_suspend', req.adminUser.name + ' ระงับบัญชี ' + user.name + reasonText);
    sendToUser(req, user.id, 'account:suspended', { reason: suspendReason });
  } else {
    await addAdminLog(req.adminUser.id, 'user_activate', req.adminUser.name + ' ยกเลิกการระงับบัญชี ' + user.name);
  }

  const updated = await findUserById(user.id);
  sendToEveryone(req, 'user:updated', updated);
  res.json(updated);
};

export const resetPassword = async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 6) {
    res.status(400);
    throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
  }

  const user = await findUserOr404(req.params.id, res);
  const hash = await bcrypt.hash(String(newPassword), 10);
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, hash]);
  await query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
  await addAdminLog(req.adminUser.id, 'user_password', req.adminUser.name + ' รีเซ็ตรหัสผ่านของ ' + user.name);
  res.json({ message: 'รีเซ็ตรหัสผ่านเรียบร้อย' });
};

export const deleteUser = async (req, res) => {
  const user = await findUserOr404(req.params.id, res);
  if (user.id === req.adminUser.id) {
    res.status(400);
    throw new Error('ลบบัญชีตัวเองจากหน้านี้ไม่ได้');
  }
  if (user.systemRole === 'administrator' && (await countAdmins()) <= 1) {
    res.status(400);
    throw new Error('ต้องมี Administrator อย่างน้อย 1 คน');
  }

  const owned = await getMany('SELECT name FROM groups WHERE owner_id = $1', [user.id]);
  if (owned.length > 0) {
    res.status(400);
    throw new Error(user.name + ' เป็นเจ้าของกลุ่ม ' + owned.map(g => g.name).join(', ') + ' ต้องเปลี่ยนเจ้าของหรือลบกลุ่มก่อน');
  }

  await addAdminLog(req.adminUser.id, 'user_delete', req.adminUser.name + ' ลบบัญชี ' + user.name + ' (' + user.email + ')');
  sendToUser(req, user.id, 'account:suspended', { reason: 'บัญชีถูกลบโดยผู้ดูแลระบบ' });
  await removeUserEverywhere(req, user);

  sendToEveryone(req, 'user:deleted', { userId: user.id });
  res.json({ message: 'ลบบัญชีเรียบร้อย' });
};

export const getGroups = async (req, res) => {
  const rows = await getMany(GROUP_SUMMARY_SQL + ' ORDER BY g.created_at');
  const counts = await groupMessageCounts();
  res.json(rows.map(row => {
    const summary = toGroupSummary(row);
    summary.messageCount = counts[row.id] || 0;
    summary.inviteCode = row.invite_code;
    summary.ownerEmail = row.owner_email || '';
    summary.ownerAvatar = row.owner_avatar || '';
    return summary;
  }));
};

export const getGroupDetail = async (req, res) => {
  const group = await findGroupOr404(req.params.id, res);
  const summaryRow = await getOne(GROUP_SUMMARY_SQL + ' WHERE g.id = $1', [group.id]);
  const users = await getMany('SELECT id, name, email, avatar FROM users WHERE id = ANY($1)', [group.members]);

  const members = group.members.map(memberId => {
    const user = users.find(u => u.id === memberId);
    const role = getMemberRole(group, memberId);
    return {
      id: memberId,
      name: user ? user.name : 'ผู้ใช้ที่ถูกลบ',
      email: user ? user.email : '',
      avatar: user ? user.avatar : makeAvatar('?'),
      roleName: role.name,
      roleColor: role.color,
      nickname: group.nicknames[memberId] || ''
    };
  });

  res.json({
    ...toGroupSummary(summaryRow),
    inviteCode: group.inviteCode,
    channelCount: (await listChannels(group.id)).length,
    roles: group.roles.map(r => ({ id: r.id, name: r.name, color: r.color })),
    members: members,
    logs: (await getGroupLogs(group.id)).slice(0, 30)
  });
};

export const createGroup = async (req, res) => {
  const { name, description, visibility, ownerId } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อกลุ่ม');
  }

  const owner = await findUserOr404(ownerId, res);
  const groupId = await transaction(async (client) => {
    const id = await createGroupRecords(client, { name: name.trim().slice(0, 50), description: String(description || '').trim().slice(0, 200), visibility: visibility, ownerId: owner.id });
    await addGroupLog(id, req.adminUser.id, 'group_create', req.adminUser.name + ' (ผู้ดูแลระบบ) สร้างกลุ่มนี้ให้ ' + owner.name, client);
    await addAdminLog(req.adminUser.id, 'group_create', req.adminUser.name + ' สร้างกลุ่ม ' + name.trim() + ' (เจ้าของ: ' + owner.name + ')', client);
    return id;
  });

  sendToUser(req, owner.id, 'group:added', { groupId: groupId });
  res.status(201).json(toGroupSummary(await getOne(GROUP_SUMMARY_SQL + ' WHERE g.id = $1', [groupId])));
};

export const updateGroup = async (req, res) => {
  const { name, description, visibility, ownerId } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อกลุ่ม');
  }

  const group = await findGroupOr404(req.params.id, res);
  const newVisibility = visibility === 'public' || visibility === 'private' ? visibility : group.visibility;
  const changes = [];
  if (group.name !== name.trim()) changes.push('ชื่อ');
  if ((group.description || '') !== String(description || '').trim()) changes.push('คำอธิบาย');
  if (newVisibility !== group.visibility) changes.push('การมองเห็นเป็น ' + (newVisibility === 'public' ? 'Public' : 'Private'));

  let newOwner = null;
  if (ownerId && ownerId !== group.ownerId) {
    newOwner = await findUserOr404(ownerId, res);
    changes.push('เจ้าของเป็น ' + newOwner.name);
  }

  await transaction(async (client) => {
    await query('UPDATE groups SET name = $2, description = $3, visibility = $4 WHERE id = $1', [group.id, name.trim().slice(0, 50), String(description || '').trim().slice(0, 200), newVisibility], client);
    if (newOwner) {
      await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [group.id, newOwner.id], client);
      await query('DELETE FROM member_roles WHERE group_id = $1 AND user_id = $2', [group.id, newOwner.id], client);
      await query('UPDATE groups SET owner_id = $2 WHERE id = $1', [group.id, newOwner.id], client);
    }
    if (changes.length > 0) {
      await addGroupLog(group.id, req.adminUser.id, 'admin_update', req.adminUser.name + ' (ผู้ดูแลระบบ) เปลี่ยน' + changes.join(', '), client);
      await addAdminLog(req.adminUser.id, 'group_update', req.adminUser.name + ' แก้ไขกลุ่ม ' + name.trim() + ': ' + changes.join(', '), client);
    }
  });

  if (newOwner && !group.members.includes(newOwner.id)) {
    sendToUser(req, newOwner.id, 'group:added', { groupId: group.id });
  }
  sendGroupUpdate(req, await loadGroup(group.id));
  res.json(toGroupSummary(await getOne(GROUP_SUMMARY_SQL + ' WHERE g.id = $1', [group.id])));
};

export const deleteGroup = async (req, res) => {
  const group = await findGroupOr404(req.params.id, res);
  await query('DELETE FROM groups WHERE id = $1', [group.id]);
  await addAdminLog(req.adminUser.id, 'group_delete', req.adminUser.name + ' ลบกลุ่ม ' + group.name);

  sendGroupDeleted(req, group.id);
  res.json({ message: 'ลบกลุ่มเรียบร้อย' });
};

export const getLogs = async (req, res) => {
  const rows = await getMany(
    `SELECT l.*, u.name AS actor_name, u.avatar AS actor_avatar, u.system_role AS actor_role
     FROM admin_logs l LEFT JOIN users u ON u.id = l.actor_id
     ORDER BY l.created_at DESC LIMIT 1000`
  );
  res.json(rows.map(row => ({
    id: row.id,
    action: row.action,
    actorId: row.actor_id,
    text: row.text,
    createdAt: toIso(row.created_at),
    actorName: row.actor_name || 'ผู้ใช้ที่ถูกลบ',
    actorAvatar: row.actor_avatar || makeAvatar('?'),
    actorRole: row.actor_role || ''
  })));
};

async function getWorkStats(userId) {
  const row = await getOne(
    `SELECT
       count(*) FILTER (WHERE action IN ('vip_grant', 'vip_code')) AS vip_total,
       count(*) FILTER (WHERE action = 'user_suspend') AS suspend_total,
       count(*) FILTER (WHERE action = 'message_delete') AS deleted_messages,
       count(*) AS actions_total,
       count(*) FILTER (WHERE created_at > now() - interval '7 days') AS actions_week,
       max(created_at) AS last_action_at
     FROM admin_logs WHERE actor_id = $1`,
    [userId]
  );
  return {
    vipTotal: Number(row.vip_total),
    suspendTotal: Number(row.suspend_total),
    deletedMessages: Number(row.deleted_messages),
    actionsTotal: Number(row.actions_total),
    actionsWeek: Number(row.actions_week),
    lastActionAt: toIso(row.last_action_at)
  };
}

export const getMyWork = async (req, res) => {
  res.json({
    stats: await getWorkStats(req.adminUser.id),
    activity: await fillDays('SELECT ' + DAY_SQL + " AS day, count(*) AS total FROM admin_logs WHERE actor_id = $1 AND created_at > now() - interval '15 days' GROUP BY 1", [req.adminUser.id])
  });
};

export const getTeam = async (req, res) => {
  const teamRows = await getMany("SELECT * FROM users WHERE system_role IN ('administrator', 'staff') ORDER BY created_at");
  const team = [];
  for (const user of teamRows) {
    team.push({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      systemRole: user.system_role,
      accountStatus: user.account_status,
      lastLoginAt: toIso(user.last_login_at),
      ...(await getWorkStats(user.id))
    });
  }

  res.json({ team: team });
};

export const setSystemRole = async (req, res) => {
  const { systemRole } = req.body;
  if (!SYSTEM_ROLES.includes(systemRole)) {
    res.status(400);
    throw new Error('สิทธิ์ไม่ถูกต้อง');
  }

  const user = await findUserOr404(req.params.id, res);
  if (user.systemRole === 'administrator' && systemRole !== 'administrator' && (await countAdmins()) <= 1) {
    res.status(400);
    throw new Error('ต้องมี Administrator อย่างน้อย 1 คน');
  }

  await query('UPDATE users SET system_role = $2 WHERE id = $1', [user.id, systemRole]);
  if (user.systemRole !== systemRole) {
    await addAdminLog(req.adminUser.id, 'user_update', req.adminUser.name + ' เปลี่ยนสิทธิ์ระบบของ ' + user.name + ' จาก ' + ROLE_NAMES[user.systemRole] + ' เป็น ' + ROLE_NAMES[systemRole]);
  }

  const updated = await findUserById(user.id);
  sendToEveryone(req, 'user:updated', updated);
  res.json(updated);
};
