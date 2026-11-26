import { getMany } from '../config/database.js';
import { canSeeProject, canSeeChannel } from '../utils/permissions.js';
import { loadGroup, listChannels } from '../models/groupModel.js';
import { isSystemAdmin } from '../models/userModel.js';
import { hydrateMessages } from '../models/messageModel.js';

function likeText(text) {
  let safeText = '';
  for (let i = 0; i < text.length; i++) {
    const letter = text[i];
    if (letter === '\\' || letter === '%' || letter === '_') {
      safeText = safeText + '\\' + letter;
    } else {
      safeText = safeText + letter;
    }
  }
  return '%' + safeText + '%';
}

export const searchMessages = async (req, res) => {
  const text = String(req.query.q || '').trim();
  if (text.length < 2) {
    res.status(400);
    throw new Error('พิมพ์คำค้นหาอย่างน้อย 2 ตัวอักษร');
  }
  if (text.length > 100) {
    res.status(400);
    throw new Error('คำค้นหายาวเกินไป');
  }

  const group = await loadGroup(req.params.groupId);
  if (!group) {
    res.status(404);
    throw new Error('ไม่พบ Group นี้');
  }

  const userId = req.userId;
  const adminReading = await isSystemAdmin(userId);
  if (!adminReading && !group.members.includes(userId)) {
    res.status(403);
    throw new Error('คุณไม่ได้เป็นสมาชิกของกลุ่มนี้');
  }

  const channels = (await listChannels(group.id)).filter(c => adminReading || canSeeChannel(group, c, userId));
  const projects = group.projects.filter(p => adminReading || canSeeProject(group, p, userId));
  const projectChannelIds = [];
  const projectChannelInfo = {};
  projects.forEach(project => {
    project.channels.forEach(channel => {
      projectChannelIds.push(channel.id);
      projectChannelInfo[channel.id] = { project: project, channel: channel };
    });
  });

  const rows = await getMany(
    `SELECT DISTINCT m.* FROM messages m
     LEFT JOIN message_attachments a ON a.message_id = m.id
     LEFT JOIN conversations c ON c.id = m.conversation_id AND c.type = 'dm'
     LEFT JOIN conversation_participants p ON p.conversation_id = c.id AND p.user_id = $3
     WHERE (m.text ILIKE $1 OR a.name ILIKE $1)
       AND (m.channel_id = ANY($2) OR m.project_channel_id = ANY($4) OR p.user_id IS NOT NULL)
     ORDER BY m.created_at DESC LIMIT 50`,
    [likeText(text), channels.map(c => c.id), userId, projectChannelIds]
  );

  const dmRooms = await getMany(
    `SELECT p.conversation_id, u.id, u.name FROM conversation_participants p
     JOIN users u ON u.id = p.user_id
     WHERE p.conversation_id = ANY($1) AND p.user_id <> $2`,
    [rows.filter(r => r.conversation_id).map(r => r.conversation_id), userId]
  );

  const messages = await hydrateMessages(rows);
  const results = [];
  rows.forEach((row, index) => {
    const message = messages[index];
    if (row.channel_id) {
      const channel = channels.find(c => c.id === row.channel_id);
      results.push({ type: 'channel', roomId: row.channel_id, roomName: '#' + (channel ? channel.name : ''), message: message });
    } else if (row.project_channel_id) {
      const info = projectChannelInfo[row.project_channel_id];
      results.push({ type: 'project', roomId: info.project.id, channelId: info.channel.id, roomName: info.project.name + ' / #' + info.channel.name, message: message });
    } else {
      const other = dmRooms.find(d => d.conversation_id === row.conversation_id);
      if (other) results.push({ type: 'dm', roomId: other.id, roomName: 'DM: ' + other.name, message: message });
    }
  });

  res.json(results);
};
