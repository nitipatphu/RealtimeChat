import express from 'express';
import { requireStaff, requireAdmin } from '../middlewares/adminMiddleware.js';
import {
  getStats,
  getUsers,
  searchUsers,
  createUser,
  updateUser,
  setUserStatus,
  resetPassword,
  deleteUser,
  getGroups,
  getGroupDetail,
  createGroup,
  updateGroup,
  deleteGroup,
  getLogs,
  getMyWork,
  getTeam,
  setSystemRole
} from '../controllers/adminController.js';
import { getVipOverview, grantVip, revokeVip, createVipCode, deleteVipCode, updateTierSettings } from '../controllers/vipController.js';

const router = express.Router();

router.get('/stats', requireAdmin, getStats);
router.get('/my-work', requireStaff, getMyWork);
router.get('/team', requireAdmin, getTeam);

router.get('/users', requireStaff, getUsers);
router.get('/users/search', requireStaff, searchUsers);
router.post('/users', requireAdmin, createUser);
router.put('/users/:id', requireAdmin, updateUser);
router.put('/users/:id/status', requireStaff, setUserStatus);
router.put('/users/:id/password', requireAdmin, resetPassword);
router.delete('/users/:id', requireAdmin, deleteUser);
router.put('/users/:id/system-role', requireAdmin, setSystemRole);

router.get('/groups', requireStaff, getGroups);
router.get('/groups/:id', requireStaff, getGroupDetail);
router.post('/groups', requireAdmin, createGroup);
router.put('/groups/:id', requireAdmin, updateGroup);
router.delete('/groups/:id', requireAdmin, deleteGroup);


router.get('/logs', requireStaff, getLogs);

router.get('/vip', requireStaff, getVipOverview);
router.put('/vip-settings', requireAdmin, updateTierSettings);
router.put('/users/:id/vip', requireStaff, grantVip);
router.delete('/users/:id/vip', requireStaff, revokeVip);
router.post('/vip-codes', requireStaff, createVipCode);
router.delete('/vip-codes/:code', requireStaff, deleteVipCode);

export default router;
