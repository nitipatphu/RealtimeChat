import { getOne, getMany } from '../config/database.js';
import { toIso } from './userModel.js';

function groupBy(rows, key) {
  const result = {};
  rows.forEach(row => {
    const value = row[key];
    if (!result[value]) result[value] = [];
    result[value].push(row);
  });
  return result;
}

function shortId(fullId, parentId) {
  const prefix = parentId + ':';
  return fullId.startsWith(prefix) ? fullId.slice(prefix.length) : fullId;
}

function timeText(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

export async function loadGroups(ids, client) {
  if (!ids || ids.length === 0) return [];

  const groups = await getMany('SELECT * FROM groups WHERE id = ANY($1) ORDER BY created_at', [ids], client);
  const members = await getMany('SELECT * FROM group_members WHERE group_id = ANY($1) ORDER BY joined_at', [ids], client);
  const roles = await getMany('SELECT * FROM group_roles WHERE group_id = ANY($1) ORDER BY position', [ids], client);
  const memberRoles = await getMany('SELECT * FROM member_roles WHERE group_id = ANY($1)', [ids], client);
  const bans = await getMany('SELECT * FROM group_bans WHERE group_id = ANY($1) ORDER BY created_at', [ids], client);
  const invites = await getMany('SELECT * FROM group_invites WHERE group_id = ANY($1) ORDER BY created_at DESC', [ids], client);
  const categories = await getMany('SELECT * FROM channel_categories WHERE group_id = ANY($1) ORDER BY position', [ids], client);
  const events = await getMany('SELECT * FROM group_events WHERE group_id = ANY($1) ORDER BY event_date, event_time', [ids], client);
  const projects = await getMany('SELECT * FROM projects WHERE group_id = ANY($1) ORDER BY created_at', [ids], client);

  const projectIds = projects.map(p => p.id);
  const projectMembers = await getMany('SELECT * FROM project_members WHERE project_id = ANY($1)', [projectIds], client);
  const projectChannels = await getMany('SELECT * FROM project_channels WHERE project_id = ANY($1) ORDER BY created_at', [projectIds], client);
  const columns = await getMany('SELECT * FROM board_columns WHERE project_id = ANY($1) ORDER BY position', [projectIds], client);
  const tasks = await getMany('SELECT * FROM tasks WHERE project_id = ANY($1) ORDER BY position', [projectIds], client);

  const taskIds = tasks.map(t => t.id);
  const assignees = await getMany('SELECT * FROM task_assignees WHERE task_id = ANY($1)', [taskIds], client);
  const checklist = await getMany('SELECT * FROM task_checklist_items WHERE task_id = ANY($1) ORDER BY position', [taskIds], client);
  const comments = await getMany('SELECT * FROM task_comments WHERE task_id = ANY($1) ORDER BY created_at', [taskIds], client);

  const membersByGroup = groupBy(members, 'group_id');
  const rolesByGroup = groupBy(roles, 'group_id');
  const memberRolesByGroup = groupBy(memberRoles, 'group_id');
  const bansByGroup = groupBy(bans, 'group_id');
  const invitesByGroup = groupBy(invites, 'group_id');
  const categoriesByGroup = groupBy(categories, 'group_id');
  const eventsByGroup = groupBy(events, 'group_id');
  const projectsByGroup = groupBy(projects, 'group_id');
  const projectMembersByProject = groupBy(projectMembers, 'project_id');
  const channelsByProject = groupBy(projectChannels, 'project_id');
  const columnsByProject = groupBy(columns, 'project_id');
  const tasksByProject = groupBy(tasks, 'project_id');
  const assigneesByTask = groupBy(assignees, 'task_id');
  const checklistByTask = groupBy(checklist, 'task_id');
  const commentsByTask = groupBy(comments, 'task_id');

  const now = Date.now();

  return groups.map(group => {
    const groupMembers = membersByGroup[group.id] || [];
    const nicknames = {};
    const timeouts = {};
    groupMembers.forEach(m => {
      if (m.nickname) nicknames[m.user_id] = m.nickname;
      if (m.timeout_until && new Date(m.timeout_until).getTime() > now) timeouts[m.user_id] = toIso(m.timeout_until);
    });

    const roleMap = {};
    (memberRolesByGroup[group.id] || []).forEach(row => {
      if (!roleMap[row.user_id]) roleMap[row.user_id] = [];
      roleMap[row.user_id].push(row.role_id);
    });

    const groupProjects = (projectsByGroup[group.id] || []).map(project => ({
      id: project.id,
      name: project.name,
      archived: project.archived_at ? true : false,
      archivedAt: toIso(project.archived_at),
      members: (projectMembersByProject[project.id] || []).map(m => m.user_id),
      channels: (channelsByProject[project.id] || []).map(c => ({ id: c.id, name: c.name })),
      columns: (columnsByProject[project.id] || []).map(c => ({ id: c.id, title: c.title })),
      tasks: (tasksByProject[project.id] || []).map(task => ({
        id: task.id,
        title: task.title,
        status: task.column_id,
        description: task.description,
        priority: task.priority,
        dueDate: task.due_date,
        remindedFor: task.reminded_for,
        assigneeIds: (assigneesByTask[task.id] || []).map(a => a.user_id),
        checklist: (checklistByTask[task.id] || []).map(item => ({ id: shortId(item.id, task.id), text: item.text, done: item.done })),
        comments: (commentsByTask[task.id] || []).map(c => ({ id: shortId(c.id, task.id), authorId: c.author_id, text: c.text, createdAt: toIso(c.created_at) }))
      }))
    }));

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      color: group.color,
      icon: group.icon,
      ownerId: group.owner_id,
      inviteCode: group.invite_code,
      createdAt: toIso(group.created_at),
      members: groupMembers.map(m => m.user_id),
      roles: (rolesByGroup[group.id] || []).map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        permissions: r.permissions || [],
        hoist: r.hoist,
        isDefault: r.is_default
      })),
      memberRoles: roleMap,
      nicknames: nicknames,
      timeouts: timeouts,
      bans: (bansByGroup[group.id] || []).map(b => ({ userId: b.user_id, reason: b.reason, byId: b.banned_by, createdAt: toIso(b.created_at) })),
      invites: (invitesByGroup[group.id] || []).map(i => ({
        code: i.code,
        createdBy: i.created_by,
        createdAt: toIso(i.created_at),
        expiresAt: toIso(i.expires_at),
        maxUses: i.max_uses,
        uses: i.uses
      })),
      categories: (categoriesByGroup[group.id] || []).map(c => ({ id: c.id, name: c.name })),
      events: (eventsByGroup[group.id] || []).map(e => ({
        id: e.id,
        title: e.title,
        date: e.event_date,
        time: timeText(e.event_time),
        description: e.description,
        createdBy: e.created_by,
        createdAt: toIso(e.created_at),
        remindedFor: e.reminded_for
      })),
      projects: groupProjects
    };
  });
}

