import fs from 'fs';
import { getPerks, getBiggestFileMB } from '../utils/vip.js';
import { findUserById } from '../models/userModel.js';

export const uploadFile = async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('ไม่พบไฟล์');
  }

  const user = await findUserById(req.userId);
  const limitMB = (await getPerks(user)).fileMB;
  if (req.file.size > limitMB * 1024 * 1024) {
    fs.unlink(req.file.path, () => {});
    const biggest = await getBiggestFileMB();
    res.status(400);
    throw new Error('ไฟล์ใหญ่เกิน ' + limitMB + ' MB' + (biggest > limitMB ? ' (อัปเกรด VIP เพื่อส่งไฟล์ใหญ่ขึ้น)' : ''));
  }

  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200);

  res.status(201).json({
    url: '/uploads/files/' + req.file.filename,
    name: originalName,
    type: req.file.mimetype,
    size: req.file.size
  });
};
