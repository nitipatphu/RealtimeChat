import bcrypt from 'bcryptjs';
import { query, getOne, getMany, transaction } from '../config/database.js';
import { deleteUploadedFile } from '../middlewares/uploadMiddleware.js';
import { createSession, deleteSession, checkLoginLimit, addLoginFail, clearLoginFails } from '../middlewares/authMiddleware.js';
import { sendGroupUpdate, sendToUser } from '../utils/socketEvents.js';
import { canSeeProject, getMemberRole, canSeeChannel } from '../utils/permissions.js';
import { getLastDays } from '../utils/messages.js';
import { makeAvatar, cleanEmail, hashToken } from '../utils/id.js';
import { canUseTheme, getPerks } from '../utils/vip.js';
import { findUserById, listUsers, findLoginByEmail, getBlockedIds, toIso } from '../models/userModel.js';
import { loadGroup, loadGroups, getGroupIdsForUser, listChannels } from '../models/groupModel.js';

const SETTING_KEYS = ['theme', 'fontSize', 'notifyDm', 'notifyMention', 'notifyChannel', 'notifyTask', 'sound', 'soundType', 'volume', 'desktop'];
const SOUND_TYPES = ['ding', 'pop', 'bell', 'chime'];
const PRESENCE_LIST = ['online', 'busy', 'sleep', 'offline'];

export function publicUser(user) {
  return user;
}

async function findUserOr404(id, res) {
  const user = await findUserById(id);
  if (!user) {
    res.status(404);
    throw new Error('ไม่พบผู้ใช้');
  }
  return user;
}

async function checkPassword(userId, password) {
  const row = await getOne('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!row || !password) return false;
  return bcrypt.compare(String(password), row.password_hash);
}

function sendUserUpdate(req, user) {
  const io = req.app.get('io');
  if (!io) return;
  io.emit('user:updated', user);
}

export const getUsers = async (req, res) => {
  res.json(await listUsers());
};

export const getMe = async (req, res) => {
  res.json({ user: await findUserOr404(req.userId, res) });
};

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !name.trim() || !email || !password) {
    res.status(400);
    throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');
  }
  if (name.trim().length > 50) {
    res.status(400);
    throw new Error('ชื่อยาวเกินไป');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(email))) {
    res.status(400);
    throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  }

  const exists = await findLoginByEmail(email);
  if (exists) {
    res.status(400);
    throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
  }

  const id = 'u-' + Date.now();
  const hash = await bcrypt.hash(String(password), 10);
  await transaction(async (client) => {
    await query(
      'INSERT INTO users (id, name, email, password_hash, avatar, last_login_at) VALUES ($1, $2, $3, $4, $5, now())',
      [id, name.trim(), cleanEmail(email), hash, makeAvatar(name.trim())],
      client
    );
    await query("INSERT INTO read_markers (user_id, room_key, last_read_at) VALUES ($1, 'all', now())", [id], client);
  });

  const token = await createSession(id);
  res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ', user: await findUserById(id), token: token });
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const limitKey = (req.ip || '') + ':' + cleanEmail(email);
  checkLoginLimit(limitKey, res);

  const found = await findLoginByEmail(email);
  const ok = found && password ? await bcrypt.compare(String(password), found.password_hash) : false;
  if (!ok) {
    addLoginFail(limitKey);
    res.status(401);
    throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
  if (found.account_status === 'suspended') {
    res.status(403);
    throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  }

  clearLoginFails(limitKey);
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [found.id]);
  const token = await createSession(found.id);
  res.json({ message: 'เข้าสู่ระบบสำเร็จ', user: await findUserById(found.id), token: token });
};

export const logoutUser = async (req, res) => {
  await deleteSession(req.token);
  res.json({ message: 'ออกจากระบบแล้ว' });
};

