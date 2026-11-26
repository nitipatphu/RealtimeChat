import crypto from 'crypto';

export function makeId(prefix) {
  return prefix + '-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
}

export function makeInviteCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code = code + letters[crypto.randomInt(letters.length)];
  }
  return code;
}

export function makeAvatar(name) {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random';
}

export function cleanEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
