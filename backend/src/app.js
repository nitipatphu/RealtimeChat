import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import channelRoutes from './routes/channelRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import dmRoutes from './routes/dmRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import { getSystemSettings } from './controllers/vipController.js';
import { errorHandler, notFound } from './middlewares/errorMiddleware.js';
import { UPLOAD_DIR, handleFileUpload, setUploadHeaders } from './middlewares/uploadMiddleware.js';
import { uploadFile } from './controllers/uploadController.js';
import { requireAuth } from './middlewares/authMiddleware.js';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(o => o);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { dotfiles: 'deny', index: false, setHeaders: setUploadHeaders }));

app.get('/api/system-settings', getSystemSettings);
app.use('/api/users', userRoutes);
app.use('/api/channels', requireAuth, channelRoutes);
app.use('/api/dms', requireAuth, dmRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/conversations', requireAuth, conversationRoutes);
app.use('/api/scheduled', requireAuth, scheduleRoutes);
app.post('/api/uploads', requireAuth, handleFileUpload, uploadFile);

app.use('/api/groups/:groupId/projects/:projectId', requireAuth, projectRoutes);
app.use('/api/groups', requireAuth, groupRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
