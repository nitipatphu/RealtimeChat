import { query, getOne, getMany } from '../config/database.js';
import { makeId } from '../utils/id.js';
import { toIso } from '../models/userModel.js';

const MAX_CLIPS = 200;

function toClip(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    text: row.text,
    pinned: row.pinned,
    source: row.source,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function readInput(body, res) {
  const text = String(body.text || '').trim();
  const title = String(body.title || '').trim();
  if (!text) {
    res.status(400);
    throw new Error('กรุณาใส่ข้อความ');
  }
  if (text.length > 5000) {
    res.status(400);
    throw new Error('ข้อความยาวได้ไม่เกิน 5000 ตัวอักษร');
  }
  return { text: text, title: title.slice(0, 80) };
}

async function findMyClip(clipId, userId, res) {
  const row = await getOne('SELECT * FROM clips WHERE id = $1 AND user_id = $2', [clipId, userId]);
  if (!row) {
    res.status(404);
    throw new Error('ไม่พบข้อความนี้ในคลิปบอร์ด');
  }
  return row;
}

export const getClips = async (req, res) => {
  const rows = await getMany('SELECT * FROM clips WHERE user_id = $1 ORDER BY pinned DESC, updated_at DESC', [req.userId]);
  res.json(rows.map(toClip));
};

export const createClip = async (req, res) => {
  const input = readInput(req.body, res);
  const countRow = await getOne('SELECT count(*) AS total FROM clips WHERE user_id = $1', [req.userId]);
  if (Number(countRow.total) >= MAX_CLIPS) {
    res.status(400);
    throw new Error('เก็บได้สูงสุด ' + MAX_CLIPS + ' รายการ ลบอันเก่าก่อน');
  }

  const id = makeId('clip');
  await query(
    'INSERT INTO clips (id, user_id, title, text, source) VALUES ($1, $2, $3, $4, $5)',
    [id, req.userId, input.title, input.text, String(req.body.source || '').slice(0, 80)]
  );
  res.status(201).json(toClip(await getOne('SELECT * FROM clips WHERE id = $1', [id])));
};

export const updateClip = async (req, res) => {
  const clip = await findMyClip(req.params.clipId, req.userId, res);

  if (req.body.text !== undefined || req.body.title !== undefined) {
    const input = readInput({
      text: req.body.text !== undefined ? req.body.text : clip.text,
      title: req.body.title !== undefined ? req.body.title : clip.title
    }, res);
    await query('UPDATE clips SET text = $2, title = $3, updated_at = now() WHERE id = $1', [clip.id, input.text, input.title]);
  }
  if (req.body.pinned !== undefined) {
    await query('UPDATE clips SET pinned = $2 WHERE id = $1', [clip.id, req.body.pinned === true]);
  }

  res.json(toClip(await getOne('SELECT * FROM clips WHERE id = $1', [clip.id])));
};

export const deleteClip = async (req, res) => {
  const clip = await findMyClip(req.params.clipId, req.userId, res);
  await query('DELETE FROM clips WHERE id = $1', [clip.id]);
  res.json({ message: 'ลบแล้ว' });
};
