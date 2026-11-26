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
  soundType: 'ding',
  volume: 60,
  desktop: false
};

export function loadSettings() {
  const saved = localStorage.getItem('settings');
  if (!saved) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch (error) {
    console.log(error);
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
  } catch (error) {
    console.log(error);
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
  } catch (error) {
    console.log(error);
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

export const SOUND_TYPES = [
  { id: 'ding', label: 'ติ๊ง' },
  { id: 'pop', label: 'ป๊อป' },
  { id: 'bell', label: 'กระดิ่ง' },
  { id: 'chime', label: 'กริ๊ง' }
];

let audio = null;
let lastPlayed = 0;

function getAudio() {
  if (!audio) {
    audio = new AudioContext();
  }
  if (audio.state === 'suspended') {
    audio.resume();
  }
  return audio;
}

function playTone(frequency, endFrequency, start, length, volume, wave) {
  const ctx = getAudio();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const begin = ctx.currentTime + start;

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, begin);
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, begin + length);
  }

  gain.gain.setValueAtTime(0.0001, begin);
  gain.gain.exponentialRampToValueAtTime(volume, begin + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, begin + length);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(begin);
  oscillator.stop(begin + length + 0.05);
}

function playPattern(type, volume, start) {
  if (type === 'pop') {
    playTone(700, 180, start, 0.12, volume, 'sine');
    return 0.14;
  }
  if (type === 'bell') {
    playTone(660, null, start, 0.7, volume, 'sine');
    playTone(1320, null, start, 0.5, volume * 0.4, 'sine');
    return 0.3;
  }
  if (type === 'chime') {
    playTone(784, null, start, 0.18, volume, 'triangle');
    playTone(1047, null, start + 0.12, 0.3, volume, 'triangle');
    return 0.3;
  }
  playTone(880, null, start, 0.25, volume, 'sine');
  return 0.2;
}

export function previewSound(type, volumePercent, isMention) {
  const volume = (volumePercent / 100) * 0.4;
  if (volume <= 0) return;
  try {
    const gap = playPattern(type, volume, 0);
    if (isMention) {
      playPattern(type, volume, gap);
    }
  } catch (error) {
    console.error('Cannot play sound:', error);
  }
}

export function playSound(kind) {
  const settings = loadSettings();
  if (!settings.sound) return;

  const now = Date.now();
  if (now - lastPlayed < 400) return;
  lastPlayed = now;

  previewSound(settings.soundType, settings.volume, kind === 'mention');
}

export function showDesktopNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  new Notification(title, { body: body });
}
