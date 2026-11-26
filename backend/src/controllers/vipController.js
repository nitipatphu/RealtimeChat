import { query, getOne, getMany, transaction } from '../config/database.js';
import { addAdminLog } from '../utils/logs.js';
import { addNotification } from '../utils/notifications.js';
import { sendToEveryone } from '../utils/socketEvents.js';
import { NO_TIER, getVipTier, makeVipRecord, makeVipCode, formatThaiDate, getTierSettings, getTierList, findVipTier, getTierName, cleanTierInput } from '../utils/vip.js';
import { findUserById, toIso } from '../models/userModel.js';

async function findUserOr404(id, res) {
  const user = await findUserById(id);
  if (!user) {
    res.status(404);
    throw new Error('ไม่พบผู้ใช้');
  }
  return user;
}

async function readTierAndDays(body, res) {
  const tier = await findVipTier(body.tier);
  const days = Math.round(Number(body.days));
  if (!tier) {
    res.status(400);
    throw new Error('ระดับ VIP ไม่ถูกต้อง');
  }
  if (!days || days < 1 || days > 3650) {
    res.status(400);
    throw new Error('จำนวนวันต้องอยู่ระหว่าง 1 ถึง 3650 วัน');
  }
  return { tier, days };
}

async function announceTiers(req) {
  const tiers = await getTierSettings();
  sendToEveryone(req, 'system-settings:updated', { tiers: tiers });
  return tiers;
}

async function saveVip(userId, vip, client) {
  await query(
    `INSERT INTO user_vip (user_id, tier, since, expires_at, granted_by, source) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET tier = $2, since = $3, expires_at = $4, granted_by = $5, source = $6, warned_for = NULL`,
    [userId, vip.tier, vip.since, vip.expiresAt, vip.grantedBy, vip.source],
    client
  );
}

async function announceUser(req, userId) {
  const user = await findUserById(userId);
  sendToEveryone(req, 'user:updated', user);
  return user;
}

export const getVipOverview = async (req, res) => {
  const memberRows = await getMany(
    `SELECT u.id, u.name, u.email, u.avatar, v.tier, v.since, v.expires_at, v.granted_by, v.source
     FROM user_vip v JOIN users u ON u.id = v.user_id
     WHERE v.expires_at > now() ORDER BY v.expires_at`
  );
  const members = memberRows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    vip: { tier: row.tier, since: toIso(row.since), expiresAt: toIso(row.expires_at), grantedBy: row.granted_by, source: row.source }
  }));

  const codeRows = await getMany(
    `SELECT c.*, u.name AS created_by_name,
            COALESCE((SELECT array_agg(x.user_id) FROM vip_code_uses x WHERE x.code = c.code), '{}') AS used_by
     FROM vip_codes c LEFT JOIN users u ON u.id = c.created_by
     ORDER BY c.created_at DESC`
  );
  const codes = codeRows.map(row => ({
    code: row.code,
    tier: row.tier,
    days: row.days,
    maxUses: row.max_uses,
    usedBy: row.used_by || [],
    note: row.note,
    createdBy: row.created_by,
    createdByName: row.created_by_name || '-',
    createdAt: toIso(row.created_at)
  }));

  res.json({ members: members, codes: codes });
};

export const grantVip = async (req, res) => {
  const { tier, days } = await readTierAndDays(req.body, res);
  const user = await findUserOr404(req.params.id, res);

  const vip = makeVipRecord(user, tier.id, days, req.adminUser.id, 'admin');
  await saveVip(user.id, vip);
  await addAdminLog(req.adminUser.id, 'vip_grant', req.adminUser.name + ' ให้ ' + tier.name + ' กับ ' + user.name + ' ' + days + ' วัน (หมดอายุ ' + formatThaiDate(vip.expiresAt) + ')');
  await addNotification(req, user.id, {
    type: 'vip',
    title: 'คุณได้รับ ' + tier.name + ' ' + (tier.icon || '💎'),
    body: 'ใช้ได้ถึง ' + formatThaiDate(vip.expiresAt) + ' ดูสิทธิพิเศษได้ที่ตั้งค่าของฉัน > VIP',
    target: { type: 'settings', id: 'vip' }
  });

  res.json(await announceUser(req, user.id));
};

export const revokeVip = async (req, res) => {
  const user = await findUserOr404(req.params.id, res);
  if (!user.vip) {
    res.status(400);
    throw new Error('ผู้ใช้นี้ไม่ได้เป็น VIP');
  }

  const oldName = await getTierName(user.vip.tier);
  await query('DELETE FROM user_vip WHERE user_id = $1', [user.id]);
  await addAdminLog(req.adminUser.id, 'vip_revoke', req.adminUser.name + ' ยกเลิก ' + oldName + ' ของ ' + user.name);
  await addNotification(req, user.id, {
    type: 'vip',
    title: oldName + ' ของคุณถูกยกเลิกโดยผู้ดูแลระบบ',
    body: '',
    target: { type: 'settings', id: 'vip' }
  });

  res.json(await announceUser(req, user.id));
};

