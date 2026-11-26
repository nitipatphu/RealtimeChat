import { query, getOne } from '../config/database.js';
import { sendGroupUpdate, sendToGroup } from '../utils/socketEvents.js';
import { hasPermission, isGroupMember } from '../utils/permissions.js';
import { addGroupLog, getUserName } from '../utils/logs.js';
import { makeId } from '../utils/id.js';
import { addNotification } from '../utils/notifications.js';
import { loadGroup, loadGroupOr404, listChannels } from '../models/groupModel.js';
import { viewGroupFor } from '../utils/groupView.js';

function requireManageChannels(group, userId, res) {
  if (!hasPermission(group, userId, 'manage_channels')) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์จัดการหมวดหมู่');
  }
}

function readName(req, res) {
  const name = String(req.body.name || '').trim();
  if (!name) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อหมวดหมู่');
  }
  return name.slice(0, 40);
}

function findCategory(group, categoryId, res) {
  const category = group.categories.find(c => c.id === categoryId);
  if (!category) {
    res.status(404);
    throw new Error('ไม่พบหมวดหมู่นี้');
  }
  return category;
}

export const createCategory = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requireManageChannels(group, req.userId, res);
  const name = readName(req, res);

  if (group.categories.length >= 30) {
    res.status(400);
    throw new Error('สร้างหมวดหมู่ได้สูงสุด 30 อัน');
  }

  const category = { id: makeId('cat'), name: name };
  await query('INSERT INTO channel_categories (id, group_id, name, position) VALUES ($1, $2, $3, $4)', [category.id, group.id, name, group.categories.length]);
  await addGroupLog(group.id, req.userId, 'category_create', (await getUserName(req.userId)) + ' สร้างหมวดหมู่ ' + name);

  sendGroupUpdate(req, await loadGroup(group.id));
  res.status(201).json(category);
};

export const updateCategory = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requireManageChannels(group, req.userId, res);
  const category = findCategory(group, req.params.categoryId, res);
  const name = readName(req, res);

  await query('UPDATE channel_categories SET name = $2 WHERE id = $1', [category.id, name]);
  await addGroupLog(group.id, req.userId, 'category_rename', (await getUserName(req.userId)) + ' เปลี่ยนชื่อหมวดหมู่ ' + category.name + ' เป็น ' + name);

  sendGroupUpdate(req, await loadGroup(group.id));
  res.json({ id: category.id, name: name });
};

export const deleteCategory = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requireManageChannels(group, req.userId, res);
  const category = findCategory(group, req.params.categoryId, res);

  await query('DELETE FROM channel_categories WHERE id = $1', [category.id]);
  await addGroupLog(group.id, req.userId, 'category_delete', (await getUserName(req.userId)) + ' ลบหมวดหมู่ ' + category.name);

  const channels = await listChannels(group.id);
  channels.filter(c => c.categoryId === null).forEach(channel => {
    sendToGroup(req, group.id, 'channel:updated', { channel: channel });
  });

  sendGroupUpdate(req, await loadGroup(group.id));
  res.json({ message: 'ลบหมวดหมู่สำเร็จ' });
};

function readEvent(req, res) {
  const title = String(req.body.title || '').trim();
  const date = String(req.body.date || '');
  const time = String(req.body.time || '');
  const description = String(req.body.description || '').trim();

  if (!title) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อนัดหมาย');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
    res.status(400);
    throw new Error('กรุณาเลือกวันที่');
  }
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    res.status(400);
    throw new Error('เวลาไม่ถูกต้อง');
  }

  return { title: title.slice(0, 100), date: date, time: time || null, description: description.slice(0, 1000) };
}

async function findEvent(groupId, eventId, res) {
  const event = await getOne('SELECT * FROM group_events WHERE id = $1 AND group_id = $2', [eventId, groupId]);
  if (!event) {
    res.status(404);
    throw new Error('ไม่พบนัดหมายนี้');
  }
  return event;
}

function requireCanEditEvent(group, event, userId, res) {
  if (event.created_by === userId) return;
  if (hasPermission(group, userId, 'manage_events')) return;
  res.status(403);
  throw new Error('แก้ไขได้เฉพาะนัดหมายที่ตัวเองสร้าง');
}

export const createEvent = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  if (!isGroupMember(group, req.userId)) {
    res.status(403);
    throw new Error('คุณไม่ได้เป็นสมาชิกของกลุ่มนี้');
  }

  const input = readEvent(req, res);
  const eventId = makeId('ev');
  await query(
    'INSERT INTO group_events (id, group_id, title, event_date, event_time, description, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [eventId, group.id, input.title, input.date, input.time, input.description, req.userId]
  );
  await addGroupLog(group.id, req.userId, 'event_create', (await getUserName(req.userId)) + ' สร้างนัด ' + input.title + ' วันที่ ' + input.date);

  const whenText = input.date + (input.time ? ' เวลา ' + input.time + ' น.' : '');
  for (const memberId of group.members) {
    if (memberId === req.userId) continue;
    await addNotification(req, memberId, {
      type: 'event',
      title: 'นัดใหม่ใน ' + group.name + ': ' + input.title,
      body: whenText,
      target: { type: 'calendar', groupId: group.id, id: input.date }
    });
  }

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.status(201).json(updated.events.find(e => e.id === eventId));
};

export const updateEvent = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  const event = await findEvent(group.id, req.params.eventId, res);
  requireCanEditEvent(group, event, req.userId, res);

  const input = readEvent(req, res);
  await query(
    'UPDATE group_events SET title = $2, event_date = $3, event_time = $4, description = $5, reminded_for = NULL WHERE id = $1',
    [event.id, input.title, input.date, input.time, input.description]
  );
  await addGroupLog(group.id, req.userId, 'event_update', (await getUserName(req.userId)) + ' แก้ไขนัด ' + input.title);

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.json(updated.events.find(e => e.id === event.id));
};

export const deleteEvent = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  const event = await findEvent(group.id, req.params.eventId, res);
  requireCanEditEvent(group, event, req.userId, res);

  await query('DELETE FROM group_events WHERE id = $1', [event.id]);
  await addGroupLog(group.id, req.userId, 'event_delete', (await getUserName(req.userId)) + ' ลบนัด ' + event.title);

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.json(viewGroupFor(updated, req.userId));
};
