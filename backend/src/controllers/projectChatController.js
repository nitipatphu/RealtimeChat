import { query } from '../config/database.js';
import { requireNotTimedOut } from '../utils/moderation.js';
import { ALLOWED_EMOJIS } from '../utils/reactions.js';
import { findMentions } from '../utils/mentions.js';
import { cleanAttachments } from '../utils/attachments.js';
import { sendToUsers } from '../utils/socketEvents.js';
import { hasPermission, getProjectViewerIds } from '../utils/permissions.js';
import { addGroupLog, getUserName } from '../utils/logs.js';
import { notifyMentions, notifyThreadReply } from '../utils/notifications.js';
import { findUserById, findUsersByIds } from '../models/userModel.js';
import {
  getMessageRow, getMessagePage, getPinnedMessages, createMessage, updateMessageText, deleteMessage,
  toggleReaction, togglePin, votePoll, cleanPoll, findParent, getThreadUserIds
} from '../models/messageModel.js';

function findChannel(req, res) {
  const channel = req.project.channels.find(c => c.id === req.params.channelId);
  if (!channel) {
    res.status(404);
    throw new Error('ไม่พบ Channel นี้');
  }
  return channel;
}

async function findProjectMessage(channel, msgId, res) {
  const row = await getMessageRow(msgId);
  if (!row || row.project_channel_id !== channel.id) {
    res.status(404);
    throw new Error('ไม่พบข้อความนี้');
  }
  return row;
}

function sendToProject(req, eventName, data) {
  sendToUsers(req, getProjectViewerIds(req.group, req.project), eventName, {
    groupId: req.group.id,
    projectId: req.project.id,
    ...data
  });
}

export const getProjectChannels = async (req, res) => {
  res.json(req.project.channels);
};

export const getProjectMessages = async (req, res) => {
  const channel = findChannel(req, res);
  res.json(await getMessagePage('project_channel_id', channel.id, req.query.before, req.query.limit));
};

export const getProjectPins = async (req, res) => {
  const channel = findChannel(req, res);
  res.json(await getPinnedMessages('project_channel_id', channel.id));
};

export const addProjectMessage = async (req, res) => {
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

  const { group, project } = req;
  const channel = findChannel(req, res);
  requireNotTimedOut(group, req.userId, res);
  if (project.archived) {
    res.status(400);
    throw new Error('Project นี้ถูกเก็บถาวรแล้ว ส่งข้อความไม่ได้');
  }

  const parent = parentId ? await findParent('project_channel_id', channel.id, parentId) : null;
  if (parentId && (!parent || parent.parent_id)) {
    res.status(400);
    throw new Error('ไม่พบข้อความที่จะตอบกลับ');
  }

  const user = await findUserById(req.userId);
  const members = await findUsersByIds(getProjectViewerIds(group, project));
  const threadUserIds = parent ? await getThreadUserIds(parent.id) : [];

  const message = await createMessage({
    projectChannelId: channel.id,
    parentId: parent ? parent.id : null,
    author: user,
    text: cleanText,
    attachments: attachments,
    mentions: findMentions(cleanText, members, hasPermission(group, req.userId, 'mention_everyone')),
    poll: poll
  });

  const roomName = project.name + ' / #' + channel.name;
  const target = { type: 'project', groupId: group.id, id: project.id, channelId: channel.id };
  await notifyMentions(req, message, user.name, roomName, target);
  if (parent) {
    await notifyThreadReply(req, parent.author_id, threadUserIds, message, user.name, roomName, target);
  }

  sendToProject(req, 'project-message:new', { channelId: channel.id, message: message });
  res.status(201).json(message);
};

