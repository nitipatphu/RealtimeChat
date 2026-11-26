import { getMany } from '../config/database.js';

export const VIP_TIERS = ['vip', 'supervip'];
export const ALL_TIERS = ['none', 'vip', 'supervip'];

export const VIP_NAMES = { vip: 'VIP', supervip: 'SUPER VIP' };

export const PRESET_THEMES = ['sakura', 'midnight', 'ocean', 'forest'];

export const MAX_FILE_MB = 100;

export const DEFAULT_TIER_SETTINGS = {
  none: { fileMB: 5, presetThemes: [], customTheme: false },
  vip: { fileMB: 25, presetThemes: ['sakura', 'midnight'], customTheme: true },
  supervip: { fileMB: 50, presetThemes: ['sakura', 'midnight', 'ocean', 'forest'], customTheme: true }
};

export function getVipTier(user) {
  if (!user || !user.vip) return null;
  if (!VIP_TIERS.includes(user.vip.tier)) return null;
  if (user.vip.expiresAt && new Date(user.vip.expiresAt).getTime() <= Date.now()) return null;
  return user.vip.tier;
}

export async function getTierSettings() {
  const rows = await getMany('SELECT * FROM tier_settings');
  const result = {};
  ALL_TIERS.forEach(tier => {
    const row = rows.find(r => r.tier === tier);
    result[tier] = row
      ? { fileMB: row.file_mb, presetThemes: row.preset_themes || [], customTheme: row.custom_theme }
      : { ...DEFAULT_TIER_SETTINGS[tier] };
  });
  return result;
}

export async function getPerks(user) {
  const tier = getVipTier(user) || 'none';
  const tiers = await getTierSettings();
  return tiers[tier];
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

export function cleanTierSettings(input) {
  const result = {};
  ALL_TIERS.forEach(tier => {
    const item = (input && input[tier]) || {};
    const fileMB = Math.round(Number(item.fileMB));
    if (!fileMB || fileMB < 1 || fileMB > MAX_FILE_MB) {
      throw new Error('ขนาดไฟล์ต้องอยู่ระหว่าง 1 ถึง ' + MAX_FILE_MB + ' MB');
    }
    result[tier] = {
      fileMB: fileMB,
      presetThemes: Array.isArray(item.presetThemes) ? PRESET_THEMES.filter(t => item.presetThemes.includes(t)) : [],
      customTheme: item.customTheme === true
    };
  });
  return result;
}

export function tierRank(tier) {
  if (tier === 'supervip') return 2;
  if (tier === 'vip') return 1;
  return 0;
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
