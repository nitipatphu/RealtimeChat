export const SERVER_URL = import.meta.env.VITE_API_URL || '';
export const API_URL = SERVER_URL + '/api';

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function saveToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function handleExpired() {
  if (!getToken()) return;
  saveToken('');
  localStorage.removeItem('user');
  localStorage.removeItem('groupId');
  window.location.reload();
}

async function readResponse(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401) {
    handleExpired();
  }
  if (!res.ok) {
    throw new Error(data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
  return data;
}

export async function apiGet(path) {
  const res = await fetch(API_URL + path, { headers: authHeaders() });
  return readResponse(res);
}

export async function apiSend(method, path, body) {
  const res = await fetch(API_URL + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body || {})
  });
  return readResponse(res);
}

export async function apiUpload(path, formData) {
  const res = await fetch(API_URL + path, { method: 'POST', headers: authHeaders(), body: formData });
  return readResponse(res);
}