export const updateProjectMessage = async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 4000);
  if (!text) {
    res.status(400);
    throw new Error('กรุณาพิมพ์ข้อความ');
  }

  const channel = findChannel(req, res);
  const row = await findProjectMessage(channel, req.params.msgId, res);
  if (row.author_id !== req.userId) {
    res.status(403);
    throw new Error('แก้ไขได้เฉพาะข้อความของตัวเอง');
  }

  const members = await findUsersByIds(getProjectViewerIds(req.group, req.project));
  const mentions = findMentions(text, members, hasPermission(req.group, req.userId, 'mention_everyone'));
  const message = await updateMessageText(row.id, text, mentions);

  sendToProject(req, 'project-message:updated', { channelId: channel.id, message: message });
  res.json(message);
};

export const deleteProjectMessage = async (req, res) => {
  const channel = findChannel(req, res);
  const row = await findProjectMessage(channel, req.params.msgId, res);

  const isMine = row.author_id === req.userId;
  if (!isMine && !hasPermission(req.group, req.userId, 'manage_messages')) {
    res.status(403);
    throw new Error('ลบได้เฉพาะข้อความของตัวเอง');
  }

  await deleteMessage(row.id);
  if (!isMine) {
    await addGroupLog(req.group.id, req.userId, 'message_delete', (await getUserName(req.userId)) + ' ลบข้อความของ ' + row.author_name + ' ใน Project ' + req.project.name);
  }

  sendToProject(req, 'project-message:deleted', { channelId: channel.id, messageId: row.id });
  res.json({ message: 'ลบสำเร็จ' });
};

export const reactToProjectMessage = async (req, res) => {
  const { emoji } = req.body;
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    res.status(400);
    throw new Error('ไม่รองรับอีโมจินี้');
  }

  const channel = findChannel(req, res);
  const row = await findProjectMessage(channel, req.params.msgId, res);
  const message = await toggleReaction(row.id, req.userId, emoji);

  sendToProject(req, 'project-message:updated', { channelId: channel.id, message: message });
  res.json(message);
};

export const createProjectChannel = async (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
  if (!name) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อ Channel');
  }
  if (req.project.archived) {
    res.status(400);
    throw new Error('Project นี้ถูกเก็บถาวรแล้ว สร้างห้องไม่ได้');
  }
  if (req.project.channels.length >= 30) {
    res.status(400);
    throw new Error('สร้างห้องได้สูงสุด 30 ห้องต่อโปรเจกต์');
  }

  const channel = { id: 'pc-' + Date.now(), name: name };
  await query('INSERT INTO project_channels (id, project_id, name) VALUES ($1, $2, $3)', [channel.id, req.project.id, channel.name]);

  sendToProject(req, 'project-channel:created', { channel: channel });
  res.status(201).json(channel);
};

export const deleteProjectChannel = async (req, res) => {
  if (req.project.channels.length <= 1) {
    res.status(400);
    throw new Error('ต้องมีอย่างน้อย 1 ห้องในโปรเจกต์');
  }

  const channel = findChannel(req, res);
  await query('DELETE FROM project_channels WHERE id = $1', [channel.id]);

  sendToProject(req, 'project-channel:deleted', { channelId: channel.id });
  res.json({ message: 'ลบสำเร็จ' });
};

export const pinProjectMessage = async (req, res) => {
  if (!hasPermission(req.group, req.userId, 'manage_messages')) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์ปักหมุดข้อความ');
  }

  const channel = findChannel(req, res);
  const row = await findProjectMessage(channel, req.params.msgId, res);
  const message = await togglePin(row.id, req.userId);

  sendToProject(req, 'project-message:updated', { channelId: channel.id, message: message });
  res.json(message);
};

export const voteProjectMessage = async (req, res) => {
  const channel = findChannel(req, res);
  const row = await findProjectMessage(channel, req.params.msgId, res);
  const message = await votePoll(row.id, req.body.optionId, req.userId);
  if (!message) {
    res.status(400);
    throw new Error('ไม่พบตัวเลือกนี้');
  }

  sendToProject(req, 'project-message:updated', { channelId: channel.id, message: message });
  res.json(message);
};