export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    res.status(400);
    throw new Error('กรุณากรอกให้ครบทุกช่อง');
  }
  if (String(newPassword).length < 6) {
    res.status(400);
    throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
  }
  if (!(await checkPassword(req.userId, oldPassword))) {
    res.status(400);
    throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }

  const hash = await bcrypt.hash(String(newPassword), 10);
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.userId, hash]);
  await query('DELETE FROM sessions WHERE user_id = $1 AND token <> $2', [req.userId, hashToken(req.token)]);
  res.json({ message: 'เปลี่ยนรหัสผ่านเรียบร้อย อุปกรณ์อื่นถูกออกจากระบบแล้ว' });
};

export function deleteOldAvatarFile(avatarUrl) {
  deleteUploadedFile(avatarUrl);
}

export async function removeUserEverywhere(req, user) {
  const groupIds = await getGroupIdsForUser(user.id);
  await query('DELETE FROM users WHERE id = $1', [user.id]);
  deleteOldAvatarFile(user.avatar);

  for (const groupId of groupIds) {
    const group = await loadGroup(groupId);
    if (group) sendGroupUpdate(req, group);
  }
}

export const deleteAccount = async (req, res) => {
  const { password } = req.body;
  const user = await findUserOr404(req.userId, res);

  if (!(await checkPassword(user.id, password))) {
    res.status(400);
    throw new Error('รหัสผ่านไม่ถูกต้อง');
  }

  const owned = await getMany('SELECT name FROM groups WHERE owner_id = $1', [user.id]);
  if (owned.length > 0) {
    res.status(400);
    throw new Error('คุณเป็นเจ้าของกลุ่ม ' + owned.map(g => g.name).join(', ') + ' กรุณาโอนหรือลบกลุ่มก่อน');
  }

  if (user.systemRole === 'administrator') {
    const row = await getOne("SELECT count(*) AS total FROM users WHERE system_role = 'administrator'");
    if (Number(row.total) <= 1) {
      res.status(400);
      throw new Error('คุณเป็น Administrator คนสุดท้าย ลบบัญชีไม่ได้');
    }
  }

  await removeUserEverywhere(req, user);
  res.json({ message: 'ลบบัญชีเรียบร้อย' });
};

export const updateProfile = async (req, res) => {
  const { name, bio, title, bannerColor } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('กรุณากรอกชื่อ');
  }
  if (name.length > 50) {
    res.status(400);
    throw new Error('ชื่อยาวเกินไป');
  }
  if ((bio || '').length > 200) {
    res.status(400);
    throw new Error('แนะนำตัวยาวเกินไป');
  }
  if ((title || '').length > 50) {
    res.status(400);
    throw new Error('ตำแหน่งยาวเกินไป');
  }
  if (bannerColor && !/^#[0-9a-fA-F]{6}$/.test(bannerColor)) {
    res.status(400);
    throw new Error('สีแบนเนอร์ไม่ถูกต้อง');
  }

  const user = await findUserOr404(req.userId, res);
  const newName = name.trim();
  let avatar = user.avatar;
  if (avatar === makeAvatar(user.name)) {
    avatar = makeAvatar(newName);
  }

  await query(
    'UPDATE users SET name = $2, bio = $3, title = $4, banner_color = COALESCE($5, banner_color), avatar = $6 WHERE id = $1',
    [user.id, newName, (bio || '').trim(), (title || '').trim(), bannerColor || null, avatar]
  );

  const updated = await findUserById(user.id);
  sendUserUpdate(req, updated);
  res.json({ message: 'บันทึกเรียบร้อย', user: updated });
};

export const removeAvatar = async (req, res) => {
  const user = await findUserOr404(req.userId, res);
  deleteOldAvatarFile(user.avatar);
  await query('UPDATE users SET avatar = $2 WHERE id = $1', [user.id, makeAvatar(user.name)]);
  const updated = await findUserById(user.id);
  sendUserUpdate(req, updated);
  res.json({ user: updated });
};

