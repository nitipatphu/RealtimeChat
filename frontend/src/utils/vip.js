export const VIP_NAMES = { vip: 'VIP', supervip: 'SUPER VIP' };
export const TIER_NAMES = { none: 'ทั่วไป', vip: 'VIP', supervip: 'SUPER VIP' };

export const VIP_THEMES = [
  { id: 'sakura', label: 'Sakura', dark: false, colors: ['#fff7fb', '#ffffff', '#ec4899'] },
  { id: 'midnight', label: 'Midnight', dark: true, colors: ['#0c0a18', '#17132a', '#8b5cf6'] },
  { id: 'ocean', label: 'Ocean', dark: true, colors: ['#07121a', '#0f1d26', '#06b6d4'] },
  { id: 'forest', label: 'Forest', dark: false, colors: ['#f6fbf8', '#ffffff', '#10b981'] }
];

let tierSettings = {
  none: { fileMB: 5, presetThemes: [], customTheme: false },
  vip: { fileMB: 25, presetThemes: ['sakura', 'midnight'], customTheme: true },
  supervip: { fileMB: 50, presetThemes: ['sakura', 'midnight', 'ocean', 'forest'], customTheme: true }
};

export function setTierSettings(next) {
  if (next) tierSettings = next;
}

export function getTierSettings() {
  return tierSettings;
}

export function getVipTier(user) {
  if (!user || !user.vip) return null;
  if (user.vip.tier !== 'vip' && user.vip.tier !== 'supervip') return null;
  if (user.vip.expiresAt && new Date(user.vip.expiresAt).getTime() <= Date.now()) return null;
  return user.vip.tier;
}

export function getPerks(user) {
  return tierSettings[getVipTier(user) || 'none'];
}

export function canUseTheme(user, themeId) {
  if (themeId === 'custom') {
    if (!user || !user.customTheme) return false;
    return getPerks(user).customTheme === true;
  }
  if (!VIP_THEMES.some(t => t.id === themeId)) return true;
  return getPerks(user).presetThemes.includes(themeId);
}

export function lowestTierFor(themeId) {
  if (tierSettings.none.presetThemes.includes(themeId)) return 'none';
  if (tierSettings.vip.presetThemes.includes(themeId)) return 'vip';
  if (tierSettings.supervip.presetThemes.includes(themeId)) return 'supervip';
  return null;
}

export function vipNameClass(user) {
  const tier = getVipTier(user);
  if (tier === 'supervip') return 'bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent';
  if (tier === 'vip') return 'bg-gradient-to-r from-fuchsia-500 to-indigo-500 bg-clip-text text-transparent';
  return '';
}

function toRgb(hex) {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

export function mixColor(hexA, hexB, amountOfB) {
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  const parts = a.map((value, index) => Math.round(value + (b[index] - value) * amountOfB));
  return '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
}

export function buildCustomPalette(theme) {
  const accent = theme.accent;
  const bg = theme.background;
  const dark = theme.mode === 'dark';

  const palette = {
    '--color-indigo-50': dark ? mixColor(accent, bg, 0.8) : mixColor(accent, '#ffffff', 0.9),
    '--color-indigo-100': dark ? mixColor(accent, bg, 0.7) : mixColor(accent, '#ffffff', 0.8),
    '--color-indigo-200': dark ? mixColor(accent, bg, 0.55) : mixColor(accent, '#ffffff', 0.65),
    '--color-indigo-300': mixColor(accent, '#ffffff', 0.4),
    '--color-indigo-400': mixColor(accent, '#ffffff', 0.2),
    '--color-indigo-500': accent,
    '--color-indigo-600': mixColor(accent, '#000000', 0.12),
    '--color-indigo-700': dark ? mixColor(accent, '#ffffff', 0.35) : mixColor(accent, '#000000', 0.25),
    '--custom-bg': bg,
    '--custom-accent-text': dark ? mixColor(accent, '#ffffff', 0.35) : mixColor(accent, '#000000', 0.15)
  };

  if (dark) {
    palette['--color-white'] = mixColor(bg, '#ffffff', 0.06);
    palette['--color-slate-50'] = mixColor(bg, '#ffffff', 0.03);
    palette['--color-slate-100'] = mixColor(bg, '#ffffff', 0.1);
    palette['--color-slate-200'] = mixColor(bg, '#ffffff', 0.16);
    palette['--color-slate-300'] = mixColor(bg, '#ffffff', 0.24);
  } else {
    palette['--color-white'] = mixColor(bg, '#ffffff', 0.85);
    palette['--color-slate-50'] = mixColor(bg, '#000000', 0.02);
  }
  return palette;
}

export const CUSTOM_PALETTE_KEYS = [
  '--color-indigo-50', '--color-indigo-100', '--color-indigo-200', '--color-indigo-300', '--color-indigo-400',
  '--color-indigo-500', '--color-indigo-600', '--color-indigo-700', '--custom-bg', '--custom-accent-text',
  '--color-white', '--color-slate-50', '--color-slate-100', '--color-slate-200', '--color-slate-300'
];
