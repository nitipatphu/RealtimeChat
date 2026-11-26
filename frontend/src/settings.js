import { apiSend } from './api';
import { VIP_THEMES, canUseTheme, buildCustomPalette, CUSTOM_PALETTE_KEYS } from './utils/vip';

const DEFAULT_SETTINGS = {
  theme: 'light',
  fontSize: 'normal',
  notifyDm: true,
  notifyMention: true,
  notifyChannel: false,
  notifyTask: true,
  sound: true,
  desktop: false
};

export function loadSettings() {
  const saved = localStorage.getItem('settings');
  if (!saved) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem('settings', JSON.stringify(settings));
  applySettings(settings);

  const savedUser = localStorage.getItem('user');
  if (!savedUser) return;

  try {
    const user = JSON.parse(savedUser);
    apiSend('PUT', '/users/' + user.id + '/settings', { settings: settings }).catch(() => {});
  } catch {
    return;
  }
}

export function setSettingsFromServer(serverSettings) {
  const settings = { ...DEFAULT_SETTINGS, ...serverSettings };
  localStorage.setItem('settings', JSON.stringify(settings));
  applySettings(settings);
}

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export function applySettings(settings) {
  const html = document.documentElement;
  let theme = settings.theme;
  if (!canUseTheme(getSavedUser(), theme)) {
    theme = 'light';
  }

  let isDark = theme === 'dark';
  if (theme === 'system') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  VIP_THEMES.forEach(item => html.classList.remove('theme-' + item.id));
  html.classList.remove('theme-custom');
  CUSTOM_PALETTE_KEYS.forEach(key => html.style.removeProperty(key));

  const vipTheme = VIP_THEMES.find(item => item.id === theme);
  if (vipTheme) {
    html.classList.add('theme-' + vipTheme.id);
    isDark = vipTheme.dark;
  }

  if (theme === 'custom') {
    const customTheme = getSavedUser().customTheme;
    const palette = buildCustomPalette(customTheme);
    Object.keys(palette).forEach(key => html.style.setProperty(key, palette[key]));
    html.classList.add('theme-custom');
    isDark = customTheme.mode === 'dark';
  }

  if (isDark) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  html.classList.remove('app-font-small', 'app-font-large');
  if (settings.fontSize === 'small') {
    html.classList.add('app-font-small');
  }
  if (settings.fontSize === 'large') {
    html.classList.add('app-font-large');
  }
}

export function playSound() {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.1;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.15);
  } catch (error) {
    console.error('Cannot play sound:', error);
  }
}

export function showDesktopNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  new Notification(title, { body: body });
}
