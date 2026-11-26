import { query } from '../config/database.js';
import { makeId } from './id.js';
export { getUserName } from '../models/userModel.js';

export async function addGroupLog(groupId, actorId, action, text, client) {
  await query(
    'INSERT INTO group_logs (id, group_id, action, actor_id, text) VALUES ($1, $2, $3, $4, $5)',
    [makeId('glog'), groupId, action, actorId || null, text],
    client
  );
}

export async function addAdminLog(actorId, action, text, client) {
  await query(
    'INSERT INTO admin_logs (id, action, actor_id, text) VALUES ($1, $2, $3, $4)',
    [makeId('alog'), action, actorId || null, text],
    client
  );
}
