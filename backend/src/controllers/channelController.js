import { query, transaction } from '../config/database.js';
import { ALLOWED_EMOJIS } from '../utils/reactions.js';
import { findMentions } from '../utils/mentions.js';
import { cleanAttachments } from '../utils/attachments.js';
import { sendToGroup, sendToUsers } from '../utils/socketEvents.js';
import { hasPermission, canSeeChannel, getChannelViewerIds } from '../utils/permissions.js';
import { addGroupLog, getUserName } from '../utils/logs.js';
import { notifyMentions, notifyThreadReply } from '../utils/notifications.js';
import { requireNotTimedOut } from '../utils/moderation.js';
import { loadGroup, getChannel, listChannels } from '../models/groupModel.js';
import { findUserById, findUsersByIds, isSystemAdmin } from '../models/userModel.js';
import {
  getMessageRow, getMessagePage, getPinnedMessages, createMessage, updateMessageText, deleteMessage as removeMessage,
  toggleReaction, togglePin, votePoll, cleanPoll, findParent, getThreadUserIds
} from '../models/messageModel.js';

function cleanChannelName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
}

function sendChannelEvent(req, group, channel, eventName, data) {
  if ((channel.allowedRoleIds || []).length === 0) {
    sendToGroup(req, group.id, eventName, data);
  } else {
    sendToUsers(req, getChannelViewerIds(group, channel), eventName, data);
  }
}

async function loadChannel(channelId, res) {
  const channel = await getChannel(channelId);
  if (!channel) {
    res.status(404);
    throw new Error('ไม่พบ Channel นี้');
  }
  const group = await loadGroup(channel.groupId);
  if (!group) {
    res.status(404);
    throw new Error('ไม่พบ Group นี้');
  }
  return { channel, group };
}

async function requireChannelAccess(group, channel, userId, res, allowAdminRead) {
  if (allowAdminRead && (await isSystemAdmin(userId))) return;
  if (!canSeeChannel(group, channel, userId)) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์เข้าห้องนี้');
  }
}

function requireManageChannels(group, userId, res) {
  if (!hasPermission(group, userId, 'manage_channels')) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์จัดการ Channel');
  }
}

async function findChannelMessage(channel, msgId, res) {
  const row = await getMessageRow(msgId);
  if (!row || row.channel_id !== channel.id) {
    res.status(404);
    throw new Error('ไม่พบข้อความนี้');
  }
  return row;
}

function cleanRoleIds(group, roleIds) {
  if (!Array.isArray(roleIds)) return [];
  const validIds = group.roles.map(r => r.id);
  return roleIds.filter(id => validIds.includes(id));
}

function cleanCategoryId(group, categoryId) {
  if (!categoryId) return null;
  return group.categories.some(c => c.id === categoryId) ? categoryId : null;
}

export const getChannels = async (req, res) => {
  const { groupId } = req.query;
  const group = groupId ? await loadGroup(groupId) : null;
  if (!group) {
    res.status(404);
    throw new Error('ไม่พบ Group นี้');
  }

  const adminReading = await isSystemAdmin(req.userId);
  if (!adminReading && !group.members.includes(req.userId)) {
    res.status(403);
    throw new Error('คุณไม่ได้เป็นสมาชิกของกลุ่มนี้');
  }

  let list = await listChannels(group.id);
  if (list.length === 0) {
    await query("INSERT INTO channels (id, group_id, name) VALUES ($1, $2, 'general')", ['ch-' + Date.now(), group.id]);
    list = await listChannels(group.id);
  }
  if (!adminReading) {
    list = list.filter(c => canSeeChannel(group, c, req.userId));
  }
  res.json(list);
};

