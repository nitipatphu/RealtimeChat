import express from 'express';
import {
  getDmMessages,
  addDmMessage,
  updateDmMessage,
  deleteDmMessage
} from '../controllers/dmController.js';

const router = express.Router();

router.route('/:otherUserId/messages')
  .get(getDmMessages)
  .post(addDmMessage);

router.route('/:otherUserId/messages/:msgId')
  .put(updateDmMessage)
  .delete(deleteDmMessage);

export default router;
