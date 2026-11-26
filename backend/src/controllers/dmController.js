import { query, getOne, transaction } from '../config/database.js';
import { cleanAttachments } from '../utils/attachments.js';
import { findUserById, isBlocked } from '../models/userModel.js';
import { getMessageRow, getMessagePage, createMessage, updateMessageText, deleteMessage, findParent } from '../models/messageModel.js';

function getConversationId(userA, userB) {
  const ids = [userA, userB].sort();
  return 'dm-' + ids[0] + '__' + ids[1];
}

async function ensureConversation(userId, otherUserId) {
  const id = getConversationId(userId, otherUserId);
  const existing = await getOne('SELECT id FROM conversations WHERE id = $1', [id]);
  if (existing) return id;

  await transaction(async (client) => {
    await query("INSERT INTO conversations (id, type) VALUES ($1, 'dm') ON CONFLICT DO NOTHING", [id], client);
    await query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING', [id, userId, otherUserId], client);
  });
  return id;
}

function sendToBothUsers(req, conversationId, userA, userB, eventName, data) {
  const io = req.app.get('io');
  if (!io) return;
  io.to('user:' + userA).to('user:' + userB).emit(eventName, { conversationId: conversationId, ...data });
}

async function loadOther(req, res) {
  const other = await findUserById(req.params.otherUserId);
  if (!other || other.id === req.userId) {
    res.status(404);
    throw new Error('ไม่พบผู้ใช้');
  }
  return other;
}

async function findDmMessage(conversationId, msgId, res) {
  const row = await getMessageRow(msgId);
  if (!row || row.conversation_id !== conversationId) {
    res.status(404);
    throw new Error('ไม่พบข้อความนี้');
  }
  return row;
}

export const getDmMessages = async (req, res) => {
  const other = await loadOther(req, res);
  const conversationId = getConversationId(req.userId, other.id);
  const page = await getMessagePage('conversation_id', conversationId, req.query.before, req.query.limit);
  res.json({ conversationId: conversationId, messages: page.messages, hasMore: page.hasMore });
};

export const addDmMessage = async (req, res) => {
  const { text, parentId } = req.body;
  const attachments = cleanAttachments(req.body.attachments);
  const cleanText = String(text || '').trim().slice(0, 4000);
  if (!cleanText && attachments.length === 0) {
    res.status(400);
    throw new Error('กรุณาพิมพ์ข้อความ');
  }

  const other = await loadOther(req, res);
  if (await isBlocked(req.userId, other.id)) {
    res.status(403);
    throw new Error('คุณบล็อกผู้ใช้นี้อยู่ ปลดบล็อกก่อนจึงจะส่งข้อความได้');
  }
  if (await isBlocked(other.id, req.userId)) {
    res.status(403);
    throw new Error('ส่งข้อความถึงผู้ใช้นี้ไม่ได้');
  }

  const conversationId = await ensureConversation(req.userId, other.id);
  const parent = parentId ? await findParent('conversation_id', conversationId, parentId) : null;
  if (parentId && (!parent || parent.parent_id)) {
    res.status(400);
    throw new Error('ไม่พบข้อความที่จะตอบกลับ');
  }

  const me = await findUserById(req.userId);
  const message = await createMessage({
    idPrefix: 'dmm',
    conversationId: conversationId,
    parentId: parent ? parent.id : null,
    author: me,
    text: cleanText,
    attachments: attachments
  });

  sendToBothUsers(req, conversationId, me.id, other.id, 'dm:new', { message: message });
  res.status(201).json(message);
};

export const updateDmMessage = async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 4000);
  if (!text) {
    res.status(400);
    throw new Error('กรุณาพิมพ์ข้อความ');
  }

  const other = await loadOther(req, res);
  const conversationId = getConversationId(req.userId, other.id);
  const row = await findDmMessage(conversationId, req.params.msgId, res);
  if (row.author_id !== req.userId) {
    res.status(403);
    throw new Error('แก้ไขได้เฉพาะข้อความของตัวเอง');
  }

  const message = await updateMessageText(row.id, text, []);
  sendToBothUsers(req, conversationId, req.userId, other.id, 'dm:updated', { message: message });
  res.json(message);
};

export const deleteDmMessage = async (req, res) => {
  const other = await loadOther(req, res);
  const conversationId = getConversationId(req.userId, other.id);
  const row = await findDmMessage(conversationId, req.params.msgId, res);
  if (row.author_id !== req.userId) {
    res.status(403);
    throw new Error('ลบได้เฉพาะข้อความของตัวเอง');
  }

  await deleteMessage(row.id);
  sendToBothUsers(req, conversationId, req.userId, other.id, 'dm:deleted', { messageId: row.id });
  res.json({ message: 'ลบสำเร็จ' });
};