export const createChannel = async (req, res) => {
  const { name, parentId, groupId, allowedRoleIds, categoryId } = req.body;
  if (!cleanChannelName(name)) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อ Channel');
  }

  const group = groupId ? await loadGroup(groupId) : null;
  if (!group) {
    res.status(404);
    throw new Error('ไม่พบ Group นี้');
  }
  requireManageChannels(group, req.userId, res);

  let parent = null;
  if (parentId) {
    parent = await getChannel(parentId);
    if (!parent || parent.groupId !== group.id || parent.parentId) {
      res.status(400);
      throw new Error('Channel หลักไม่ถูกต้อง');
    }
  }

  const id = 'ch-' + Date.now();
  const roleIds = cleanRoleIds(group, allowedRoleIds);
  await transaction(async (client) => {
    await query(
      'INSERT INTO channels (id, group_id, parent_id, category_id, name) VALUES ($1, $2, $3, $4, $5)',
      [id, group.id, parent ? parent.id : null, parent ? null : cleanCategoryId(group, categoryId), cleanChannelName(name)],
      client
    );
    for (const roleId of roleIds) {
      await query('INSERT INTO channel_allowed_roles (channel_id, role_id) VALUES ($1, $2)', [id, roleId], client);
    }
  });

  const channel = await getChannel(id);
  const privateText = roleIds.length > 0 ? ' (ส่วนตัว)' : '';
  await addGroupLog(group.id, req.userId, 'channel_create', (await getUserName(req.userId)) + ' สร้าง Channel #' + channel.name + privateText);

  sendChannelEvent(req, group, channel, 'channel:created', { channel: channel });
  res.status(201).json(channel);
};

export const updateChannel = async (req, res) => {
  const { name, allowedRoleIds, categoryId } = req.body;
  if (!cleanChannelName(name)) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อ Channel');
  }

  const { channel, group } = await loadChannel(req.params.id, res);
  requireManageChannels(group, req.userId, res);

  await transaction(async (client) => {
    await query('UPDATE channels SET name = $2 WHERE id = $1', [channel.id, cleanChannelName(name)], client);
    if (Array.isArray(allowedRoleIds)) {
      await query('DELETE FROM channel_allowed_roles WHERE channel_id = $1', [channel.id], client);
      for (const roleId of cleanRoleIds(group, allowedRoleIds)) {
        await query('INSERT INTO channel_allowed_roles (channel_id, role_id) VALUES ($1, $2)', [channel.id, roleId], client);
      }
    }
    if (categoryId !== undefined && !channel.parentId) {
      await query('UPDATE channels SET category_id = $2 WHERE id = $1', [channel.id, cleanCategoryId(group, categoryId)], client);
    }
  });

  const updated = await getChannel(channel.id);
  const renamed = channel.name !== updated.name ? ' (ชื่อใหม่ #' + updated.name + ')' : '';
  await addGroupLog(group.id, req.userId, 'channel_rename', (await getUserName(req.userId)) + ' แก้ไข Channel #' + channel.name + renamed);

  sendToGroup(req, group.id, 'channel:updated', { channel: updated });
  res.json(updated);
};

export const deleteChannel = async (req, res) => {
  const { channel, group } = await loadChannel(req.params.id, res);
  requireManageChannels(group, req.userId, res);

  await query('DELETE FROM channels WHERE id = $1', [channel.id]);
  await addGroupLog(group.id, req.userId, 'channel_delete', (await getUserName(req.userId)) + ' ลบ Channel #' + channel.name);

  sendToGroup(req, group.id, 'channel:deleted', { channelId: channel.id });
  res.json({ message: 'ลบสำเร็จ' });
};

export const addMessage = async (req, res) => {
  const { text, parentId } = req.body;
  const attachments = cleanAttachments(req.body.attachments);
  const cleanText = String(text || '').trim().slice(0, 4000);
  const poll = cleanPoll(req.body.poll);

  if (req.body.poll && !poll) {
    res.status(400);
    throw new Error('โพลต้องมีคำถาม และตัวเลือก 2-6 ข้อ');
  }
  if (!cleanText && attachments.length === 0 && !poll) {
    res.status(400);
    throw new Error('กรุณาพิมพ์ข้อความ');
  }

  const { channel, group } = await loadChannel(req.params.id, res);
  await requireChannelAccess(group, channel, req.userId, res, false);
  requireNotTimedOut(group, req.userId, res);

  const parent = parentId ? await findParent('channel_id', channel.id, parentId) : null;
  if (parentId && (!parent || parent.parent_id)) {
    res.status(400);
    throw new Error('ไม่พบข้อความที่จะตอบกลับ');
  }

  const user = await findUserById(req.userId);
  const members = await findUsersByIds(getChannelViewerIds(group, channel));
  const threadUserIds = parent ? await getThreadUserIds(parent.id) : [];

  const message = await createMessage({
    channelId: channel.id,
    parentId: parent ? parent.id : null,
    author: user,
    text: cleanText,
    attachments: attachments,
    mentions: findMentions(cleanText, members, hasPermission(group, req.userId, 'mention_everyone')),
    poll: poll
  });

  const target = { type: 'channel', groupId: group.id, id: channel.id };
  await notifyMentions(req, message, user.name, '#' + channel.name, target);
  if (parent) {
    await notifyThreadReply(req, parent.author_id, threadUserIds, message, user.name, '#' + channel.name, target);
  }

  sendChannelEvent(req, group, channel, 'message:new', { channelId: channel.id, message: message });
  res.status(201).json(message);
};

