import { query } from '../config/database.js';
import { sendGroupUpdate } from '../utils/socketEvents.js';
import { hasPermission, isGroupMember } from '../utils/permissions.js';
import { addGroupLog, getUserName } from '../utils/logs.js';
import { loadGroup } from '../models/groupModel.js';

async function loadProject(req, res) {
  const group = await loadGroup(req.params.groupId);
  const project = group ? group.projects.find(p => p.id === req.params.projectId) : null;
  if (!project) {
    res.status(404);
    throw new Error('ไม่พบ Project นี้');
  }
  return { group, project };
}

function checkCanManage(group, project, userId, res) {
  const isProjectMember = project.members.includes(userId) && isGroupMember(group, userId);
  if (!isProjectMember && !hasPermission(group, userId, 'manage_projects')) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์จัดการสมาชิก Project นี้');
  }
}

async function sendProject(req, res, groupId, projectId) {
  const group = await loadGroup(groupId);
  sendGroupUpdate(req, group);
  res.json(group.projects.find(p => p.id === projectId));
}

export const addMemberToProject = async (req, res) => {
  const { memberId } = req.body;
  const { group, project } = await loadProject(req, res);
  checkCanManage(group, project, req.userId, res);

  if (!isGroupMember(group, memberId)) {
    res.status(400);
    throw new Error('ผู้ใช้ต้องเป็นสมาชิก Group ก่อน');
  }

  if (!project.members.includes(memberId)) {
    await query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [project.id, memberId]);
    await addGroupLog(group.id, req.userId, 'project_member', (await getUserName(req.userId)) + ' เพิ่ม ' + (await getUserName(memberId)) + ' เข้า Project ' + project.name);
  }

  await sendProject(req, res, group.id, project.id);
};

export const removeMemberFromProject = async (req, res) => {
  const { memberId } = req.params;
  const { group, project } = await loadProject(req, res);
  checkCanManage(group, project, req.userId, res);

  await query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [project.id, memberId]);
  await addGroupLog(group.id, req.userId, 'project_member', (await getUserName(req.userId)) + ' นำ ' + (await getUserName(memberId)) + ' ออกจาก Project ' + project.name);

  await sendProject(req, res, group.id, project.id);
};
