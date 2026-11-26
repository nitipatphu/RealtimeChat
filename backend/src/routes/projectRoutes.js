import express from 'express';
import { checkProjectAccess } from '../middlewares/checkProjectAccess.js';
import {
  getProjectChannels,
  getProjectMessages,
  addProjectMessage,
  updateProjectMessage,
  deleteProjectMessage,
  reactToProjectMessage,
  createProjectChannel,
  deleteProjectChannel,
  getProjectPins,
  pinProjectMessage,
  voteProjectMessage
} from '../controllers/projectChatController.js';
import {
  addMemberToProject,
  removeMemberFromProject
} from '../controllers/projectMemberController.js';

const router = express.Router({ mergeParams: true });

router.get('/channels', checkProjectAccess, getProjectChannels);
router.post('/channels', checkProjectAccess, createProjectChannel);
router.delete('/channels/:channelId', checkProjectAccess, deleteProjectChannel);
router.get('/channels/:channelId/messages', checkProjectAccess, getProjectMessages);
router.get('/channels/:channelId/pins', checkProjectAccess, getProjectPins);
router.post('/channels/:channelId/messages/:msgId/pin', checkProjectAccess, pinProjectMessage);
router.post('/channels/:channelId/messages/:msgId/vote', checkProjectAccess, voteProjectMessage);
router.post('/channels/:channelId/messages', checkProjectAccess, addProjectMessage);
router.put('/channels/:channelId/messages/:msgId', checkProjectAccess, updateProjectMessage);
router.delete('/channels/:channelId/messages/:msgId', checkProjectAccess, deleteProjectMessage);
router.post('/channels/:channelId/messages/:msgId/reactions', checkProjectAccess, reactToProjectMessage);

router.post('/members', addMemberToProject);
router.delete('/members/:memberId', removeMemberFromProject);

export default router;
