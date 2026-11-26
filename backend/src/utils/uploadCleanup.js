import fs from 'fs';
import path from 'path';
import { getMany } from '../config/database.js';
import { UPLOAD_DIR, FILE_DIR } from '../middlewares/uploadMiddleware.js';

const ONE_DAY = 24 * 60 * 60 * 1000;

function listFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.join(folder, entry.name));
}

function isOld(filePath) {
  return Date.now() - fs.statSync(filePath).mtimeMs > ONE_DAY;
}

export async function cleanUnusedUploads() {
  const usedFiles = await getMany('SELECT DISTINCT url FROM message_attachments');
  const usedImages = await getMany("SELECT avatar AS url FROM users WHERE avatar LIKE '/uploads/%' UNION SELECT icon FROM groups WHERE icon LIKE '/uploads/%'");

  const usedFileNames = usedFiles.map(row => path.basename(row.url));
  const usedImageNames = usedImages.map(row => path.basename(row.url));
  let removed = 0;

  listFiles(FILE_DIR).forEach(filePath => {
    if (usedFileNames.includes(path.basename(filePath)) || !isOld(filePath)) return;
    fs.unlinkSync(filePath);
    removed = removed + 1;
  });

  listFiles(UPLOAD_DIR).forEach(filePath => {
    if (usedImageNames.includes(path.basename(filePath)) || !isOld(filePath)) return;
    fs.unlinkSync(filePath);
    removed = removed + 1;
  });

  if (removed > 0) {
    console.log('ลบไฟล์ที่ไม่ได้ใช้แล้ว ' + removed + ' ไฟล์');
  }
}
