import fs from 'fs';
import path from 'path';
import { FILE_DIR } from '../middlewares/uploadMiddleware.js';

const FILE_URL = /^\/uploads\/files\/\d+-[a-f0-9]{32}\.[a-z0-9]{1,5}$/;

export function cleanAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];

  const result = [];
  attachments.forEach(file => {
    if (!file || typeof file.url !== 'string') return;
    if (!FILE_URL.test(file.url)) return;
    if (!fs.existsSync(path.join(FILE_DIR, path.basename(file.url)))) return;
    if (result.some(item => item.url === file.url)) return;

    result.push({
      url: file.url,
      name: String(file.name || 'file').slice(0, 200),
      type: String(file.type || '').slice(0, 100),
      size: Number(file.size) || 0
    });
  });

  return result.slice(0, 5);
}
