import { useState } from 'react';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { getMemberIds, getMemberRole, getDisplayName } from '../../utils/permissions';
import { getPresence } from '../../utils/presence';
import { VipBadge } from '../ui/Badge';
import { vipNameClass } from '../../utils/vip';

function MemberRow({ member, group, status, unreadCount, onOpen }) {
  const role = getMemberRole(group, member.id);
  const isOwner = member.id === group.ownerId;
  const showColor = !role.isDefault && role.id !== 'none';
  const isOffline = status === 'offline';

  return (
    <button
      type="button"
      onClick={() => onOpen(member.id)}
      className={`w-full flex items-center gap-2.5 h-10 px-2.5 rounded-lg text-left hover:bg-slate-100 transition-colors ${isOffline ? 'opacity-50' : ''}`}
    >
      <Avatar src={member.avatar} name={member.name} size="sm" status={status} />
      <span className="flex-1 min-w-0 flex items-center gap-1">
        <span
          className={`min-w-0 truncate text-sm font-medium ${vipNameClass(member) || 'text-slate-700'}`}
          style={showColor && !isOffline && !vipNameClass(member) ? { color: role.color } : null}
        >
          {getDisplayName(group, member)}
        </span>
        <VipBadge user={member} size="icon" />
      </span>
      {isOwner && (
        <span title="เจ้าของกลุ่ม" className="text-amber-500 shrink-0">
          <Icon name="star" className="w-3.5 h-3.5" />
        </span>
      )}
      {unreadCount > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export default function MemberList({ group, users, onlineUserIds, unread, mutedRooms, onOpenProfile }) {
  const [closed, setClosed] = useState({});

  const memberIds = getMemberIds(group);
  const members = (users || []).filter(u => memberIds.includes(u.id));
  members.sort((a, b) => getDisplayName(group, a).localeCompare(getDisplayName(group, b)));

  const statusOf = (member) => getPresence(member, onlineUserIds);
  const onlineMembers = members.filter(m => statusOf(m) !== 'offline');
  const offlineMembers = members.filter(m => statusOf(m) === 'offline');

  const sections = [];
  const placedIds = [];

  (group.roles || []).forEach(role => {
    if (!role.hoist) return;
    const list = onlineMembers.filter(m => {
      if (placedIds.includes(m.id)) return false;
      const memberRoleIds = getMemberRole(group, m.id).roleIds;
      const firstHoisted = (group.roles || []).find(r => r.hoist && memberRoleIds.includes(r.id));
      return firstHoisted && firstHoisted.id === role.id;
    });
    if (list.length === 0) return;
    list.forEach(m => placedIds.push(m.id));
    sections.push({ id: role.id, title: role.name, color: role.color, members: list });
  });

  const restOnline = onlineMembers.filter(m => !placedIds.includes(m.id));
  if (restOnline.length > 0) {
    sections.push({ id: 'online', title: 'ออนไลน์', color: null, members: restOnline });
  }
  if (offlineMembers.length > 0) {
    sections.push({ id: 'offline', title: 'ออฟไลน์', color: null, members: offlineMembers });
  }

  const unreadFor = (memberId) => {
    const key = 'dm:' + memberId;
    if ((mutedRooms || []).includes(key)) return 0;
    return unread[key] || 0;
  };

  return (
    <div className="space-y-3">
      {sections.map(section => {
        const isClosed = closed[section.id];
        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => setClosed({ ...closed, [section.id]: !isClosed })}
              className="w-full flex items-center gap-1.5 pl-2 pr-1 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
            >
              <Icon name={isClosed ? 'chevronRight' : 'chevronDown'} className="w-3 h-3" />
              {section.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />}
              <span className="truncate">{section.title}</span>
              <span className="font-normal">— {section.members.length}</span>
            </button>
            {!isClosed && (
              <div className="space-y-0.5">
                {section.members.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    group={group}
                    status={statusOf(member)}
                    unreadCount={unreadFor(member.id)}
                    onOpen={onOpenProfile}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
