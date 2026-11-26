import { query, getOne, getMany, transaction } from '../config/database.js';
import { cleanAttachments } from '../utils/attachments.js';
import { ALLOWED_EMOJIS } from '../utils/reactions.js';
import { sendToUsers } from '../utils/socketEvents.js';
import { addNotification } from '../utils/notifications.js';
import { getUserName } from '../utils/logs.js';
import { makeId } from '../utils/id.js';
import { findMentions } from '../utils/mentions.js';
import { findUserById, findUsersByIds, toIso } from '../models/userModel.js';
import { getMessageRow, getMessagePage, createMessage, updateMessageText, deleteMessage, toggleReaction, findParent } from '../models/messageModel.js';

async function lastMessageOf(conversationId) {
  const row = await getOne(
    'SELECT text, author_id, author_name, created_at FROM messages WHERE conversation_id = $1 AND parent_id IS NULL ORDER BY created_at DESC LIMIT 1',
    [conversationId]
  );
  if (!row) return null;
  return { text: row.text || 'ไฟล์แนบ', authorId: row.author_id, author: row.author_name, createdAt: toIso(row.created_at) };
}

async function loadChatInfo(chatId) {
  const chat = await getOne("SELECT * FROM conversations WHERE id = $1 AND type = 'group'", [chatId]);
  if (!chat) return null;
  const people = await getMany('SELECT user_id FROM conversation_participants WHERE conversation_id = $1 ORDER BY joined_at', [chatId]);
  return {
    type: 'gdm',
    id: chat.id,
    name: chat.name || '',
    ownerId: chat.owner_id,
    participants: people.map(p => p.user_id),
    createdAt: toIso(chat.created_at),
    lastMessage: await lastMessageOf(chat.id)
  };
}

async function loadChat(chatId, userId, res) {
  const chat = await loadChatInfo(chatId);
  if (!chat) {
    res.status(404);
    throw new Error('ไม่พบแชทกลุ่มนี้');
  }
  if (!chat.participants.includes(userId)) {
    res.status(403);
    throw new Error('คุณไม่ได้อยู่ในแชทกลุ่มนี้');
  }
  return chat;
}

async function findChatMessage(chat, msgId, res) {
  const row = await getMessageRow(msgId);
  if (!row || row.conversation_id !== chat.id) {
    res.status(404);
    throw new Error('ไม่พบข้อความนี้');
  }
  return row;
}

function sendToChat(req, chat, eventName, data) {
  sendToUsers(req, chat.participants, eventName, { conversationId: chat.id, ...data });
}

async function cleanMemberIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const rows = await getMany("SELECT id FROM users WHERE id = ANY($1) AND account_status = 'active'", [ids]);
  return rows.map(r => r.id);
}

export const listConversations = async (req, res) => {
  const userId = req.userId;
  const list = [];

  const dms = await getMany(
    `SELECT c.id, other.user_id AS other_id FROM conversations c
     JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = $1
     JOIN conversation_participants other ON other.conversation_id = c.id AND other.user_id <> $1
     WHERE c.type = 'dm'`,
    [userId]
  );
  for (const dm of dms) {
    const lastMessage = await lastMessageOf(dm.id);
    if (!lastMessage) continue;
    list.push({ type: 'dm', id: dm.other_id, conversationId: dm.id, lastMessage: lastMessage });
  }

  const chats = await getMany(
    "SELECT c.id FROM conversations c JOIN conversation_participants p ON p.conversation_id = c.id AND p.user_id = $1 WHERE c.type = 'group'",
    [userId]
  );
  for (const chat of chats) {
    list.push(await loadChatInfo(chat.id));
  }

  list.sort((a, b) => {
    const timeA = a.lastMessage ? a.lastMessage.createdAt : a.createdAt || '';
    const timeB = b.lastMessage ? b.lastMessage.createdAt : b.createdAt || '';
    return timeB.localeCompare(timeA);
  });
  res.json(list);
};

export const createGroupChat = async (req, res) => {
  const { memberIds, name } = req.body;
  const owner = await findUserById(req.userId);

  const participants = [req.userId];
  (await cleanMemberIds(memberIds)).forEach(id => {
    if (!participants.includes(id)) participants.push(id);
  });

  if (participants.length < 3) {
    res.status(400);
    throw new Error('แชทกลุ่มต้องมีอย่างน้อย 3 คน (รวมคุณ)');
  }
  if (participants.length > 20) {
    res.status(400);
    throw new Error('แชทกลุ่มมีได้สูงสุด 20 คน');
  }

  const chatId = makeId('gdm');
  const chatName = String(name || '').trim().slice(0, 50);
  await transaction(async (client) => {
    await query("INSERT INTO conversations (id, type, name, owner_id) VALUES ($1, 'group', $2, $3)", [chatId, chatName, req.userId], client);
    for (const id of participants) {
      await query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)', [chatId, id], client);
    }
  });

  for (const id of participants) {
    if (id === req.userId) continue;
    await addNotification(req, id, {
      type: 'group',
      title: owner.name + ' เพิ่มคุณเข้าแชทกลุ่ม' + (chatName ? ' ' + chatName : ''),
      body: '',
      target: { type: 'gdm', id: chatId }
    });
  }

  const chat = await loadChatInfo(chatId);
  sendToChat(req, chat, 'gdm:changed', { chat: chat });
  res.status(201).json(chat);
};