export const createVipCode = async (req, res) => {
  const { tier, days } = await readTierAndDays(req.body, res);
  const maxUses = Math.round(Number(req.body.maxUses) || 1);
  if (maxUses < 1 || maxUses > 1000) {
    res.status(400);
    throw new Error('จำนวนครั้งที่ใช้ได้ต้องอยู่ระหว่าง 1 ถึง 1000');
  }

  let code = makeVipCode();
  while (await getOne('SELECT 1 FROM vip_codes WHERE code = $1', [code])) {
    code = makeVipCode();
  }

  const note = String(req.body.note || '').trim().slice(0, 100);
  await query('INSERT INTO vip_codes (code, tier, days, max_uses, note, created_by) VALUES ($1, $2, $3, $4, $5, $6)', [code, tier.id, days, maxUses, note, req.adminUser.id]);
  await addAdminLog(req.adminUser.id, 'vip_code', req.adminUser.name + ' สร้างรหัส ' + tier.name + ' ' + days + ' วัน (' + code + ', ใช้ได้ ' + maxUses + ' ครั้ง)');

  res.status(201).json({ code: code, tier: tier.id, days: days, maxUses: maxUses, usedBy: [], note: note, createdBy: req.adminUser.id, createdAt: new Date().toISOString() });
};

export const deleteVipCode = async (req, res) => {
  const removed = await query('DELETE FROM vip_codes WHERE code = $1', [req.params.code]);
  if (removed.rowCount === 0) {
    res.status(404);
    throw new Error('ไม่พบรหัสนี้');
  }
  await addAdminLog(req.adminUser.id, 'vip_code', req.adminUser.name + ' ลบรหัส VIP ' + req.params.code);
  res.json({ message: 'ลบรหัสแล้ว' });
};

export const redeemVipCode = async (req, res) => {
  const cleanCode = String(req.body.code || '').trim().toUpperCase();
  const user = await findUserOr404(req.userId, res);

  const item = await getOne('SELECT * FROM vip_codes WHERE code = $1', [cleanCode]);
  if (!item) {
    res.status(404);
    throw new Error('รหัสไม่ถูกต้อง');
  }

  const tiers = await getTierSettings();
  const codeTier = tiers[item.tier];
  const currentTier = getVipTier(user);
  if (currentTier && tiers[currentTier] && codeTier && tiers[currentTier].rank > codeTier.rank) {
    res.status(400);
    throw new Error('คุณเป็น ' + tiers[currentTier].name + ' อยู่แล้ว ใช้รหัสนี้ได้หลังจากหมดอายุ');
  }
  let codeTierName = 'VIP';
  if (codeTier) codeTierName = codeTier.name;

  const vip = makeVipRecord(user, item.tier, item.days, item.created_by, 'code');
  await transaction(async (client) => {
    const used = await getOne('SELECT 1 FROM vip_code_uses WHERE code = $1 AND user_id = $2', [item.code, user.id], client);
    if (used) {
      res.status(400);
      throw new Error('คุณใช้รหัสนี้ไปแล้ว');
    }
    const countRow = await getOne('SELECT count(*) AS total FROM vip_code_uses WHERE code = $1', [item.code], client);
    if (Number(countRow.total) >= item.max_uses) {
      res.status(400);
      throw new Error('รหัสนี้ถูกใช้ครบจำนวนแล้ว');
    }
    await query('INSERT INTO vip_code_uses (code, user_id) VALUES ($1, $2)', [item.code, user.id], client);
    await saveVip(user.id, vip, client);
    await addAdminLog(user.id, 'vip_redeem', user.name + ' ใช้รหัส ' + item.code + ' ได้ ' + codeTierName + ' ' + item.days + ' วัน', client);
  });

  const updated = await announceUser(req, user.id);
  res.json({ message: 'เปิดใช้ ' + codeTierName + ' แล้ว ใช้ได้ถึง ' + formatThaiDate(vip.expiresAt), user: updated });
};