export const updateMessage = async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 4000);
  if (!text) {
    res.status(400);
    throw new Error('กรุณาพิมพ์ข้อความ');
  }

  const { channel, group } = await loadChannel(req.params.id, res);
  const row = await findChannelMessage(channel, req.params.msgId, res);
  if (row.author_id !== req.userId) {
    res.status(403);
    throw new Error('แก้ไขได้เฉพาะข้อความของตัวเอง');
  }

  const members = await findUsersByIds(getChannelViewerIds(group, channel));
  const mentions = findMentions(text, members, hasPermission(group, req.userId, 'mention_everyone'));
  const message = await updateMessageText(row.id, text, mentions);

  sendChannelEvent(req, group, channel, 'message:updated', { channelId: channel.id, message: message });
  res.json(message);
};

export const deleteMessage = async (req, res) => {
  const { channel, group } = await loadChannel(req.params.id, res);
  const row = await findChannelMessage(channel, req.params.msgId, res);

  const isMine = row.author_id === req.userId;
  if (!isMine && !hasPermission(group, req.userId, 'manage_messages')) {
    res.status(403);
    throw new Error('ลบได้เฉพาะข้อความของตัวเอง');
  }

  await removeMessage(row.id);
  if (!isMine) {
    await addGroupLog(group.id, req.userId, 'message_delete', (await getUserName(req.userId)) + ' ลบข้อความของ ' + row.author_name + ' ใน #' + channel.name);
  }

  sendChannelEvent(req, group, channel, 'message:deleted', { channelId: channel.id, messageId: row.id });
  res.json({ message: 'ลบสำเร็จ' });
};

export const reactToMessage = async (req, res) => {
  const { emoji } = req.body;
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    res.status(400);
    throw new Error('ไม่รองรับอีโมจินี้');
  }

  const { channel, group } = await loadChannel(req.params.id, res);
  await requireChannelAccess(group, channel, req.userId, res, false);
  const row = await findChannelMessage(channel, req.params.msgId, res);

  const message = await toggleReaction(row.id, req.userId, emoji);
  sendChannelEvent(req, group, channel, 'message:updated', { channelId: channel.id, message: message });
  res.json(message);
};

export const voteMessage = async (req, res) => {
  const { channel, group } = await loadChannel(req.params.id, res);
  await requireChannelAccess(group, channel, req.userId, res, false);
  const row = await findChannelMessage(channel, req.params.msgId, res);

  const message = await votePoll(row.id, req.body.optionId, req.userId);
  if (!message) {
    res.status(400);
    throw new Error('ไม่พบตัวเลือกนี้');
  }

  sendChannelEvent(req, group, channel, 'message:updated', { channelId: channel.id, message: message });
  res.json(message);
};

export const getChannelMessages = async (req, res) => {
  const { before, limit } = req.query;
  const { channel, group } = await loadChannel(req.params.id, res);
  await requireChannelAccess(group, channel, req.userId, res, true);
  res.json(await getMessagePage('channel_id', channel.id, before, limit));
};

export const getChannelPins = async (req, res) => {
  const { channel, group } = await loadChannel(req.params.id, res);
  await requireChannelAccess(group, channel, req.userId, res, true);
  res.json(await getPinnedMessages('channel_id', channel.id));
};

export const pinMessage = async (req, res) => {
  const { channel, group } = await loadChannel(req.params.id, res);
  if (!hasPermission(group, req.userId, 'manage_messages')) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์ปักหมุดข้อความ');
  }
  const row = await findChannelMessage(channel, req.params.msgId, res);

  const message = await togglePin(row.id, req.userId);
  const action = message.pinned ? 'ปักหมุด' : 'เลิกปักหมุด';
  await addGroupLog(group.id, req.userId, 'message_pin', (await getUserName(req.userId)) + ' ' + action + 'ข้อความของ ' + row.author_name + ' ใน #' + channel.name);

  sendChannelEvent(req, group, channel, 'message:updated', { channelId: channel.id, message: message });
  res.json(message);
};
