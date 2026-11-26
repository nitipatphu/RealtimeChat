import { viewGroupFor } from './groupView.js';

export function sendGroupUpdate(req, group) {
  const io = req.app.get('io');
  if (!io || !group) return;

  io.in('group:' + group.id).fetchSockets()
    .then(sockets => {
      sockets.forEach(socket => {
        socket.emit('group:updated', viewGroupFor(group, socket.data.userId));
      });
    })
    .catch(error => console.log('group update error:', error.message));
}

export function sendGroupDeleted(req, groupId) {
  const io = req.app.get('io');
  if (!io) return;
  io.to('group:' + groupId).emit('group:deleted', { groupId: groupId });
}

export function sendToGroup(req, groupId, eventName, data) {
  const io = req.app.get('io');
  if (!io) return;
  io.to('group:' + groupId).emit(eventName, data);
}

export function sendToUser(req, userId, eventName, data) {
  const io = req.app.get('io');
  if (!io) return;
  io.to('user:' + userId).emit(eventName, data);
}

export function sendToUsers(req, userIds, eventName, data) {
  const io = req.app.get('io');
  if (!io) return;
  if (userIds.length === 0) return;

  const rooms = userIds.map(id => 'user:' + id);
  io.to(rooms).emit(eventName, data);
}

export function sendToEveryone(req, eventName, data) {
  const io = req.app.get('io');
  if (!io) return;
  io.emit(eventName, data);
}

export function removeUserFromGroupRoom(req, userId, groupId) {
  const io = req.app.get('io');
  if (!io) return;
  io.in('user:' + userId).socketsLeave('group:' + groupId);
}
