import { getOne, getMany, query, transaction } from '../config/database.js';
import { toIso } from './userModel.js';
import { makeId } from '../utils/id.js';
import { deleteUploadedFile } from '../middlewares/uploadMiddleware.js';

const PLACE_COLUMNS = ['channel_id', 'project_channel_id', 'conversation_id'];

function checkColumn(column) {
  if (!PLACE_COLUMNS.includes(column)) {
    throw new Error('ห้องไม่ถูกต้อง');
  }
}

export async function hydrateMessages(rows, client) {
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);

  const attachments = await getMany('SELECT * FROM message_attachments WHERE message_id = ANY($1) ORDER BY id', [ids], client);
  const mentions = await getMany('SELECT * FROM message_mentions WHERE message_id = ANY($1)', [ids], client);
  const reactions = await getMany('SELECT * FROM message_reactions WHERE message_id = ANY($1) ORDER BY created_at', [ids], client);
  const options = await getMany('SELECT * FROM poll_options WHERE message_id = ANY($1) ORDER BY position', [ids], client);
  const votes = await getMany('SELECT * FROM poll_votes WHERE message_id = ANY($1)', [ids], client);

  return rows.map(row => {
    const reactionMap = {};
    reactions.filter(r => r.message_id === row.id).forEach(r => {
      if (!reactionMap[r.emoji]) reactionMap[r.emoji] = [];
      reactionMap[r.emoji].push(r.user_id);
    });

    let poll = null;
    if (row.poll_question) {
      poll = {
        question: row.poll_question,
        multiple: row.poll_multiple,
        options: options.filter(o => o.message_id === row.id).map(o => ({
          id: o.id,
          text: o.text,
          votes: votes.filter(v => v.message_id === row.id && v.option_id === o.id).map(v => v.user_id)
        }))
      };
    }

    return {
      id: row.id,
      authorId: row.author_id,
      author: row.author_name,
      avatar: row.author_avatar,
      createdAt: toIso(row.created_at),
      text: row.text,
      attachments: attachments.filter(a => a.message_id === row.id).map(a => ({ url: a.url, name: a.name, type: a.type || '', size: a.size || 0 })),
      mentions: mentions.filter(m => m.message_id === row.id).map(m => m.user_id),
      reactions: reactionMap,
      parentId: row.parent_id,
      poll: poll,
      pinned: row.pinned_at ? true : false,
      pinnedBy: row.pinned_by,
      pinnedAt: toIso(row.pinned_at),
      isEdited: row.is_edited
    };
  });
}

export async function getMessage(messageId, client) {
  const rows = await getMany('SELECT * FROM messages WHERE id = $1', [messageId], client);
  const list = await hydrateMessages(rows, client);
  return list[0] || null;
}

export async function getMessageRow(messageId, client) {
  return getOne('SELECT * FROM messages WHERE id = $1', [messageId], client);
}

export async function getMessagePage(column, placeId, before, limit) {
  checkColumn(column);
  const size = Math.min(Number(limit) || 50, 100);
  const params = [placeId, size + 1];
  let beforeSql = '';
  if (before) {
    params.push(before);
    beforeSql = ' AND created_at < $3';
  }

  const topRows = await getMany(
    'SELECT * FROM messages WHERE ' + column + ' = $1 AND parent_id IS NULL' + beforeSql + ' ORDER BY created_at DESC LIMIT $2',
    params
  );
  const hasMore = topRows.length > size;
  const page = topRows.slice(0, size).reverse();

  const replyRows = await getMany(
    'SELECT * FROM messages WHERE parent_id = ANY($1) ORDER BY created_at',
    [page.map(r => r.id)]
  );

  const messages = await hydrateMessages(page.concat(replyRows));
  return { messages: messages, hasMore: hasMore };
}

export async function getPinnedMessages(column, placeId) {
  checkColumn(column);
  const rows = await getMany('SELECT * FROM messages WHERE ' + column + ' = $1 AND pinned_at IS NOT NULL ORDER BY pinned_at DESC', [placeId]);
  return hydrateMessages(rows);
}

