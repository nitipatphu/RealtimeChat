import express from 'express';
import { getScheduled, createScheduled, deleteScheduled } from '../controllers/scheduleController.js';

const router = express.Router();

router.get('/', getScheduled);
router.post('/', createScheduled);
router.delete('/:id', deleteScheduled);

export default router;
