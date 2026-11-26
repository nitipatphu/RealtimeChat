import { query, getOne, getMany } from '../config/database.js';
import { makeId } from '../utils/id.js';
import { toIso } from '../models/userModel.js';

const TARGET_TYPES = ['channel', 'project', 'dm', 'gdm'];

function cleanTarget(target) {
  if (!target || !TARGET_TYPES.includes(target.type)) return null;
  if (target.type === 'channel' && target.channelId) return { type: 'channel', channelId: String(target.channelId) };
  if (target.type === 'dm' && target.otherUserId) return { type: 'dm', otherUserId: String(target.otherUserId) };
  if (target.type === 'gdm' && target.conversationId) return { type: 'gdm', conversationId: String(target.conversationId) };
  if (target.type === 'project' && target.groupId && target.projectId && target.channelId) {
    return { type: 'project', groupId: String(target.groupId), projectId: String(target.projectId), channelId: String(target.channelId) };
  }
  return null;
}

export async function toScheduledItem(row) {
  let target = { type: row.target_type };
  if (row.target_type === 'channel') target.channelId = row.channel_id;
  if (row.target_type === 'dm') target.otherUserId = row.dm_user_id;
  if (row.target_type === 'gdm') target.conversationId = row.conversation_id;
  if (row.target_type === 'project') {
    const info = await getOne('SELECT pc.id, p.id AS project_id, p.group_id FROM project_channels pc JOIN projects p ON p.id = pc.project_id WHERE pc.id = $1', [row.project_channel_id]);
    target = info ? { type: 'project', groupId: info.group_id, projectId: info.project_id, channelId: info.id } : target;
  }
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    target: target,
    targetName: row.target_name,
    sendAt: toIso(row.send_at),
    createdAt: toIso(row.created_at)
  };
}

function targetWhere(target) {
  if (target.type === 'channel') return { sql: 'channel_id = $2', value: target.channelId };
  if (target.type === 'project') return { sql: 'project_channel_id = $2', value: target.channelId };
  if (target.type === 'gdm') return { sql: 'conversation_id = $2', value: target.conversationId };
  return { sql: 'dm_user_id = $2', value: target.otherUserId };
}

export const getScheduled = async (req, res) => {
  let rows;
  if (req.query.target) {
    let parsed = null;
    try {
      parsed = JSON.parse(req.query.target);
    } catch (error) {
      console.log(error.message);
    }
    const target = cleanTarget(parsed);
    if (!target) {
      res.status(400);
      throw new Error('ห้องไม่ถูกต้อง');
    }
    const where = targetWhere(target);
    rows = await getMany('SELECT * FROM scheduled_messages WHERE user_id = $1 AND ' + where.sql + ' ORDER BY send_at', [req.userId, where.value]);
  } else {
    rows = await getMany('SELECT * FROM scheduled_messages WHERE user_id = $1 ORDER BY send_at', [req.userId]);
  }

  const list = [];
  for (const row of rows) list.push(await toScheduledItem(row));
  res.json(list);
};

export const createScheduled = async (req, res) => {
  const { text, sendAt, targetName } = req.body;
  const cleanText = String(text || '').trim();
  const target = cleanTarget(req.body.target);

  if (!cleanText) {
    res.status(400);
    throw new Error('กรุณาพิมพ์ข้อความ');
  }
  if (!target) {
    res.status(400);
    throw new Error('ไม่พบห้องที่จะส่ง');
  }

  const time = new Date(sendAt).getTime();
  if (!time || time < Date.now() + 30 * 1000) {
    res.status(400);
    throw new Error('เวลาที่ตั้งต้องเป็นอนาคต (อย่างน้อย 1 นาทีจากนี้)');
  }
  if (time > Date.now() + 90 * 24 * 60 * 60 * 1000) {
    res.status(400);
    throw new Error('ตั้งเวลาล่วงหน้าได้ไม่เกิน 90 วัน');
  }

  const countRow = await getOne('SELECT count(*) AS total FROM scheduled_messages WHERE user_id = $1', [req.userId]);
  if (Number(countRow.total) >= 50) {
    res.status(400);
    throw new Error('ตั้งเวลาได้สูงสุด 50 ข้อความ');
  }

  let exists = null;
  if (target.type === 'channel') {
    exists = await getOne('SELECT 1 FROM channels WHERE id = $1', [target.channelId]);
  }
  if (target.type === 'project') {
    exists = await getOne('SELECT 1 FROM project_channels WHERE id = $1 AND project_id = $2', [target.channelId, target.projectId]);
  }
  if (target.type === 'gdm') {
    exists = await getOne('SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2', [target.conversationId, req.userId]);
  }
  if (target.type === 'dm') {
    exists = await getOne('SELECT 1 FROM users WHERE id = $1', [target.otherUserId]);
  }
  if (!exists) {
    res.status(400);
    throw new Error('ไม่พบห้องที่จะส่ง');
  }

  const id = makeId('sch');
  await query(
    `INSERT INTO scheduled_messages (id, user_id, text, target_type, channel_id, project_channel_id, conversation_id, dm_user_id, target_name, send_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      req.userId,
      cleanText.slice(0, 4000),
      target.type,
      target.type === 'channel' ? target.channelId : null,
      target.type === 'project' ? target.channelId : null,
      target.type === 'gdm' ? target.conversationId : null,
      target.type === 'dm' ? target.otherUserId : null,
      String(targetName || '').slice(0, 80),
      new Date(time)
    ]
  );

  const row = await getOne('SELECT * FROM scheduled_messages WHERE id = $1', [id]);
  res.status(201).json(await toScheduledItem(row));
};

export const deleteScheduled = async (req, res) => {
  const removed = await query('DELETE FROM scheduled_messages WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (removed.rowCount === 0) {
    res.status(404);
    throw new Error('ไม่พบข้อความที่ตั้งเวลาไว้');
  }
  res.json({ message: 'ยกเลิกแล้ว' });
};
