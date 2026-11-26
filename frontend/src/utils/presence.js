export const PRESENCE = {
  online: { label: 'ออนไลน์', desc: 'พร้อมคุย' },
  busy: { label: 'ไม่ว่าง', desc: 'ปิดเสียงและป๊อปอัปแจ้งเตือน' },
  sleep: { label: 'นอน', desc: 'พักผ่อนอยู่ อาจตอบช้า' },
  offline: { label: 'ออฟไลน์', desc: 'คนอื่นจะเห็นว่าคุณออฟไลน์' }
};

export const PRESENCE_ORDER = ['online', 'busy', 'sleep', 'offline'];

export function getPresence(user, onlineUserIds) {
  if (!user) return 'offline';
  if (!(onlineUserIds || []).includes(user.id)) return 'offline';
  if (user.presence === 'busy' || user.presence === 'sleep' || user.presence === 'offline') {
    return user.presence;
  }
  return 'online';
}
