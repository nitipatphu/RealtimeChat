export function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const time = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === today.toDateString()) {
    return time;
  }
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + time;
}

export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value) {
  if (!value) return '-';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

  if (seconds < 60) return 'เมื่อสักครู่';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' นาทีที่แล้ว';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' ชั่วโมงที่แล้ว';
  const days = Math.floor(hours / 24);
  if (days < 30) return days + ' วันที่แล้ว';
  return formatDate(value);
}

export function formatSize(size) {
  if (!size) return '';
  if (size < 1024 * 1024) return Math.round(size / 1024) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

export function shortDay(dateKey) {
  const date = new Date(dateKey + 'T00:00:00');
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function isSameDay(a, b) {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function dayLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'วันนี้';
  if (date.toDateString() === yesterday.toDateString()) return 'เมื่อวาน';
  return date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
}
