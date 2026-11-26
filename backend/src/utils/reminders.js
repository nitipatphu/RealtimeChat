import { getMany } from '../config/database.js';
import { addNotification } from './notifications.js';
import { checkVipExpiry } from '../controllers/vipController.js';
import { cleanUnusedUploads } from './uploadCleanup.js';

export async function checkDueTasks(app) {
  const fakeReq = { app: app };

  const tasks = await getMany(
    `UPDATE tasks t SET reminded_for = t.due_date::text || ':' || CASE WHEN t.due_date = CURRENT_DATE THEN 'today' ELSE 'tomorrow' END
     FROM projects p, groups g
     WHERE p.id = t.project_id AND g.id = p.group_id
       AND t.due_date IN (CURRENT_DATE, CURRENT_DATE + 1)
       AND t.column_id <> (SELECT c.id FROM board_columns c WHERE c.project_id = p.id ORDER BY c.position DESC LIMIT 1)
       AND EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id)
       AND t.reminded_for IS DISTINCT FROM t.due_date::text || ':' || CASE WHEN t.due_date = CURRENT_DATE THEN 'today' ELSE 'tomorrow' END
     RETURNING t.id, t.title, t.due_date, p.id AS project_id, p.name AS project_name, g.id AS group_id, g.name AS group_name,
       (t.due_date = CURRENT_DATE) AS is_today`
  );

  for (const task of tasks) {
    const assignees = await getMany('SELECT user_id FROM task_assignees WHERE task_id = $1', [task.id]);
    const when = task.is_today ? 'วันนี้' : 'พรุ่งนี้';
    for (const row of assignees) {
      await addNotification(fakeReq, row.user_id, {
        type: 'task',
        title: 'งาน "' + task.title + '" ครบกำหนด' + when,
        body: task.project_name + ' · ' + task.group_name,
        target: { type: 'project', groupId: task.group_id, id: task.project_id }
      });
    }
  }

  const events = await getMany(
    `UPDATE group_events e SET reminded_for = CURRENT_DATE
     FROM groups g
     WHERE g.id = e.group_id AND e.event_date = CURRENT_DATE AND e.reminded_for IS DISTINCT FROM CURRENT_DATE
     RETURNING e.id, e.title, e.event_date, e.event_time, g.id AS group_id, g.name AS group_name`
  );

  for (const event of events) {
    const members = await getMany('SELECT user_id FROM group_members WHERE group_id = $1', [event.group_id]);
    const timeText = event.event_time ? ' เวลา ' + String(event.event_time).slice(0, 5) + ' น.' : '';
    for (const row of members) {
      await addNotification(fakeReq, row.user_id, {
        type: 'event',
        title: 'วันนี้มีนัด: ' + event.title + timeText,
        body: event.group_name,
        target: { type: 'calendar', groupId: event.group_id, id: event.event_date }
      });
    }
  }
}

async function runSafely(work, app) {
  try {
    await work(app);
  } catch (error) {
    console.log('reminder error:', error.message);
  }
}

export function startReminders(app) {
  setTimeout(() => runSafely(checkDueTasks, app), 5000);
  setInterval(() => runSafely(checkDueTasks, app), 30 * 60 * 1000);
  setTimeout(() => runSafely(checkVipExpiry, app), 6000);
  setInterval(() => runSafely(checkVipExpiry, app), 10 * 60 * 1000);
  setInterval(() => runSafely(cleanOldSessions, app), 6 * 60 * 60 * 1000);
  setTimeout(() => runSafely(cleanUnusedUploads, app), 60 * 1000);
  setInterval(() => runSafely(cleanUnusedUploads, app), 6 * 60 * 60 * 1000);
}

async function cleanOldSessions() {
  await getMany('DELETE FROM sessions WHERE expires_at < now() RETURNING token');
}
