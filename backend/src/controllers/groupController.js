import fs from 'fs';
import { query, getOne, getMany, transaction } from '../config/database.js';
import { pickGroupColor } from '../config/colors.js';
import { sendGroupUpdate, sendGroupDeleted, removeUserFromGroupRoom, sendToUser } from '../utils/socketEvents.js';
import { hasPermission, isGroupMember, makeDefaultRoles, canSeeProject } from '../utils/permissions.js';
import { addGroupLog, addAdminLog, getUserName } from '../utils/logs.js';
import { toGroupSummary, GROUP_SUMMARY_SQL, viewGroupFor } from '../utils/groupView.js';
import { makeInviteCode } from '../utils/id.js';
import { addNotification } from '../utils/notifications.js';
import { isBanned, findInvite, isInviteUsable } from '../utils/moderation.js';
import { deleteUploadedFile } from '../middlewares/uploadMiddleware.js';
import { loadGroup, loadGroupOr404, loadGroups, getGroupIdsForUser, getGroupLogs as readGroupLogs } from '../models/groupModel.js';
import { isSystemAdmin } from '../models/userModel.js';

function requirePermission(group, userId, permission, res, message) {
  if (!hasPermission(group, userId, permission)) {
    res.status(403);
    throw new Error(message || 'คุณไม่มีสิทธิ์ทำรายการนี้');
  }
}

async function createProjectRecords(client, groupId, name, memberIds) {
  const projectId = 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  await query('INSERT INTO projects (id, group_id, name) VALUES ($1, $2, $3)', [projectId, groupId, name], client);
  for (const memberId of memberIds) {
    await query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [projectId, memberId], client);
  }
  await query('INSERT INTO project_channels (id, project_id, name) VALUES ($1, $2, $3)', ['pc-' + projectId, projectId, 'general'], client);
  const columns = ['To Do', 'Doing', 'Done'];
  for (let i = 0; i < columns.length; i++) {
    await query('INSERT INTO board_columns (id, project_id, title, position) VALUES ($1, $2, $3, $4)', ['col-' + i + '-' + projectId, projectId, columns[i], i], client);
  }
  return projectId;
}

export async function createGroupRecords(client, data) {
  const now = Date.now();
  const groupId = 'g-' + now;
  const countRow = await getOne('SELECT count(*) AS total FROM groups', [], client);

  await query(
    'INSERT INTO groups (id, name, description, visibility, color, owner_id, invite_code) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [groupId, data.name, data.description || '', data.visibility === 'public' ? 'public' : 'private', pickGroupColor(Number(countRow.total)), data.ownerId, makeInviteCode()],
    client
  );
  await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, data.ownerId], client);

  const roles = makeDefaultRoles(now);
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    await query(
      'INSERT INTO group_roles (id, group_id, name, color, permissions, hoist, is_default, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [role.id, groupId, role.name, role.color, role.permissions, role.hoist === true, role.isDefault === true, i],
      client
    );
  }

  await query("INSERT INTO channels (id, group_id, name) VALUES ($1, $2, 'general')", ['ch-' + now, groupId], client);
  await createProjectRecords(client, groupId, 'Main Board', [data.ownerId]);
  return groupId;
}

export const getGroups = async (req, res) => {
  const groups = await loadGroups(await getGroupIdsForUser(req.userId));
  res.json(groups.map(group => viewGroupFor(group, req.userId)));
};

export const discoverGroups = async (req, res) => {
  const search = String(req.query.q || '').trim();
  const rows = await getMany(
    GROUP_SUMMARY_SQL + `
     WHERE g.visibility = 'public'
       AND NOT EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = $1)
       AND NOT EXISTS (SELECT 1 FROM group_bans b WHERE b.group_id = g.id AND b.user_id = $1)
       AND ($2 = '' OR g.name ILIKE '%' || $2 || '%' OR g.description ILIKE '%' || $2 || '%')
     ORDER BY g.created_at DESC LIMIT 50`,
    [req.userId, search]
  );
  res.json(rows.map(toGroupSummary));
};

