import { query, getOne, getMany } from '../config/database.js';

export const NO_TIER = 'none';

export const PRESET_THEMES = ['sakura', 'midnight', 'ocean', 'forest'];

export const MAX_FILE_MB = 1000;

const DEFAULT_TIERS = [
  { tier: 'none', name: 'ทั่วไป', icon: '', color: '#64748b', rank: 0 },
  { tier: 'vip', name: 'VIP', icon: '💎', color: '#c026d3', rank: 1 },
  { tier: 'supervip', name: 'SUPER VIP', icon: '👑', color: '#f59e0b', rank: 2 }
];

export async function updateTierTable() {
  await query('ALTER TABLE tier_settings DROP CONSTRAINT IF EXISTS tier_settings_tier_check');
  await query('ALTER TABLE user_vip DROP CONSTRAINT IF EXISTS user_vip_tier_check');
  await query('ALTER TABLE vip_codes DROP CONSTRAINT IF EXISTS vip_codes_tier_check');
  await query('ALTER TABLE tier_settings DROP CONSTRAINT IF EXISTS tier_settings_file_mb_check');
  await query('ALTER TABLE tier_settings ADD CONSTRAINT tier_settings_file_mb_check CHECK (file_mb BETWEEN 1 AND ' + MAX_FILE_MB + ')');
  await query("ALTER TABLE tier_settings ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''");
  await query("ALTER TABLE tier_settings ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT ''");
  await query("ALTER TABLE tier_settings ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#6366f1'");
  await query('ALTER TABLE tier_settings ADD COLUMN IF NOT EXISTS rank INTEGER NOT NULL DEFAULT 1');

  for (const item of DEFAULT_TIERS) {
    await query(
      "UPDATE tier_settings SET name = $2, icon = $3, color = $4, rank = $5 WHERE tier = $1 AND name = ''",
      [item.tier, item.name, item.icon, item.color, item.rank]
    );
  }
  await query(
    "INSERT INTO tier_settings (tier, file_mb, preset_themes, custom_theme, name, icon, color, rank) VALUES ('none', 5, '{}', false, 'ทั่วไป', '', '#64748b', 0) ON CONFLICT DO NOTHING"
  );

  const userFk = await getOne("SELECT 1 FROM pg_constraint WHERE conname = 'user_vip_tier_fkey'");
  if (!userFk) {
    await query('ALTER TABLE user_vip ADD CONSTRAINT user_vip_tier_fkey FOREIGN KEY (tier) REFERENCES tier_settings(tier)');
  }
  const codeFk = await getOne("SELECT 1 FROM pg_constraint WHERE conname = 'vip_codes_tier_fkey'");
  if (!codeFk) {
    await query('ALTER TABLE vip_codes ADD CONSTRAINT vip_codes_tier_fkey FOREIGN KEY (tier) REFERENCES tier_settings(tier)');
  }
}

function toTier(row) {
  return {
    id: row.tier,
    name: row.name,
    icon: row.icon,
    color: row.color,
    rank: row.rank,
    fileMB: row.file_mb,
    presetThemes: row.preset_themes || [],
    customTheme: row.custom_theme
  };
}

export async function getTierList() {
  const rows = await getMany('SELECT * FROM tier_settings ORDER BY rank, tier');
  return rows.map(toTier);
}

export async function getTierSettings() {
  const list = await getTierList();
  const result = {};
  list.forEach(item => {
    result[item.id] = item;
  });
  return result;
}

export async function findVipTier(tierId) {
  if (!tierId || tierId === NO_TIER) return null;
  const row = await getOne('SELECT * FROM tier_settings WHERE tier = $1', [tierId]);
  if (!row) return null;
  return toTier(row);
}

export async function getTierName(tierId) {
  const tier = await findVipTier(tierId);
  if (!tier) return 'VIP';
  return tier.name;
}

export function getVipTier(user) {
  if (!user || !user.vip) return null;
  if (!user.vip.tier || user.vip.tier === NO_TIER) return null;
  if (user.vip.expiresAt && new Date(user.vip.expiresAt).getTime() <= Date.now()) return null;
  return user.vip.tier;
}

export async function getPerks(user) {
  const tiers = await getTierSettings();
  const tier = getVipTier(user);
  if (tier && tiers[tier]) return tiers[tier];
  return tiers[NO_TIER];
}

export async function getBiggestFileMB() {
  const row = await getOne('SELECT max(file_mb) AS biggest FROM tier_settings');
  return Number(row.biggest) || 0;
}

export async function canUseTheme(user, theme) {
  const perks = await getPerks(user);
  if (theme === 'custom') {
    if (!user || !user.customTheme) return false;
    return perks.customTheme === true;
  }
  if (!PRESET_THEMES.includes(theme)) return true;
  return perks.presetThemes.includes(theme);
}

export function cleanTierInput(input) {
  const item = input || {};
  const name = String(item.name || '').trim().slice(0, 30);
  if (!name) {
    throw new Error('กรุณาตั้งชื่อระดับ');
  }

  const fileMB = Math.round(Number(item.fileMB));
  if (!fileMB || fileMB < 1 || fileMB > MAX_FILE_MB) {
    throw new Error('ขนาดไฟล์ต้องอยู่ระหว่าง 1 ถึง ' + MAX_FILE_MB + ' MB');
  }

  let color = String(item.color || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    color = '#6366f1';
  }

  let presetThemes = [];
  if (Array.isArray(item.presetThemes)) {
    presetThemes = PRESET_THEMES.filter(t => item.presetThemes.includes(t));
  }

  return {
    name: name,
    icon: String(item.icon || '').trim().slice(0, 8),
    color: color,
    fileMB: fileMB,
    presetThemes: presetThemes,
    customTheme: item.customTheme === true
  };
}

export function makeVipRecord(user, tier, days, byId, source) {
  const now = Date.now();
  const currentTier = getVipTier(user);
  let start = now;

  if (currentTier === tier && user.vip.expiresAt) {
    start = Math.max(now, new Date(user.vip.expiresAt).getTime());
  }

  return {
    tier: tier,
    since: currentTier ? user.vip.since : new Date(now).toISOString(),
    expiresAt: new Date(start + days * 24 * 60 * 60 * 1000).toISOString(),
    grantedBy: byId,
    source: source
  };
}

export function makeVipCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let text = '';
  for (let i = 0; i < 8; i++) {
    text = text + letters[Math.floor(Math.random() * letters.length)];
  }
  return 'VIP-' + text.slice(0, 4) + '-' + text.slice(4);
}

export function formatThaiDate(value) {
  const date = new Date(value);
  return date.getDate() + '/' + (date.getMonth() + 1) + '/' + (date.getFullYear() + 543);
}
