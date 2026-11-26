import { query } from '../config/database.js';
import { makeId } from './id.js';

export async function addNotification(req, userId, data, client) {
  if (!userId) return;

  const notification = {
    id: makeId('nt'),
    userId: userId,
    type: data.type,
    title: data.title,
    body: data.body || '',
    target: data.target || null,
    read: false,
    createdAt: new Date().toISOString()
  };

  await query(
    'INSERT INTO notifications (id, user_id, type, title, body, target, is_read, created_at) VALUES ($1, $2, $3, $4, $5, $6, false, $7)',
    [notification.id, userId, notification.type, notification.title, notification.body, notification.target ? JSON.stringify(notification.target) : null, notification.createdAt],
    client
  );

  const io = req.app.get('io');
  if (io) {
    io.to('user:' + userId).emit('notification:new', notification);
  }
}

export async function notifyMentions(req, message, authorName, roomName, target) {
  for (const userId of message.mentions || []) {
    if (userId === message.authorId) continue;
    await addNotification(req, userId, {
      type: 'mention',
      title: authorName + ' กล่าวถึงคุณใน ' + roomName,
      body: message.text,
      target: target
    });
  }
}

export async function notifyThreadReply(req, parentAuthorId, threadUserIds, message, authorName, roomName, target) {
  if (!message.parentId) return;

  const userIds = [];
  [parentAuthorId, ...threadUserIds].forEach(id => {
    if (id && !userIds.includes(id)) userIds.push(id);
  });

  for (const userId of userIds) {
    if (userId === message.authorId) continue;
    if ((message.mentions || []).includes(userId)) continue;
    const isOwner = userId === parentAuthorId;
    await addNotification(req, userId, {
      type: 'mention',
      title: authorName + (isOwner ? ' ตอบกลับข้อความของคุณใน ' : ' ตอบกลับใน Thread ที่คุณร่วมคุยใน ') + roomName,
      body: message.text,
      target: target
    });
  }
}
