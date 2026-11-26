import express from 'express';
import {
  getUsers,
  registerUser,
  loginUser,
  updateProfile,
  removeAvatar,
  changeAvatar,
  changePassword,
  deleteAccount,
  saveSettings,
  markAsRead,
  getUnread,
  getOverview,
  setPresence,
  getNotifications,
  readNotifications,
  forgotPassword,
  resetPasswordWithCode,
  setMuted,
  getBlocks,
  setBlocked,
  setCustomTheme,
  getMe,
  logoutUser
} from '../controllers/userController.js';
import { handleAvatarUpload } from '../middlewares/uploadMiddleware.js';
import { requireAuth, requireSelf } from '../middlewares/authMiddleware.js';
import { redeemVipCode } from '../controllers/vipController.js';
import { getClips, createClip, updateClip, deleteClip } from '../controllers/clipController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordWithCode);

router.use(requireAuth);

router.get('/', getUsers);
router.get('/me', getMe);
router.post('/logout', logoutUser);
router.post('/redeem-vip', redeemVipCode);

router.put('/:id', requireSelf, updateProfile);
router.put('/:id/password', requireSelf, changePassword);
router.delete('/:id', requireSelf, deleteAccount);
router.put('/:id/settings', requireSelf, saveSettings);
router.put('/:id/presence', requireSelf, setPresence);
router.put('/:id/mute', requireSelf, setMuted);
router.get('/:id/blocks', requireSelf, getBlocks);
router.put('/:id/blocks', requireSelf, setBlocked);
router.put('/:id/custom-theme', requireSelf, setCustomTheme);
router.get('/:id/clips', requireSelf, getClips);
router.post('/:id/clips', requireSelf, createClip);
router.put('/:id/clips/:clipId', requireSelf, updateClip);
router.delete('/:id/clips/:clipId', requireSelf, deleteClip);
router.post('/:id/read', requireSelf, markAsRead);
router.get('/:id/unread', requireSelf, getUnread);
router.get('/:id/overview', requireSelf, getOverview);
router.get('/:id/notifications', requireSelf, getNotifications);
router.post('/:id/notifications/read', requireSelf, readNotifications);
router.post('/:id/avatar', requireSelf, handleAvatarUpload, changeAvatar);
router.delete('/:id/avatar', requireSelf, removeAvatar);

export default router;