export const createGroup = async (req, res) => {
  const { name, description, visibility } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อ Group');
  }
  if (name.trim().length > 50) {
    res.status(400);
    throw new Error('ชื่อกลุ่มยาวเกินไป');
  }
  if ((description || '').length > 200) {
    res.status(400);
    throw new Error('คำอธิบายยาวเกินไป');
  }

  const userName = await getUserName(req.userId);
  const groupId = await transaction(async (client) => {
    const id = await createGroupRecords(client, { name: name.trim(), description: (description || '').trim(), visibility: visibility, ownerId: req.userId });
    await addGroupLog(id, req.userId, 'group_create', userName + ' สร้างกลุ่ม ' + name.trim(), client);
    return id;
  });

  res.status(201).json(viewGroupFor(await loadGroup(groupId), req.userId));
};

async function addUserToGroup(req, groupId, userId, howText) {
  await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, userId]);
  await addGroupLog(groupId, userId, 'member_join', (await getUserName(userId)) + ' ' + howText);
  const group = await loadGroup(groupId);
  sendGroupUpdate(req, group);
  sendToUser(req, userId, 'group:added', { groupId: groupId });
  return group;
}

export const joinGroup = async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) {
    res.status(400);
    throw new Error('กรุณาระบุรหัสเชิญ');
  }

  const found = await findInvite(inviteCode);
  if (!found) {
    res.status(404);
    throw new Error('รหัสเชิญไม่ถูกต้อง');
  }
  if (!isInviteUsable(found.invite)) {
    res.status(400);
    throw new Error('ลิงก์เชิญนี้หมดอายุหรือถูกใช้ครบจำนวนแล้ว');
  }

  const member = await getOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [found.groupId, req.userId]);
  if (member) {
    res.status(400);
    throw new Error('คุณเป็นสมาชิกของกลุ่มนี้อยู่แล้ว');
  }
  if (await isBanned(found.groupId, req.userId)) {
    res.status(403);
    throw new Error('คุณถูกแบนจากกลุ่มนี้');
  }

  if (found.invite) {
    const used = await query(
      'UPDATE group_invites SET uses = uses + 1 WHERE code = $1 AND (max_uses = 0 OR uses < max_uses) AND (expires_at IS NULL OR expires_at > now())',
      [found.invite.code]
    );
    if (used.rowCount === 0) {
      res.status(400);
      throw new Error('ลิงก์เชิญนี้หมดอายุหรือถูกใช้ครบจำนวนแล้ว');
    }
  }

  const howText = found.invite ? 'เข้าร่วมกลุ่มด้วยลิงก์เชิญ ' + found.invite.code : 'เข้าร่วมกลุ่มด้วยรหัสเชิญ';
  const group = await addUserToGroup(req, found.groupId, req.userId, howText);
  res.json({ message: 'เข้าร่วมกลุ่มสำเร็จ', group: viewGroupFor(group, req.userId) });
};

export const joinPublicGroup = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  if (group.visibility !== 'public') {
    res.status(403);
    throw new Error('กลุ่มนี้เป็น Private ต้องใช้รหัสเชิญ');
  }
  if (await isBanned(group.id, req.userId)) {
    res.status(403);
    throw new Error('คุณถูกแบนจากกลุ่มนี้');
  }
  if (isGroupMember(group, req.userId)) {
    res.status(400);
    throw new Error('คุณเป็นสมาชิกของกลุ่มนี้อยู่แล้ว');
  }

  const updated = await addUserToGroup(req, group.id, req.userId, 'เข้าร่วมกลุ่ม (Public)');
  res.json({ message: 'เข้าร่วมกลุ่มสำเร็จ', group: viewGroupFor(updated, req.userId) });
};

export async function removeMemberFromGroup(client, groupId, userId) {
  await query('DELETE FROM project_members WHERE user_id = $2 AND project_id IN (SELECT id FROM projects WHERE group_id = $1)', [groupId, userId], client);
  await query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId], client);
}

