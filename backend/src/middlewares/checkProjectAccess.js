import { canSeeProject } from '../utils/permissions.js';
import { loadGroup } from '../models/groupModel.js';
import { isSystemAdmin } from '../models/userModel.js';

export const checkProjectAccess = async (req, res, next) => {
  const { groupId, projectId } = req.params;

  const group = await loadGroup(groupId);
  if (!group) {
    res.status(404);
    throw new Error('ไม่พบ Group นี้');
  }

  const project = group.projects.find(p => p.id === projectId);
  if (!project) {
    res.status(404);
    throw new Error('ไม่พบ Project นี้');
  }

  const adminReading = req.method === 'GET' && (await isSystemAdmin(req.userId));
  if (!adminReading && !canSeeProject(group, project, req.userId)) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์เข้าถึง Project นี้');
  }

  req.group = group;
  req.project = project;
  next();
};
