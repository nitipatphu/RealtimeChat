import { hasPermission } from './permissions.js';

export function toClientGroup(group) {
  return group;
}

export function toGroupSummary(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    color: row.color,
    icon: row.icon || null,
    visibility: row.visibility,
    memberCount: Number(row.member_count) || 0,
    projectCount: Number(row.project_count) || 0,
    ownerId: row.owner_id,
    ownerName: row.owner_name || '-',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

export const GROUP_SUMMARY_SQL = `
  SELECT g.*, u.name AS owner_name, u.email AS owner_email, u.avatar AS owner_avatar,
         (SELECT count(*) FROM group_members m WHERE m.group_id = g.id) AS member_count,
         (SELECT count(*) FROM projects p WHERE p.group_id = g.id) AS project_count
  FROM groups g
  LEFT JOIN users u ON u.id = g.owner_id
`;

export function viewGroupFor(group, userId) {
  if (!group) return group;
  const view = { ...group };
  if (!hasPermission(group, userId, 'ban_members')) {
    view.bans = [];
  }
  const canSeeInvites = hasPermission(group, userId, 'create_invites') || hasPermission(group, userId, 'manage_group');
  if (!canSeeInvites) {
    view.invites = [];
  }
  return view;
}
