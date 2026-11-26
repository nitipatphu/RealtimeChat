import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { GroupAvatar } from '../ui/Avatar';
import Badge, { RoleBadge } from '../ui/Badge';
import GroupGeneralTab from './GroupGeneralTab';
import GroupRolesTab from './GroupRolesTab';
import GroupMembersTab from './GroupMembersTab';
import GroupLogsTab from './GroupLogsTab';
import GroupInvitesTab from './GroupInvitesTab';
import GroupDangerTab from './GroupDangerTab';
import { hasPermission, getMemberRole } from '../../utils/permissions';

function tabColor(itemId, activeTab) {
  if (activeTab === itemId) return 'bg-indigo-50 text-indigo-700';
  if (itemId === 'danger') return 'text-red-600 hover:bg-red-50';
  return 'text-slate-600 hover:bg-slate-100';
}

export default function GroupSettingsView({ group, currentUser, users, onlineUserIds, tab, onChangeTab, onBack, onLeft, showSaved, readOnly }) {
  const tabs = [
    { id: 'general', icon: 'settings', label: 'ภาพรวม' },
    { id: 'members', icon: 'users', label: 'สมาชิกและชื่อเล่น' },
    { id: 'roles', icon: 'tag', label: 'Role และสิทธิ์' },
    { id: 'invites', icon: 'mail', label: 'ลิงก์เชิญ' }
  ];
  if (readOnly || hasPermission(group, currentUser.id, 'view_logs')) {
    tabs.push({ id: 'logs', icon: 'clock', label: 'Log ของกลุ่ม' });
  }
  if (!readOnly) {
    tabs.push({ id: 'danger', icon: 'ban', label: 'โซนอันตราย' });
  }

  const activeTab = tabs.some(t => t.id === tab) ? tab : 'general';
  const myRole = getMemberRole(group, currentUser.id);
  const props = { group: group, currentUser: currentUser, users: users, onlineUserIds: onlineUserIds, showSaved: showSaved, readOnly: readOnly };

  return (
    <div className="flex h-full min-w-0">
      <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-slate-200 flex-col">
        <div className="p-4 border-b border-slate-200">
          <Button variant="ghost" size="sm" icon="arrowLeft" onClick={onBack} className="-ml-2 mb-3">กลับไปที่แชท</Button>
          <div className="flex items-center gap-3">
            <GroupAvatar group={group} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{group.name}</p>
              <div className="mt-0.5">{readOnly ? <Badge tone="amber">โหมดตรวจสอบ</Badge> : <RoleBadge role={myRole} />}</div>
            </div>
          </div>
        </div>
        <nav className="p-2 space-y-0.5">
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm font-medium transition-colors ' + tabColor(item.id, activeTab)}
            >
              <Icon name={item.icon} className="w-[18px] h-[18px]" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
          <div className="md:hidden flex gap-2 overflow-x-auto pb-4 -mx-1 px-1">
            <button type="button" onClick={onBack} className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium bg-white border border-slate-200 text-slate-600">
              <Icon name="arrowLeft" className="w-4 h-4" />
              แชท
            </button>
            {tabs.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                <Icon name={item.icon} className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-6">{tabs.find(t => t.id === activeTab).label}</h1>
          {activeTab === 'general' && <GroupGeneralTab key={group.id + group.name + group.visibility + group.color + group.description} {...props} />}
          {activeTab === 'members' && <GroupMembersTab {...props} />}
          {activeTab === 'roles' && <GroupRolesTab {...props} />}
          {activeTab === 'logs' && <GroupLogsTab {...props} />}
          {activeTab === 'invites' && <GroupInvitesTab {...props} />}
          {activeTab === 'danger' && <GroupDangerTab {...props} onLeft={onLeft} />}
        </div>
      </main>
    </div>
  );
}