export async function checkVipExpiry(app) {
  const fakeReq = { app: app };

  const expired = await getMany('DELETE FROM user_vip WHERE expires_at <= now() RETURNING user_id, tier');
  for (const row of expired) {
    const name = await getTierName(row.tier);
    await addNotification(fakeReq, row.user_id, {
      type: 'vip',
      title: name + ' ของคุณหมดอายุแล้ว',
      body: 'ขอบคุณที่ใช้งาน กรอกรหัสใหม่ได้ที่ตั้งค่าของฉัน > VIP',
      target: { type: 'settings', id: 'vip' }
    });
    await announceUser(fakeReq, row.user_id);
  }

  const warning = await getMany(
    `UPDATE user_vip SET warned_for = expires_at
     WHERE expires_at <= now() + interval '3 days' AND warned_for IS DISTINCT FROM expires_at
     RETURNING user_id, tier, expires_at`
  );
  for (const row of warning) {
    const name = await getTierName(row.tier);
    const daysLeft = Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    await addNotification(fakeReq, row.user_id, {
      type: 'vip',
      title: name + ' ของคุณจะหมดอายุใน ' + daysLeft + ' วัน',
      body: 'หมดอายุวันที่ ' + formatThaiDate(row.expires_at),
      target: { type: 'settings', id: 'vip' }
    });
  }
}

export const getSystemSettings = async (req, res) => {
  res.json({ tiers: await getTierSettings() });
};

export const createTier = async (req, res) => {
  let input;
  try {
    input = cleanTierInput(req.body);
  } catch (error) {
    res.status(400);
    throw error;
  }

  const list = await getTierList();
  if (list.length >= 11) {
    res.status(400);
    throw new Error('สร้างระดับ VIP ได้สูงสุด 10 ระดับ');
  }
  let topRank = 0;
  list.forEach(item => {
    if (item.rank > topRank) topRank = item.rank;
  });

  const id = 'tier-' + Date.now();
  await query(
    'INSERT INTO tier_settings (tier, name, icon, color, rank, file_mb, preset_themes, custom_theme) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, input.name, input.icon, input.color, topRank + 1, input.fileMB, input.presetThemes, input.customTheme]
  );
  await addAdminLog(req.adminUser.id, 'vip_settings', req.adminUser.name + ' สร้างระดับ VIP ใหม่ ' + input.name + ' (' + input.fileMB + ' MB)');

  const tiers = await announceTiers(req);
  res.status(201).json({ tiers: tiers });
};

export const updateTier = async (req, res) => {
  const old = await getOne('SELECT * FROM tier_settings WHERE tier = $1', [req.params.tier]);
  if (!old) {
    res.status(404);
    throw new Error('ไม่พบระดับนี้');
  }

  let input;
  try {
    input = cleanTierInput(req.body);
  } catch (error) {
    res.status(400);
    throw error;
  }

  await query(
    'UPDATE tier_settings SET name = $2, icon = $3, color = $4, file_mb = $5, preset_themes = $6, custom_theme = $7 WHERE tier = $1',
    [old.tier, input.name, input.icon, input.color, input.fileMB, input.presetThemes, input.customTheme]
  );
  await addAdminLog(req.adminUser.id, 'vip_settings', req.adminUser.name + ' แก้ไขระดับ ' + input.name + ' (' + input.fileMB + ' MB)');

  const tiers = await announceTiers(req);
  res.json({ tiers: tiers });
};

export const moveTier = async (req, res) => {
  const list = await getTierList();
  const vipList = list.filter(item => item.id !== NO_TIER);
  const index = vipList.findIndex(item => item.id === req.params.tier);
  if (index === -1) {
    res.status(404);
    throw new Error('ไม่พบระดับนี้');
  }

  let otherIndex = index + 1;
  if (req.body.direction === 'down') otherIndex = index - 1;
  if (otherIndex < 0 || otherIndex >= vipList.length) {
    res.json({ tiers: await getTierSettings() });
    return;
  }

  const current = vipList[index];
  const other = vipList[otherIndex];
  await transaction(async (client) => {
    await query('UPDATE tier_settings SET rank = $2 WHERE tier = $1', [current.id, other.rank], client);
    await query('UPDATE tier_settings SET rank = $2 WHERE tier = $1', [other.id, current.rank], client);
  });

  const tiers = await announceTiers(req);
  res.json({ tiers: tiers });
};

export const deleteTier = async (req, res) => {
  const tier = await findVipTier(req.params.tier);
  if (!tier) {
    res.status(400);
    throw new Error('ลบระดับนี้ไม่ได้');
  }

  const members = await getOne('SELECT count(*) AS total FROM user_vip WHERE tier = $1', [tier.id]);
  if (Number(members.total) > 0) {
    res.status(400);
    throw new Error('ยังมีผู้ใช้เป็น ' + tier.name + ' อยู่ ' + members.total + ' คน ยกเลิก VIP ของทุกคนก่อนจึงจะลบได้');
  }

  await transaction(async (client) => {
    await query('DELETE FROM vip_codes WHERE tier = $1', [tier.id], client);
    await query('DELETE FROM tier_settings WHERE tier = $1', [tier.id], client);
  });
  await addAdminLog(req.adminUser.id, 'vip_settings', req.adminUser.name + ' ลบระดับ VIP ' + tier.name);

  const tiers = await announceTiers(req);
  res.json({ tiers: tiers });
};