export async function loadGroup(id, client) {
  const list = await loadGroups([id], client);
  return list[0] || null;
}

export async function loadGroupOr404(id, res, client) {
  const group = await loadGroup(id, client);
  if (!group) {
    res.status(404);
    throw new Error('ไม่พบ Group นี้');
  }
  return group;
}

export async function getGroupIdsForUser(userId) {
  const rows = await getMany('SELECT group_id FROM group_members WHERE user_id = $1', [userId]);
  return rows.map(r => r.group_id);
}

export async function getGroupLogs(groupId) {
  const rows = await getMany('SELECT * FROM group_logs WHERE group_id = $1 ORDER BY created_at DESC LIMIT 300', [groupId]);
  return rows.map(r => ({ id: r.id, action: r.action, actorId: r.actor_id, text: r.text, createdAt: toIso(r.created_at) }));
}

export function toChannel(row, allowedRoleIds) {
  return {
    id: row.id,
    name: row.name,
    groupId: row.group_id,
    parentId: row.parent_id,
    categoryId: row.category_id,
    allowedRoleIds: allowedRoleIds || []
  };
}

export async function listChannels(groupId) {
  const rows = await getMany('SELECT * FROM channels WHERE group_id = $1 ORDER BY position, created_at', [groupId]);
  const allowed = await getMany('SELECT * FROM channel_allowed_roles WHERE channel_id = ANY($1)', [rows.map(r => r.id)]);
  const byChannel = groupBy(allowed, 'channel_id');
  return rows.map(row => toChannel(row, (byChannel[row.id] || []).map(a => a.role_id)));
}

export async function getChannel(channelId, client) {
  const row = await getOne('SELECT * FROM channels WHERE id = $1', [channelId], client);
  if (!row) return null;
  const allowed = await getMany('SELECT role_id FROM channel_allowed_roles WHERE channel_id = $1', [channelId], client);
  return toChannel(row, allowed.map(a => a.role_id));
}
