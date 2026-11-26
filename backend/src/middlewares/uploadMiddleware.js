import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getPerks } from '../utils/vip.js';
import { findUserById } from '../models/userModel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '../../uploads');
export const FILE_DIR = path.join(UPLOAD_DIR, 'files');
fs.mkdirSync(FILE_DIR, { recursive: true });

const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const ALLOWED_FILE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv'];
const IMAGE_FILE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function randomName(ext) {
  return Date.now() + '-' + crypto.randomBytes(16).toString('hex') + ext;
}

function readStart(filePath) {
  const buffer = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 12, 0);
  fs.closeSync(fd);
  return buffer;
}

export function isRealImage(filePath) {
  const bytes = readStart(filePath);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG';
  const isGif = bytes.toString('ascii', 0, 4) === 'GIF8';
  const isWebp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return isJpeg || isPng || isGif || isWebp;
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, randomName(IMAGE_EXT[file.mimetype]))
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_EXT[file.mimetype]) cb(null, true);
    else cb(new Error('รองรับเฉพาะไฟล์ JPG, PNG, WEBP'));
  }
}).single('avatar');

export const handleAvatarUpload = (req, res, next) => {
  avatarUpload(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ใหญ่เกิน 2 MB' : err.message));
    }
    if (req.file && !isRealImage(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      res.status(400);
      return next(new Error('ไฟล์นี้ไม่ใช่รูปภาพจริง'));
    }
    next();
  });
};

export const handleFileUpload = async (req, res, next) => {
  const user = await findUserById(req.userId);
  const limitMB = (await getPerks(user)).fileMB;

  const fileUpload = multer({
    storage: multer.diskStorage({
      destination: (request, file, cb) => cb(null, FILE_DIR),
      filename: (request, file, cb) => cb(null, randomName(path.extname(file.originalname).toLowerCase()))
    }),
    limits: { fileSize: limitMB * 1024 * 1024, files: 1 },
    fileFilter: (request, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ALLOWED_FILE_EXT.includes(ext)) cb(null, true);
      else cb(new Error('ไม่รองรับไฟล์ประเภทนี้'));
    }
  }).single('file');

  fileUpload(req, res, (err) => {
    if (err) {
      res.status(400);
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'ไฟล์ใหญ่เกิน ' + limitMB + ' MB (อัปเกรด VIP เพื่อส่งไฟล์ใหญ่ขึ้น)'
        : err.message;
      return next(new Error(message));
    }
    if (req.file && IMAGE_FILE_EXT.includes(path.extname(req.file.filename)) && !isRealImage(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      res.status(400);
      return next(new Error('ไฟล์นี้ไม่ใช่รูปภาพจริง'));
    }
    next();
  });
};

export function setUploadHeaders(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!IMAGE_FILE_EXT.includes(ext) && ext !== '.pdf') {
    res.setHeader('Content-Disposition', 'attachment');
  }
}

export function deleteUploadedFile(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const relative = url.slice('/uploads/'.length);
  const fullPath = path.resolve(UPLOAD_DIR, relative);
  if (!fullPath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return;
  fs.unlink(fullPath, () => {});
}