export const changeAvatar = async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('ไม่พบไฟล์รูปภาพ');
  }

  const user = await findUserOr404(req.userId, res);
  deleteOldAvatarFile(user.avatar);
  await query('UPDATE users SET avatar = $2 WHERE id = $1', [user.id, '/uploads/' + req.file.filename]);
  const updated = await findUserById(user.id);
  sendUserUpdate(req, updated);
  res.json({ message: 'เปลี่ยนรูปเรียบร้อย', user: updated });
};

export const setPresence = async (req, res) => {
  const { presence } = req.body;
  if (!PRESENCE_LIST.includes(presence)) {
    res.status(400);
    throw new Error('สถานะไม่ถูกต้อง');
  }

  await query('UPDATE users SET presence = $2 WHERE id = $1', [req.userId, presence]);
  const updated = await findUserById(req.userId);
  sendUserUpdate(req, updated);
  res.json({ user: updated });
};

export const saveSettings = async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    res.status(400);
    throw new Error('ข้อมูลการตั้งค่าไม่ถูกต้อง');
  }

  const user = await findUserOr404(req.userId, res);
  const cleanSettings = {};
  SETTING_KEYS.forEach(key => {
    if (settings[key] !== undefined) {
      cleanSettings[key] = settings[key];
    }
  });

  if (!(await canUseTheme(user, cleanSettings.theme))) {
    cleanSettings.theme = 'light';
  }
  if (cleanSettings.soundType !== undefined && !SOUND_TYPES.includes(cleanSettings.soundType)) {
    cleanSettings.soundType = 'ding';
  }
  if (cleanSettings.volume !== undefined) {
    let volume = Math.round(Number(cleanSettings.volume));
    if (!volume || volume < 0) volume = 0;
    if (volume > 100) volume = 100;
    cleanSettings.volume = volume;
  }

  await query('UPDATE users SET settings = $2 WHERE id = $1', [user.id, JSON.stringify(cleanSettings)]);
  res.json({ settings: cleanSettings });
};

export const markAsRead = async (req, res) => {
  const { key } = req.body;
  if (!key || String(key).length > 200) {
    res.status(400);
    throw new Error('กรุณาระบุห้อง');
  }

  await query(
    'INSERT INTO read_markers (user_id, room_key, last_read_at) VALUES ($1, $2, now()) ON CONFLICT (user_id, room_key) DO UPDATE SET last_read_at = now()',
    [req.userId, key]
  );
  res.json({ message: 'ok' });
};

async function countUnread(sql, params, unread, mentions) {
  const rows = await getMany(sql, params);
  rows.forEach(row => {
    if (Number(row.unread) > 0) unread[row.key] = Number(row.unread);
    if (Number(row.mentions) > 0) mentions[row.key] = Number(row.mentions);
  });
}

