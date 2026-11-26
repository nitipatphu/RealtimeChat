import express from 'express';
import {
  getGroups,
  discoverGroups,
  createGroup,
  deleteGroup,
  joinGroup,
  joinPublicGroup,
  leaveGroup,
  addProjectToGroup,
  deleteProjectFromGroup,
  updateProjectBoard,
  updateGroupSettings,
  regenerateInviteCode,
  transferOwnership,
  getGroupLogs,
  inspectGroup,
  uploadGroupIcon,
  removeGroupIcon,
  addTaskComment,
  archiveProject,
  requireGroupManager
} from '../controllers/groupController.js';
import { banMember, unbanMember, timeoutMember, createInvite, deleteInvite } from '../controllers/moderationController.js';
import { createCategory, updateCategory, deleteCategory, createEvent, updateEvent, deleteEvent } from '../controllers/calendarController.js';
import { handleAvatarUpload } from '../middlewares/uploadMiddleware.js';
import {
  addGroupMember,
  removeGroupMember,
  updateMemberRole,
  setNickname,
  createRole,
  updateRole,
  deleteRole,
  reorderRoles
} from '../controllers/groupMemberController.js';
import { searchMessages } from '../controllers/searchController.js';

const router = express.Router();

router.route('/')
  .get(getGroups)
  .post(createGroup);

router.get('/discover', discoverGroups);
router.post('/join', joinGroup);

router.post('/:groupId/join', joinPublicGroup);
router.get('/:groupId/search', searchMessages);
router.get('/:groupId/logs', getGroupLogs);
router.get('/:groupId/inspect', inspectGroup);
router.post('/:groupId/leave', leaveGroup);
router.put('/:groupId/settings', updateGroupSettings);
router.post('/:groupId/icon', requireGroupManager, handleAvatarUpload, uploadGroupIcon);
router.delete('/:groupId/icon', removeGroupIcon);
router.post('/:groupId/invite-code', regenerateInviteCode);
router.post('/:groupId/transfer', transferOwnership);

router.post('/:groupId/projects', addProjectToGroup);
router.delete('/:groupId/projects/:projectId', deleteProjectFromGroup);
router.put('/:groupId/projects/:projectId/archive', archiveProject);

router.post('/:groupId/bans', banMember);
router.delete('/:groupId/bans/:memberId', unbanMember);
router.put('/:groupId/members/:memberId/timeout', timeoutMember);
router.post('/:groupId/invites', createInvite);
router.delete('/:groupId/invites/:code', deleteInvite);

router.post('/:groupId/categories', createCategory);
router.put('/:groupId/categories/:categoryId', updateCategory);
router.delete('/:groupId/categories/:categoryId', deleteCategory);

router.post('/:groupId/events', createEvent);
router.put('/:groupId/events/:eventId', updateEvent);
router.delete('/:groupId/events/:eventId', deleteEvent);
router.put('/:groupId/projects/:projectId/board', updateProjectBoard);
router.post('/:groupId/projects/:projectId/tasks/:taskId/comments', addTaskComment);

router.post('/:groupId/members', addGroupMember);
router.delete('/:groupId/members/:memberId', removeGroupMember);
router.put('/:groupId/members/:memberId/role', updateMemberRole);
router.put('/:groupId/members/:memberId/nickname', setNickname);

router.post('/:groupId/roles', createRole);
router.put('/:groupId/roles-order', reorderRoles);
router.put('/:groupId/roles/:roleId', updateRole);
router.delete('/:groupId/roles/:roleId', deleteRole);

router.delete('/:id', deleteGroup);

export default router;