export async function createMessage(data) {
  const id = makeId(data.idPrefix || 'm');
  const poll = data.poll || null;

  await transaction(async (client) => {
    await query(
      `INSERT INTO messages (id, channel_id, project_channel_id, conversation_id, parent_id, author_id, author_name, author_avatar, text, poll_question, poll_multiple)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        data.channelId || null,
        data.projectChannelId || null,
        data.conversationId || null,
        data.parentId || null,
        data.author.id,
        data.author.name,
        data.author.avatar,
        data.text || '',
        poll ? poll.question : null,
        poll ? poll.multiple : false
      ],
      client
    );

    for (const file of data.attachments || []) {
      await query('INSERT INTO message_attachments (message_id, url, name, type, size) VALUES ($1, $2, $3, $4, $5)', [id, file.url, file.name, file.type, file.size], client);
    }
    for (const userId of data.mentions || []) {
      await query('INSERT INTO message_mentions (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, userId], client);
    }
    if (poll) {
      let position = 0;
      for (const option of poll.options) {
        await query('INSERT INTO poll_options (id, message_id, text, position) VALUES ($1, $2, $3, $4)', [option.id, id, option.text, position], client);
        position = position + 1;
      }
    }
  });

  return getMessage(id);
}

export async function updateMessageText(messageId, text, mentions) {
  await transaction(async (client) => {
    await query('UPDATE messages SET text = $2, is_edited = true WHERE id = $1', [messageId, text], client);
    await query('DELETE FROM message_mentions WHERE message_id = $1', [messageId], client);
    for (const userId of mentions || []) {
      await query('INSERT INTO message_mentions (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [messageId, userId], client);
    }
  });
  return getMessage(messageId);
}

export async function deleteMessage(messageId) {
  const files = await getMany(
    'SELECT url FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE id = $1 OR parent_id = $1)',
    [messageId]
  );
  await query('DELETE FROM messages WHERE id = $1', [messageId]);
  for (const file of files) {
    const stillUsed = await getOne('SELECT 1 FROM message_attachments WHERE url = $1 LIMIT 1', [file.url]);
    if (!stillUsed) deleteUploadedFile(file.url);
  }
}

export async function toggleReaction(messageId, userId, emoji) {
  const removed = await query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [messageId, userId, emoji]);
  if (removed.rowCount === 0) {
    await query('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)', [messageId, userId, emoji]);
  }
  return getMessage(messageId);
}

export async function togglePin(messageId, userId) {
  await query(
    'UPDATE messages SET pinned_at = CASE WHEN pinned_at IS NULL THEN now() ELSE NULL END, pinned_by = CASE WHEN pinned_at IS NULL THEN $2 ELSE NULL END WHERE id = $1',
    [messageId, userId]
  );
  return getMessage(messageId);
}

export async function votePoll(messageId, optionId, userId) {
  const row = await getOne('SELECT poll_multiple FROM messages WHERE id = $1 AND poll_question IS NOT NULL', [messageId]);
  if (!row) return null;
  const option = await getOne('SELECT 1 FROM poll_options WHERE message_id = $1 AND id = $2', [messageId, optionId]);
  if (!option) return null;

  await transaction(async (client) => {
    const removed = await query('DELETE FROM poll_votes WHERE message_id = $1 AND option_id = $2 AND user_id = $3', [messageId, optionId, userId], client);
    if (removed.rowCount > 0) return;
    if (!row.poll_multiple) {
      await query('DELETE FROM poll_votes WHERE message_id = $1 AND user_id = $2', [messageId, userId], client);
    }
    await query('INSERT INTO poll_votes (message_id, option_id, user_id) VALUES ($1, $2, $3)', [messageId, optionId, userId], client);
  });

  return getMessage(messageId);
}

export function cleanPoll(poll) {
  if (!poll || typeof poll !== 'object') return null;

  const question = String(poll.question || '').trim().slice(0, 200);
  const optionTexts = (Array.isArray(poll.options) ? poll.options : [])
    .map(text => String(text || '').trim().slice(0, 80))
    .filter(text => text);

  if (!question || optionTexts.length < 2 || optionTexts.length > 6) return null;

  return {
    question: question,
    multiple: poll.multiple === true,
    options: optionTexts.map((text, index) => ({ id: 'o' + (index + 1), text: text, votes: [] }))
  };
}

export async function findParent(column, placeId, parentId) {
  checkColumn(column);
  if (!parentId) return null;
  const row = await getOne('SELECT id, parent_id, author_id FROM messages WHERE id = $1 AND ' + column + ' = $2', [parentId, placeId]);
  return row;
}

export async function getThreadUserIds(parentId) {
  const rows = await getMany(
    'SELECT author_id FROM messages WHERE id = $1 UNION SELECT author_id FROM messages WHERE parent_id = $1',
    [parentId]
  );
  return rows.map(r => r.author_id).filter(Boolean);
}