export const getUnread = async (req, res) => {
  const userId = req.userId;
  const { groupId } = req.query;

  let allMarker = await getOne("SELECT last_read_at FROM read_markers WHERE user_id = $1 AND room_key = 'all'", [userId]);
  if (!allMarker) {
    await query("INSERT INTO read_markers (user_id, room_key, last_read_at) VALUES ($1, 'all', now())", [userId]);
    allMarker = { last_read_at: new Date() };
  }
  const since = allMarker.last_read_at;

  const unread = {};
  const mentions = {};

  const group = groupId ? await loadGroup(groupId) : null;
  if (group && group.members.includes(userId)) {
    const channels = (await listChannels(group.id)).filter(c => canSeeChannel(group, c, userId));
    await countUnread(
      `SELECT 'channel:' || m.channel_id AS key, count(*) AS unread, count(mm.user_id) AS mentions
       FROM messages m
       LEFT JOIN read_markers rm ON rm.user_id = $1 AND rm.room_key = 'channel:' || m.channel_id
       LEFT JOIN message_mentions mm ON mm.message_id = m.id AND mm.user_id = $1
       WHERE m.channel_id = ANY($2) AND m.author_id IS DISTINCT FROM $1 AND m.created_at > COALESCE(rm.last_read_at, $3)
       GROUP BY m.channel_id`,
      [userId, channels.map(c => c.id), since],
      unread,
      mentions
    );

    const projectIds = group.projects.filter(p => canSeeProject(group, p, userId)).map(p => p.id);
    await countUnread(
      `SELECT 'project:' || pc.project_id AS key, count(*) AS unread, count(mm.user_id) AS mentions
       FROM messages m
       JOIN project_channels pc ON pc.id = m.project_channel_id
       LEFT JOIN read_markers rm ON rm.user_id = $1 AND rm.room_key = 'project:' || pc.project_id
       LEFT JOIN message_mentions mm ON mm.message_id = m.id AND mm.user_id = $1
       WHERE pc.project_id = ANY($2) AND m.author_id IS DISTINCT FROM $1 AND m.created_at > COALESCE(rm.last_read_at, $3)
       GROUP BY pc.project_id`,
      [userId, projectIds, since],
      unread,
      mentions
    );
  }

  await countUnread(
    `SELECT CASE WHEN c.type = 'dm' THEN 'dm:' || other.user_id ELSE 'gdm:' || c.id END AS key,
            count(*) AS unread, count(mm.user_id) AS mentions
     FROM conversations c
     JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = $1
     LEFT JOIN conversation_participants other ON c.type = 'dm' AND other.conversation_id = c.id AND other.user_id <> $1
     JOIN messages m ON m.conversation_id = c.id
     LEFT JOIN read_markers rm ON rm.user_id = $1 AND rm.room_key = CASE WHEN c.type = 'dm' THEN 'dm:' || other.user_id ELSE 'gdm:' || c.id END
     LEFT JOIN message_mentions mm ON mm.message_id = m.id AND mm.user_id = $1
     WHERE m.author_id IS DISTINCT FROM $1 AND m.created_at > COALESCE(rm.last_read_at, $2)
     GROUP BY 1`,
    [userId, since],
    unread,
    mentions
  );

  res.json({ unread: unread, mentions: mentions });
};

