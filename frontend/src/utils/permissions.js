export const PERMISSIONS = [
  { key: 'administrator', label: 'Administrator', desc: 'เปิดทุกสิทธิ์ในกลุ่ม (ยกเว้นลบหรือโอนกลุ่ม ซึ่งทำได้เฉพาะเจ้าของ)' },
  { key: 'manage_group', label: 'จัดการกลุ่ม', desc: 'แก้ชื่อ คำอธิบาย Public/Private และรหัสเชิญ' },
  { key: 'manage_roles', label: 'จัดการ Role', desc: 'สร้าง แก้ไข ลบ Role และกำหนด Role ให้สมาชิก' },
  { key: 'manage_members', label: 'จัดการสมาชิก', desc: 'เพิ่มและนำสมาชิกออกจากกลุ่ม' },
  { key: 'manage_nicknames', label: 'จัดการชื่อเล่น', desc: 'เปลี่ยนชื่อเล่นของสมาชิกคนอื่น' },
  { key: 'change_nickname', label: 'เปลี่ยนชื่อเล่นตัวเอง', desc: 'ตั้งชื่อเล่นของตัวเองในกลุ่มนี้' },
  { key: 'manage_channels', label: 'จัดการ Channel', desc: 'สร้าง เปลี่ยนชื่อ และลบ Channel' },
  { key: 'create_projects', label: 'สร้าง Project', desc: 'สร้าง Project ใหม่ในกลุ่ม' },
  { key: 'manage_projects', label: 'จัดการ Project', desc: 'ลบ Project จัดการสมาชิก และเห็นทุก Project' },
  { key: 'manage_messages', label: 'จัดการข้อความ', desc: 'ลบข้อความของคนอื่น' },
  { key: 'ban_members', label: 'แบนสมาชิก', desc: 'แบนสมาชิกออกจากกลุ่ม คนที่ถูกแบนกลับเข้ากลุ่มไม่ได้' },
  { key: 'timeout_members', label: 'Timeout สมาชิก', desc: 'ห้ามสมาชิกส่งข้อความชั่วคราว' },
  { key: 'create_invites', label: 'สร้างลิงก์เชิญ', desc: 'สร้างลิงก์เชิญแบบกำหนดวันหมดอายุและจำนวนคนได้' },
  { key: 'manage_events', label: 'จัดการนัดหมาย', desc: 'แก้ไขและลบนัดหมายของคนอื่นในปฏิทินกลุ่ม' },
  { key: 'mention_everyone', label: 'ใช้ @everyone', desc: 'แท็กทุกคนในห้องพร้อมกัน' },
  { key: 'view_logs', label: 'ดู Log ของกลุ่ม', desc: 'ดูประวัติการเปลี่ยนแปลงในกลุ่ม' }
];

export const ROLE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];

export function getMemberIds(group) {
  if (!group) return [];
  return group.members || [];
}

export function isGroupMember(group, userId) {
  return getMemberIds(group).includes(userId);
}

export function getAssignedRoleIds(group, userId) {
  const value = (group.memberRoles || {})[userId];
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export function getMemberRoles(group, userId) {
  const assigned = getAssignedRoleIds(group, userId);
  return (group.roles || []).filter(r => r.isDefault || assigned.includes(r.id));
}

export function getMemberRole(group, userId) {
  if (!group) return { id: 'none', name: 'Member', color: '#64748b', permissions: [], roleIds: [] };

  if (userId === group.ownerId) {
    return { id: 'owner', name: 'Owner', color: '#f59e0b', permissions: PERMISSIONS.map(p => p.key), isOwner: true, roleIds: [] };
  }

  const roles = getMemberRoles(group, userId);
  if (roles.length === 0) {
    return { id: 'none', name: 'Member', color: '#64748b', permissions: [], roleIds: [] };
  }

  const top = roles.find(r => !r.isDefault) || roles[0];
  const permissions = [];
  roles.forEach(role => {
    (role.permissions || []).forEach(key => {
      if (!permissions.includes(key)) permissions.push(key);
    });
  });

  return {
    id: top.id,
    name: top.name,
    color: top.color,
    hoist: top.hoist,
    isDefault: top.isDefault,
    permissions: permissions,
    roleIds: roles.map(r => r.id)
  };
}

export function hasPermission(group, userId, permission) {
  if (!group || !userId) return false;
  if (!isGroupMember(group, userId)) return false;
  if (group.ownerId === userId) return true;
  const rolePermissions = getMemberRole(group, userId).permissions;
  if (rolePermissions.includes('administrator')) return true;
  return rolePermissions.includes(permission);
}

export function canSeeProject(group, project, userId) {
  if (!group || !project) return false;
  if (group.ownerId === userId) return true;
  if ((project.members || []).includes(userId)) return true;
  return hasPermission(group, userId, 'manage_projects');
}

export function getNickname(group, userId) {
  if (!group || !group.nicknames) return '';
  return group.nicknames[userId] || '';
}

export function getDisplayName(group, user) {
  if (!user) return 'ผู้ใช้';
  return getNickname(group, user.id) || user.name;
}

export function isStaffUser(user) {
  if (!user) return false;
  return user.systemRole === 'staff' || user.systemRole === 'administrator';
}

export function isAdminUser(user) {
  if (!user) return false;
  return user.systemRole === 'administrator';
}

export function canSeeChannel(group, channel, userId) {
  if (!group || !channel) return false;
  if (!isGroupMember(group, userId)) return false;
  const roleIds = channel.allowedRoleIds || [];
  if (roleIds.length === 0) return true;
  if (group.ownerId === userId) return true;
  if (hasPermission(group, userId, 'manage_channels')) return true;
  const myRoleIds = getMemberRole(group, userId).roleIds;
  return roleIds.some(id => myRoleIds.includes(id));
}

export function getTimeoutUntil(group, userId) {
  if (!group || !group.timeouts) return null;
  const until = group.timeouts[userId];
  if (!until) return null;
  if (new Date(until).getTime() <= Date.now()) return null;
  return until;
}