export const leaveGroup = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  if (group.ownerId === req.userId) {
    res.status(400);
    throw new Error('เจ้าของกลุ่มออกจากกลุ่มไม่ได้ ต้องโอนกลุ่มก่อน');
  }
  if (!isGroupMember(group, req.userId)) {
    res.status(400);
    throw new Error('คุณไม่ได้เป็นสมาชิกของกลุ่มนี้');
  }

  const userName = await getUserName(req.userId);
  await transaction(async (client) => {
    await removeMemberFromGroup(client, group.id, req.userId);
    await addGroupLog(group.id, req.userId, 'member_leave', userName + ' ออกจากกลุ่ม', client);
  });

  removeUserFromGroupRoom(req, req.userId, group.id);
  sendGroupUpdate(req, await loadGroup(group.id));
  res.json({ message: 'ออกจากกลุ่มเรียบร้อย' });
};

export const deleteGroup = async (req, res) => {
  const group = await loadGroupOr404(req.params.id, res);
  if (group.ownerId !== req.userId) {
    res.status(403);
    throw new Error('เฉพาะเจ้าของกลุ่มเท่านั้นที่ลบกลุ่มได้');
  }

  await query('DELETE FROM groups WHERE id = $1', [group.id]);
  sendGroupDeleted(req, group.id);
  res.json({ message: 'ลบสำเร็จ' });
};

export const updateGroupSettings = async (req, res) => {
  const { name, description, visibility, color } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อกลุ่ม');
  }
  if (name.trim().length > 50) {
    res.status(400);
    throw new Error('ชื่อกลุ่มยาวเกินไป');
  }
  if ((description || '').length > 200) {
    res.status(400);
    throw new Error('คำอธิบายยาวเกินไป');
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    res.status(400);
    throw new Error('สีไม่ถูกต้อง');
  }

  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_group', res, 'คุณไม่มีสิทธิ์แก้ไขกลุ่ม');

  const newVisibility = visibility === 'public' || visibility === 'private' ? visibility : group.visibility;
  const changes = [];
  if (group.name !== name.trim()) changes.push('ชื่อเป็น "' + name.trim() + '"');
  if ((group.description || '') !== (description || '').trim()) changes.push('คำอธิบาย');
  if (group.visibility !== newVisibility) changes.push('การมองเห็นเป็น ' + (newVisibility === 'public' ? 'Public' : 'Private'));
  if (color && group.color !== color) changes.push('สีกลุ่ม');

  await query(
    'UPDATE groups SET name = $2, description = $3, visibility = $4, color = COALESCE($5, color) WHERE id = $1',
    [group.id, name.trim(), (description || '').trim(), newVisibility, color || null]
  );
  if (changes.length > 0) {
    await addGroupLog(group.id, req.userId, 'settings_update', (await getUserName(req.userId)) + ' เปลี่ยน' + changes.join(', '));
  }

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.json(viewGroupFor(updated, req.userId));
};

export const regenerateInviteCode = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_group', res, 'คุณไม่มีสิทธิ์เปลี่ยนรหัสเชิญ');

  await query('UPDATE groups SET invite_code = $2 WHERE id = $1', [group.id, makeInviteCode()]);
  await addGroupLog(group.id, req.userId, 'invite_reset', (await getUserName(req.userId)) + ' สร้างรหัสเชิญใหม่');

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.json(viewGroupFor(updated, req.userId));
};

export const transferOwnership = async (req, res) => {
  const { newOwnerId } = req.body;
  const group = await loadGroupOr404(req.params.groupId, res);
  if (group.ownerId !== req.userId) {
    res.status(403);
    throw new Error('เฉพาะเจ้าของกลุ่มเท่านั้นที่โอนกลุ่มได้');
  }
  if (newOwnerId === req.userId) {
    res.status(400);
    throw new Error('คุณเป็นเจ้าของกลุ่มอยู่แล้ว');
  }
  if (!isGroupMember(group, newOwnerId)) {
    res.status(400);
    throw new Error('ผู้ใช้นี้ไม่ได้เป็นสมาชิกของกลุ่ม');
  }

  const bestRole = group.roles.find(r => !r.isDefault);
  const oldName = await getUserName(req.userId);
  const newName = await getUserName(newOwnerId);
  await transaction(async (client) => {
    await query('UPDATE groups SET owner_id = $2 WHERE id = $1', [group.id, newOwnerId], client);
    await query('DELETE FROM member_roles WHERE group_id = $1 AND user_id = $2', [group.id, newOwnerId], client);
    if (bestRole) {
      await query('INSERT INTO member_roles (group_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [group.id, req.userId, bestRole.id], client);
    }
    await addGroupLog(group.id, req.userId, 'owner_transfer', oldName + ' โอนความเป็นเจ้าของให้ ' + newName, client);
  });

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.json(viewGroupFor(updated, req.userId));
};

export const getGroupLogs = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  if (!(await isSystemAdmin(req.userId))) {
    requirePermission(group, req.userId, 'view_logs', res, 'คุณไม่มีสิทธิ์ดู Log ของกลุ่ม');
  }
  res.json(await readGroupLogs(group.id));
};