export const getOverview = async (req, res) => {
  const user = await findUserOr404(req.userId, res);
  const userId = user.id;
  const myGroups = await loadGroups(await getGroupIdsForUser(userId));

  const activity = getLastDays(14);
  const days = await getMany(
    "SELECT to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS day, count(*) AS total FROM messages WHERE author_id = $1 AND created_at > now() - interval '15 days' GROUP BY 1",
    [userId]
  );
  days.forEach(row => {
    const day = activity.find(d => d.date === row.day);
    if (day) day.count = Number(row.total);
  });

  const stats = await getOne(
    `SELECT
       (SELECT count(*) FROM messages WHERE author_id = $1) AS messages_sent,
       (SELECT count(*) FROM messages WHERE author_id = $1 AND parent_id IS NOT NULL) AS thread_replies,
       (SELECT count(*) FROM message_mentions mm JOIN messages m ON m.id = mm.message_id WHERE mm.user_id = $1 AND m.author_id IS DISTINCT FROM $1) AS mentions_received,
       (SELECT count(*) FROM message_reactions r JOIN messages m ON m.id = r.message_id WHERE m.author_id = $1 AND r.user_id <> $1) AS reactions_received,
       (SELECT count(DISTINCT c.id) FROM conversations c JOIN conversation_participants p ON p.conversation_id = c.id AND p.user_id = $1
          WHERE c.type = 'dm' AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)) AS dm_partners`,
    [userId]
  );

  const groupCounts = await getMany(
    `SELECT c.group_id, count(*) AS total FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.author_id = $1 GROUP BY c.group_id
     UNION ALL
     SELECT p.group_id, count(*) AS total FROM messages m JOIN project_channels pc ON pc.id = m.project_channel_id JOIN projects p ON p.id = pc.project_id WHERE m.author_id = $1 GROUP BY p.group_id`,
    [userId]
  );
  const groupMessageCount = {};
  groupCounts.forEach(row => {
    groupMessageCount[row.group_id] = (groupMessageCount[row.group_id] || 0) + Number(row.total);
  });

  const recentRows = await getMany(
    `SELECT m.id, m.text, m.created_at, c.name AS channel_name, g1.name AS group_name1, pc.name AS project_channel_name, p.name AS project_name, g2.name AS group_name2, conv.type AS conv_type, conv.name AS conv_name
     FROM messages m
     LEFT JOIN channels c ON c.id = m.channel_id
     LEFT JOIN groups g1 ON g1.id = c.group_id
     LEFT JOIN project_channels pc ON pc.id = m.project_channel_id
     LEFT JOIN projects p ON p.id = pc.project_id
     LEFT JOIN groups g2 ON g2.id = p.group_id
     LEFT JOIN conversations conv ON conv.id = m.conversation_id
     WHERE m.author_id = $1 ORDER BY m.created_at DESC LIMIT 6`,
    [userId]
  );
  const recentMessages = recentRows.map(row => {
    let roomName = 'ข้อความส่วนตัว';
    if (row.channel_name) roomName = row.group_name1 + ' · #' + row.channel_name;
    if (row.project_channel_name) roomName = row.group_name2 + ' · ' + row.project_name + ' / #' + row.project_channel_name;
    if (row.conv_type === 'group') roomName = 'แชทกลุ่มส่วนตัว · ' + (row.conv_name || 'แชทกลุ่ม');
    return { id: row.id, text: row.text || 'ส่งไฟล์แนบ', createdAt: toIso(row.created_at), roomName: roomName };
  });

  let tasksAssigned = 0;
  let tasksDone = 0;
  const openTasks = [];
  myGroups.forEach(group => {
    group.projects.forEach(project => {
      const columns = project.columns || [];
      const lastColumn = columns[columns.length - 1];
      project.tasks.forEach(task => {
        if (!task.assigneeIds.includes(userId)) return;
        tasksAssigned = tasksAssigned + 1;
        if (project.archived) return;
        if (lastColumn && task.status === lastColumn.id) {
          tasksDone = tasksDone + 1;
          return;
        }
        const column = columns.find(c => c.id === task.status);
        openTasks.push({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate || null,
          priority: task.priority || null,
          columnTitle: column ? column.title : '-',
          projectId: project.id,
          projectName: project.name,
          groupId: group.id,
          groupName: group.name
        });
      });
    });
  });

  const groups = myGroups.map(group => {
    const role = getMemberRole(group, userId);
    return {
      id: group.id,
      name: group.name,
      color: group.color,
      icon: group.icon || null,
      visibility: group.visibility,
      roleName: role.name,
      roleColor: role.color,
      nickname: group.nicknames[userId] || '',
      memberCount: group.members.length,
      messageCount: groupMessageCount[group.id] || 0
    };
  });
  groups.sort((a, b) => b.messageCount - a.messageCount);

  res.json({
    memberSince: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    stats: {
      groupsJoined: myGroups.length,
      groupsOwned: myGroups.filter(g => g.ownerId === userId).length,
      messagesSent: Number(stats.messages_sent),
      threadReplies: Number(stats.thread_replies),
      mentionsReceived: Number(stats.mentions_received),
      reactionsReceived: Number(stats.reactions_received),
      tasksAssigned: tasksAssigned,
      tasksDone: tasksDone,
      dmPartners: Number(stats.dm_partners)
    },
    activity: activity,
    groups: groups,
    openTasks: openTasks.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0, 8),
    recentMessages: recentMessages
  });
};

export const getNotifications = async (req, res) => {
  const rows = await getMany('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.userId]);
  res.json(rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    target: row.target,
    read: row.is_read,
    createdAt: toIso(row.created_at)
  })));
};

export const readNotifications = async (req, res) => {
  const { notificationId } = req.body;
  if (notificationId) {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = $2', [req.userId, notificationId]);
  } else {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.userId]);
  }
  res.json({ message: 'ok' });
};

