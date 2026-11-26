import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import app from './app.js';
import { startReminders } from './utils/reminders.js';
import { startScheduler } from './utils/scheduler.js';
import { checkConnection } from './config/database.js';
import { findSessionUser } from './middlewares/authMiddleware.js';
import { getOne } from './config/database.js';
import { createUsageTables, recordUsage } from './utils/usage.js';
import { updateTierTable } from './utils/vip.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(o => o);

const server = http.createServer(app);
server.requestTimeout = 30 * 60 * 1000;
const io = new Server(server, { cors: { origin: allowedOrigins.length > 0 ? allowedOrigins : true } });
app.set('io', io);

const onlineUsers = {};
app.set('onlineUsers', onlineUsers);

function sendOnlineUsers() {
  io.emit('online-users', Object.keys(onlineUsers));
}

function setOffline(socket) {
  const userId = socket.data.userId;
  if (!userId) return;

  socket.leave('user:' + userId);
  if (socket.data.groupId) {
    socket.leave('group:' + socket.data.groupId);
    socket.data.groupId = null;
  }
  socket.data.userId = null;

  onlineUsers[userId] = onlineUsers[userId] - 1;
  if (onlineUsers[userId] <= 0) {
    delete onlineUsers[userId];
  }
}

async function canJoinGroup(userId, groupId) {
  const member = await getOne('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  if (member) return true;
  const admin = await getOne("SELECT 1 FROM users WHERE id = $1 AND system_role = 'administrator' AND account_status = 'active'", [userId]);
  if (admin) return true;
  return false;
}

io.on('connection', (socket) => {
  socket.on('identify', async (token) => {
    try {
      const user = await findSessionUser(token);
      if (!user || user.account_status !== 'active') {
        socket.emit('auth:invalid');
        return;
      }

      if (socket.data.userId === user.id) {
        socket.emit('online-users', Object.keys(onlineUsers));
        return;
      }

      setOffline(socket);
      socket.data.userId = user.id;
      socket.join('user:' + user.id);
      onlineUsers[user.id] = (onlineUsers[user.id] || 0) + 1;
      sendOnlineUsers();
      recordUsage(user.id, Object.keys(onlineUsers).length).catch(error => console.log('usage error:', error.message));
    } catch (error) {
      console.log('socket identify error:', error.message);
    }
  });

  socket.on('typing', (data) => {
    if (!socket.data.userId || !data || !Array.isArray(data.toUserIds)) return;

    data.toUserIds.slice(0, 100).forEach(id => {
      if (id === socket.data.userId) return;
      socket.to('user:' + id).emit('typing', {
        room: String(data.room || '').slice(0, 200),
        userId: socket.data.userId,
        name: String(data.name || '').slice(0, 50)
      });
    });
  });

  socket.on('logout', () => {
    setOffline(socket);
    sendOnlineUsers();
  });

  socket.on('disconnect', () => {
    setOffline(socket);
    sendOnlineUsers();
  });

  socket.on('join-group', async (groupId) => {
    try {
      if (socket.data.groupId) {
        socket.leave('group:' + socket.data.groupId);
        socket.data.groupId = null;
      }
      if (!groupId || !socket.data.userId) return;
      if (await canJoinGroup(socket.data.userId, groupId)) {
        socket.data.groupId = groupId;
        socket.join('group:' + groupId);
      }
    } catch (error) {
      console.log('socket join error:', error.message);
    }
  });
});

checkConnection()
  .then(async (name) => {
    console.log('เชื่อมต่อ PostgreSQL สำเร็จ: ' + name);
    await createUsageTables();
    await updateTierTable();
    startReminders(app);
    startScheduler(app);
    server.listen(PORT, () => {
      console.log('http://localhost:' + PORT);
    });
  })
  .catch((error) => {
    console.error('เชื่อมต่อ PostgreSQL ไม่สำเร็จ:', error.message);
    process.exit(1);
  });