export const updateGroupChat = async (req, res) => {
  const chat = await loadChat(req.params.id, req.userId, res);
  await query('UPDATE conversations SET name = $2 WHERE id = $1', [chat.id, String(req.body.name || '').trim().slice(0, 50)]);

  const updated = await loadChatInfo(chat.id);
  sendToChat(req, updated, 'gdm:changed', { chat: updated });
  res.json(updated);
};

export const addGroupChatMembers = async (req, res) => {
  const chat = await loadChat(req.params.id, req.userId, res);
  const newIds = (await cleanMemberIds(req.body.memberIds)).filter(id => !chat.participants.includes(id));
  if (chat.participants.length + newIds.length > 20) {
    res.status(400);
    throw new Error('แชทกลุ่มมีได้สูงสุด 20 คน');
  }

  const myName = await getUserName(req.userId);
  for (const id of newIds) {
    await query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [chat.id, id]);
    await addNotification(req, id, {
      type: 'group',
      title: myName + ' เพิ่มคุณเข้าแชทกลุ่ม' + (chat.name ? ' ' + chat.name : ''),
      body: '',
      target: { type: 'gdm', id: chat.id }
    });
  }

  const updated = await loadChatInfo(chat.id);
  sendToChat(req, updated, 'gdm:changed', { chat: updated });
  res.json(updated);
};

export const leaveGroupChat = async (req, res) => {
  const chat = await loadChat(req.params.id, req.userId, res);
  await query('DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2', [chat.id, req.userId]);

  const left = chat.participants.filter(id => id !== req.userId);
  if (left.length === 0) {
    await query('DELETE FROM conversations WHERE id = $1', [chat.id]);
  } else if (chat.ownerId === req.userId) {
    await query('UPDATE conversations SET owner_id = $2 WHERE id = $1', [chat.id, left[0]]);
  }

  sendToUsers(req, [req.userId], 'gdm:removed', { conversationId: chat.id });
  if (left.length > 0) {
    const updated = await loadChatInfo(chat.id);
    sendToChat(req, updated, 'gdm:changed', { chat: updated });
  }
  res.json({ message: 'ออกจากแชทกลุ่มแล้ว' });
};

export const getGroupChatMessages = async (req, res) => {
  const chat = await loadChat(req.params.id, req.userId, res);
  res.json(await getMessagePage('conversation_id', chat.id, req.query.before, req.query.limit));
};

export const addGroupChatMessage = async (req, res) => {
  const { text, parentId } = req.body;
  const attachments = cleanAttachments(req.body.attachments);
  const cleanText = String(text || '').trim().slice(0, 4000);
  if (!cleanText && attachments.length === 0) {
    res.status(400);
    throw new Error('กรุณาพิมพ์ข้อความ');
  }

  const chat = await loadChat(req.params.id, req.userId, res);
  const parent = parentId ? await findParent('conversation_id', chat.id, parentId) : null;
  if (parentId && (!parent || parent.parent_id)) {
    res.status(400);
    throw new Error('ไม่พบข้อความที่จะตอบกลับ');
  }

  const user = await findUserById(req.userId);
  const members = await findUsersByIds(chat.participants);
  const message = await createMessage({
    idPrefix: 'gm',
    conversationId: chat.id,
    parentId: parent ? parent.id : null,
    author: user,
    text: cleanText,
    attachments: attachments,
    mentions: findMentions(cleanText, members, false)
  });

  const updated = await loadChatInfo(chat.id);
  sendToChat(req, updated, 'gdm:new', { message: message, chat: updated });
  res.status(201).json(message);
};

export const updateGroupChatMessage = async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 4000);
  if (!text) {
    res.status(400);
    throw new Error('กรุณาพิมพ์ข้อความ');
  }

  const chat = await loadChat(req.params.id, req.userId, res);
  const row = await findChatMessage(chat, req.params.msgId, res);
  if (row.author_id !== req.userId) {
    res.status(403);
    throw new Error('แก้ไขได้เฉพาะข้อความของตัวเอง');
  }

  const members = await findUsersByIds(chat.participants);
  const message = await updateMessageText(row.id, text, findMentions(text, members, false));
  sendToChat(req, chat, 'gdm:updated', { message: message });
  res.json(message);
};

export const deleteGroupChatMessage = async (req, res) => {
  const chat = await loadChat(req.params.id, req.userId, res);
  const row = await findChatMessage(chat, req.params.msgId, res);
  if (row.author_id !== req.userId) {
    res.status(403);
    throw new Error('ลบได้เฉพาะข้อความของตัวเอง');
  }

  await deleteMessage(row.id);
  sendToChat(req, chat, 'gdm:deleted', { messageId: row.id });
  res.json({ message: 'ลบสำเร็จ' });
};

export const reactGroupChatMessage = async (req, res) => {
  const { emoji } = req.body;
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    res.status(400);
    throw new Error('ไม่รองรับอีโมจินี้');
  }

  const chat = await loadChat(req.params.id, req.userId, res);
  const row = await findChatMessage(chat, req.params.msgId, res);
  const message = await toggleReaction(row.id, req.userId, emoji);
  sendToChat(req, chat, 'gdm:updated', { message: message });
  res.json(message);
};
