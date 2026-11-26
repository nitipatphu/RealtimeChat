import express from 'express';
import {
  listConversations,
  createGroupChat,
  updateGroupChat,
  addGroupChatMembers,
  leaveGroupChat,
  getGroupChatMessages,
  addGroupChatMessage,
  updateGroupChatMessage,
  deleteGroupChatMessage,
  reactGroupChatMessage
} from '../controllers/conversationController.js';

const router = express.Router();

router.get('/', listConversations);
router.post('/', createGroupChat);
router.put('/:id', updateGroupChat);
router.post('/:id/members', addGroupChatMembers);
router.post('/:id/leave', leaveGroupChat);
router.get('/:id/messages', getGroupChatMessages);
router.post('/:id/messages', addGroupChatMessage);
router.put('/:id/messages/:msgId', updateGroupChatMessage);
router.delete('/:id/messages/:msgId', deleteGroupChatMessage);
router.post('/:id/messages/:msgId/reactions', reactGroupChatMessage);

export default router;