export const forgotPassword = async (req, res) => {
  const limitKey = 'reset:' + (req.ip || '');
  checkLoginLimit(limitKey, res);
  addLoginFail(limitKey);

  const user = await findLoginByEmail(req.body.email);
  const result = { message: 'ถ้าอีเมลนี้มีในระบบ เราได้ส่งรหัสยืนยัน 6 หลักไปแล้ว' };

  if (user) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    await query("UPDATE users SET reset_code = $2, reset_expires = now() + interval '15 minutes' WHERE id = $1", [user.id, codeHash]);

    console.log('[อีเมลจำลอง] รหัสรีเซ็ตรหัสผ่านของ ' + user.email + ' คือ ' + code);
    if (process.env.NODE_ENV !== 'production') {
      result.devCode = code;
    }
  }

  res.json(result);
};

export const resetPasswordWithCode = async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 6) {
    res.status(400);
    throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
  }

  const limitKey = 'reset-code:' + cleanEmail(email);
  checkLoginLimit(limitKey, res);

  const user = await findLoginByEmail(email);
  const expired = !user || !user.reset_expires || new Date(user.reset_expires) < new Date();
  const codeOk = !expired && user.reset_code && (await bcrypt.compare(String(code || '').trim(), user.reset_code));
  if (!codeOk) {
    addLoginFail(limitKey);
    res.status(400);
    throw new Error('รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว');
  }

  clearLoginFails(limitKey);
  const hash = await bcrypt.hash(String(newPassword), 10);
  await query('UPDATE users SET password_hash = $2, reset_code = NULL, reset_expires = NULL WHERE id = $1', [user.id, hash]);
  await query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
  res.json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อย เข้าสู่ระบบได้เลย' });
};

export const setMuted = async (req, res) => {
  const { key, muted } = req.body;
  if (!key || String(key).length > 200) {
    res.status(400);
    throw new Error('กรุณาระบุห้อง');
  }

  if (muted) {
    await query('INSERT INTO muted_rooms (user_id, room_key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.userId, key]);
  } else {
    await query('DELETE FROM muted_rooms WHERE user_id = $1 AND room_key = $2', [req.userId, key]);
  }
  res.json({ user: await findUserById(req.userId) });
};

export const getBlocks = async (req, res) => {
  res.json({ blockedIds: await getBlockedIds(req.userId) });
};

export const setBlocked = async (req, res) => {
  const { targetId, blocked } = req.body;
  if (!targetId || targetId === req.userId) {
    res.status(400);
    throw new Error('บล็อกผู้ใช้นี้ไม่ได้');
  }
  if (!(await findUserById(targetId))) {
    res.status(404);
    throw new Error('ไม่พบผู้ใช้');
  }

  if (blocked) {
    await query('INSERT INTO user_blocks (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.userId, targetId]);
  } else {
    await query('DELETE FROM user_blocks WHERE user_id = $1 AND blocked_user_id = $2', [req.userId, targetId]);
  }

  const list = await getBlockedIds(req.userId);
  sendToUser(req, req.userId, 'blocks:changed', { blockedIds: list });
  res.json({ blockedIds: list });
};

export const setCustomTheme = async (req, res) => {
  const { accent, background, mode } = req.body;
  const user = await findUserOr404(req.userId, res);

  if (!(await getPerks(user)).customTheme) {
    res.status(403);
    throw new Error('ระดับของคุณยังสร้างธีมเองไม่ได้ อัปเกรด VIP เพื่อใช้งาน');
  }
  const isHex = (value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
  if (!isHex(accent) || !isHex(background)) {
    res.status(400);
    throw new Error('รหัสสีไม่ถูกต้อง');
  }

  const theme = { accent: accent.toLowerCase(), background: background.toLowerCase(), mode: mode === 'dark' ? 'dark' : 'light' };
  const settings = { ...user.settings, theme: 'custom' };
  await query('UPDATE users SET custom_theme = $2, settings = $3 WHERE id = $1', [user.id, JSON.stringify(theme), JSON.stringify(settings)]);

  const updated = await findUserById(user.id);
  sendToUser(req, user.id, 'user:updated', updated);
  res.json({ user: updated, settings: settings });
};
