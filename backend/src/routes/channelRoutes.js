import express from 'express';
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  addMessage,
  updateMessage,
  deleteMessage,
  reactToMessage,
  getChannelMessages,
  getChannelPins,
  pinMessage,
  voteMessage
} from '../controllers/channelController.js';

const router = express.Router();

router.route('/')
  .get(getChannels)
  .post(createChannel);

router.route('/:id')
  .put(updateChannel)
  .delete(deleteChannel);

router.get('/:id/messages', getChannelMessages);
router.get('/:id/pins', getChannelPins);
router.post('/:id/messages', addMessage);
router.post('/:id/messages/:msgId/pin', pinMessage);
router.post('/:id/messages/:msgId/vote', voteMessage);
router.put('/:id/messages/:msgId', updateMessage);
router.delete('/:id/messages/:msgId', deleteMessage);
router.post('/:id/messages/:msgId/reactions', reactToMessage);

export default router;