export const addProjectToGroup = async (req, res) => {
  const { projectName, members } = req.body;
  if (!projectName || !projectName.trim()) {
    res.status(400);
    throw new Error('กรุณาระบุชื่อ Project');
  }
  if (projectName.trim().length > 60) {
    res.status(400);
    throw new Error('ชื่อ Project ยาวเกินไป');
  }

  const group = await loadGroupOr404(req.params.groupId, res);
  const canCreate = hasPermission(group, req.userId, 'create_projects') || hasPermission(group, req.userId, 'manage_projects');
  if (!canCreate) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์สร้าง Project');
  }

  const projectMembers = (Array.isArray(members) ? members : []).filter(id => isGroupMember(group, id));
  if (!projectMembers.includes(req.userId)) projectMembers.push(req.userId);

  const userName = await getUserName(req.userId);
  const projectId = await transaction(async (client) => {
    const id = await createProjectRecords(client, group.id, projectName.trim(), projectMembers);
    await addGroupLog(group.id, req.userId, 'project_create', userName + ' สร้าง Project ' + projectName.trim(), client);
    return id;
  });

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.status(201).json(updated.projects.find(p => p.id === projectId));
};

function findProject(group, projectId, res) {
  const project = group.projects.find(p => p.id === projectId);
  if (!project) {
    res.status(404);
    throw new Error('ไม่พบ Project นี้');
  }
  return project;
}

export const deleteProjectFromGroup = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_projects', res, 'คุณไม่มีสิทธิ์ลบ Project');
  const project = findProject(group, req.params.projectId, res);

  await query('DELETE FROM projects WHERE id = $1', [project.id]);
  await addGroupLog(group.id, req.userId, 'project_delete', (await getUserName(req.userId)) + ' ลบ Project ' + project.name);

  sendGroupUpdate(req, await loadGroup(group.id));
  res.json({ message: 'ลบ Project สำเร็จ' });
};

export const archiveProject = async (req, res) => {
  const { archived } = req.body;
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_projects', res, 'คุณไม่มีสิทธิ์เก็บถาวร Project');
  const project = findProject(group, req.params.projectId, res);

  const isArchived = archived === true;
  await query('UPDATE projects SET archived_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1', [project.id, isArchived]);
  const actionText = isArchived ? ' เก็บถาวร Project ' : ' นำ Project ออกจากที่เก็บถาวร: ';
  await addGroupLog(group.id, req.userId, 'project_archive', (await getUserName(req.userId)) + actionText + project.name);

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.json(viewGroupFor(updated, req.userId));
};

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

