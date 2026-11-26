import { getMany } from '../config/database.js';
import { addMessage } from '../controllers/channelController.js';
import { addProjectMessage } from '../controllers/projectChatController.js';
import { addDmMessage } from '../controllers/dmController.js';
import { addGroupChatMessage } from '../controllers/conversationController.js';
import { checkProjectAccess } from '../middlewares/checkProjectAccess.js';
import { toScheduledItem } from '../controllers/scheduleController.js';
import { addNotification } from './notifications.js';
import { sendToUser } from './socketEvents.js';

async function runHandler(handler, req) {
  let statusCode = 200;
  let result = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      result = data;
    }
  };

  try {
    let passed = false;
    await handler(req, res, () => {
      passed = true;
    });
    if (passed) return { ok: true, passed: true };
    return { ok: statusCode < 400, data: result };
  } catch (error) {
    return { ok: false, error: error };
  }
}

async function sendOne(app, item) {
  const target = item.target;
  const req = { app: app, userId: item.userId, body: { text: item.text }, query: {}, method: 'POST', params: {} };

  if (target.type === 'channel') {
    req.params = { id: target.channelId };
    return runHandler(addMessage, req);
  }
  if (target.type === 'dm') {
    req.params = { otherUserId: target.otherUserId };
    return runHandler(addDmMessage, req);
  }
  if (target.type === 'gdm') {
    req.params = { id: target.conversationId };
    return runHandler(addGroupChatMessage, req);
  }
  if (target.type === 'project') {
    req.params = { groupId: target.groupId, projectId: target.projectId, channelId: target.channelId };
    const access = await runHandler(checkProjectAccess, req);
    if (!access.passed) return access;
    return runHandler(addProjectMessage, req);
  }
  return { ok: false, error: new Error('ไม่รู้จักห้องปลายทาง') };
}

let running = false;

export async function sendDueMessages(app) {
  if (running) return;
  running = true;

  try {
    const rows = await getMany('DELETE FROM scheduled_messages WHERE send_at <= now() RETURNING *');
    const fakeReq = { app: app };

    for (const row of rows) {
      const item = await toScheduledItem(row);
      const result = await sendOne(app, item);
      if (!result.ok) {
        const reason = result.error ? result.error.message : 'ไม่ทราบสาเหตุ';
        await addNotification(fakeReq, item.userId, {
          type: 'system',
          title: 'ส่งข้อความที่ตั้งเวลาไว้ไม่สำเร็จ',
          body: reason + ' · "' + item.text.slice(0, 60) + '"',
          target: null
        });
      }
      sendToUser(fakeReq, item.userId, 'scheduled:changed', {});
    }
  } catch (error) {
    console.log('scheduler error:', error.message);
  } finally {
    running = false;
  }
}

export function startScheduler(app) {
  setInterval(() => sendDueMessages(app), 15 * 1000);
}