export const updateProjectBoard = async (req, res) => {
  const { columns, tasks } = req.body;
  if (!Array.isArray(columns) || !Array.isArray(tasks) || columns.length > 20 || tasks.length > 500) {
    res.status(400);
    throw new Error('ข้อมูลบอร์ดไม่ถูกต้อง');
  }

  const group = await loadGroupOr404(req.params.groupId, res);
  const project = findProject(group, req.params.projectId, res);
  if (!canSeeProject(group, project, req.userId)) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์แก้บอร์ดนี้');
  }
  if (project.archived) {
    res.status(400);
    throw new Error('Project นี้ถูกเก็บถาวรแล้ว ต้องนำออกจากที่เก็บก่อนจึงจะแก้ไขได้');
  }

  const columnIds = columns.map(c => String(c.id || ''));
  let badColumns = false;
  columnIds.forEach((id, index) => {
    if (!id || columnIds.indexOf(id) !== index) badColumns = true;
  });
  if (badColumns) {
    res.status(400);
    throw new Error('คอลัมน์ไม่ถูกต้อง');
  }

  const otherColumns = await getMany('SELECT id FROM board_columns WHERE id = ANY($1) AND project_id <> $2', [columnIds, project.id]);
  const otherTasks = await getMany('SELECT id FROM tasks WHERE id = ANY($1) AND project_id <> $2', [tasks.map(t => String(t.id || '')), project.id]);
  if (otherColumns.length > 0 || otherTasks.length > 0) {
    res.status(400);
    throw new Error('ข้อมูลบอร์ดไม่ถูกต้อง');
  }

  const oldTasks = project.tasks;
  const changerName = await getUserName(req.userId);
  const newAssignments = [];

  await transaction(async (client) => {
    for (let i = 0; i < columns.length; i++) {
      await query(
        'INSERT INTO board_columns (id, project_id, title, position) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET title = $3, position = $4',
        [columnIds[i], project.id, cleanText(columns[i].title, 40) || 'คอลัมน์', i],
        client
      );
    }

    const keepTaskIds = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskId = String(task.id || '');
      if (!taskId || !columnIds.includes(task.status)) continue;
      keepTaskIds.push(taskId);

      const title = cleanText(task.title, 100) || 'งานใหม่';
      const priority = ['low', 'medium', 'high'].includes(task.priority) ? task.priority : null;
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || '') ? task.dueDate : null;
      await query(
        `INSERT INTO tasks (id, project_id, column_id, title, description, priority, due_date, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET column_id = $3, title = $4, description = $5, priority = $6,
           reminded_for = CASE WHEN tasks.due_date IS DISTINCT FROM $7::date THEN NULL ELSE tasks.reminded_for END,
           due_date = $7, position = $8`,
        [taskId, project.id, task.status, title, cleanText(task.description, 500), priority, dueDate, i],
        client
      );

      await query('DELETE FROM task_assignees WHERE task_id = $1', [taskId], client);
      const assignees = [];
      (Array.isArray(task.assigneeIds) ? task.assigneeIds : []).forEach(id => {
        if (typeof id === 'string' && isGroupMember(group, id) && !assignees.includes(id)) assignees.push(id);
      });
      for (const userId of assignees.slice(0, 20)) {
        await query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)', [taskId, userId], client);
      }

      await query('DELETE FROM task_checklist_items WHERE task_id = $1', [taskId], client);
      const checklist = Array.isArray(task.checklist) ? task.checklist.slice(0, 30) : [];
      for (let j = 0; j < checklist.length; j++) {
        const item = checklist[j];
        const itemText = cleanText(item.text, 200);
        if (!itemText) continue;
        await query(
          'INSERT INTO task_checklist_items (id, task_id, text, done, position) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
          [taskId + ':' + cleanText(item.id, 40), taskId, itemText, item.done === true, j],
          client
        );
      }

      const oldTask = oldTasks.find(t => t.id === taskId);
      const oldIds = oldTask ? oldTask.assigneeIds : [];
      assignees.forEach(assigneeId => {
        if (assigneeId === req.userId || oldIds.includes(assigneeId)) return;
        newAssignments.push({ assigneeId: assigneeId, title: title, teamSize: assignees.length });
      });
    }

    await query('DELETE FROM tasks WHERE project_id = $1 AND NOT (id = ANY($2))', [project.id, keepTaskIds], client);
    await query('DELETE FROM board_columns WHERE project_id = $1 AND NOT (id = ANY($2))', [project.id, columnIds], client);
  });

  for (const item of newAssignments) {
    const teamText = item.teamSize > 1 ? ' (ทำร่วมกัน ' + item.teamSize + ' คน)' : '';
    await addNotification(req, item.assigneeId, {
      type: 'task',
      title: changerName + ' มอบหมายงานให้คุณ' + teamText,
      body: item.title + ' (' + project.name + ')',
      target: { type: 'project', groupId: group.id, id: project.id }
    });
    sendToUser(req, item.assigneeId, 'task:assigned', {
      groupId: group.id,
      projectId: project.id,
      projectName: project.name,
      taskTitle: item.title,
      byName: changerName
    });
  }

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  const savedProject = updated.projects.find(p => p.id === project.id);
  res.json({ id: savedProject.id, columns: savedProject.columns, tasks: savedProject.tasks });
};

export const inspectGroup = async (req, res) => {
  if (!(await isSystemAdmin(req.userId))) {
    res.status(403);
    throw new Error('เฉพาะ Administrator เท่านั้นที่ใช้โหมดตรวจสอบได้');
  }

  const group = await loadGroupOr404(req.params.groupId, res);
  await addAdminLog(req.userId, 'group_inspect', (await getUserName(req.userId)) + ' เข้าดูกลุ่ม ' + group.name + ' ในโหมดตรวจสอบ');
  res.json(group);
};

function deleteIconFile(iconUrl) {
  deleteUploadedFile(iconUrl);
}

export const requireGroupManager = async (req, res, next) => {
  const group = await loadGroup(req.params.groupId);
  if (!group || !hasPermission(group, req.userId, 'manage_group')) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์เปลี่ยนรูปกลุ่ม');
  }
  next();
};

export const uploadGroupIcon = async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('ไม่พบไฟล์รูปภาพ');
  }

  const group = await loadGroup(req.params.groupId);
  if (!group || !hasPermission(group, req.userId, 'manage_group')) {
    fs.unlink(req.file.path, () => {});
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์เปลี่ยนรูปกลุ่ม');
  }

  deleteIconFile(group.icon);
  await query('UPDATE groups SET icon = $2 WHERE id = $1', [group.id, '/uploads/' + req.file.filename]);
  await addGroupLog(group.id, req.userId, 'settings_update', (await getUserName(req.userId)) + ' เปลี่ยนรูปไอคอนกลุ่ม');

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.json(viewGroupFor(updated, req.userId));
};

export const removeGroupIcon = async (req, res) => {
  const group = await loadGroupOr404(req.params.groupId, res);
  requirePermission(group, req.userId, 'manage_group', res, 'คุณไม่มีสิทธิ์เปลี่ยนรูปกลุ่ม');

  deleteIconFile(group.icon);
  await query('UPDATE groups SET icon = NULL WHERE id = $1', [group.id]);
  await addGroupLog(group.id, req.userId, 'settings_update', (await getUserName(req.userId)) + ' ลบรูปไอคอนกลุ่ม');

  const updated = await loadGroup(group.id);
  sendGroupUpdate(req, updated);
  res.json(viewGroupFor(updated, req.userId));
};

export const addTaskComment = async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) {
    res.status(400);
    throw new Error('กรุณาพิมพ์คอมเมนต์');
  }
  if (text.length > 1000) {
    res.status(400);
    throw new Error('คอมเมนต์ยาวเกินไป');
  }

  const group = await loadGroupOr404(req.params.groupId, res);
  const project = group.projects.find(p => p.id === req.params.projectId);
  if (!project || !canSeeProject(group, project, req.userId)) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์คอมเมนต์ในงานนี้');
  }
  const task = project.tasks.find(t => t.id === req.params.taskId);
  if (!task) {
    res.status(404);
    throw new Error('ไม่พบงานนี้');
  }

  const commentId = 'c' + Date.now();
  const createdAt = new Date().toISOString();
  await query('INSERT INTO task_comments (id, task_id, author_id, text, created_at) VALUES ($1, $2, $3, $4, $5)', [task.id + ':' + commentId, task.id, req.userId, text, createdAt]);

  const userName = await getUserName(req.userId);
  for (const assigneeId of task.assigneeIds) {
    if (assigneeId === req.userId) continue;
    await addNotification(req, assigneeId, {
      type: 'task',
      title: userName + ' คอมเมนต์ในงาน "' + task.title + '"',
      body: text,
      target: { type: 'project', groupId: group.id, id: project.id }
    });
  }

  sendGroupUpdate(req, await loadGroup(group.id));
  res.status(201).json({ id: commentId, authorId: req.userId, text: text, createdAt: createdAt });
};
