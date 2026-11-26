import { PageHeader, Tabs } from '../ui/Card';
import { SystemRoleBadge } from '../ui/Badge';
import AdminStatsTab from './AdminStatsTab';
import AdminUsersTab from './AdminUsersTab';
import AdminGroupsTab from './AdminGroupsTab';
import AdminLogsTab from './AdminLogsTab';
import AdminTeamTab from './AdminTeamTab';
import AdminVipTab from './AdminVipTab';

export default function AdminView({ currentUser, tab, onChangeTab, showSaved, onInspectGroup }) {
  const tabs = [
    { id: 'stats', icon: 'chart', label: 'ภาพรวมระบบ' },
    { id: 'users', icon: 'users', label: 'บัญชีผู้ใช้' },
    { id: 'groups', icon: 'grid', label: 'กลุ่ม' },
    { id: 'vip', icon: 'sparkles', label: 'VIP' },
    { id: 'team', icon: 'shield', label: 'ทีมงาน' },
    { id: 'logs', icon: 'clock', label: 'Log ผู้ดูแลระบบ' }
  ];
  const activeTab = tabs.some(t => t.id === tab) ? tab : 'stats';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <PageHeader
          title="Admin Dashboard"
          description="ดูแลผู้ใช้ กลุ่ม ทีมงาน และรายงานทั้งระบบ"
          action={
            <div className="flex items-center gap-2 text-sm text-slate-500">
              เข้าใช้งานในฐานะ <SystemRoleBadge systemRole={currentUser.systemRole} />
            </div>
          }
        />
        <Tabs tabs={tabs} value={activeTab} onChange={onChangeTab} />

        {activeTab === 'stats' && <AdminStatsTab currentUser={currentUser} onGoTo={onChangeTab} />}
        {activeTab === 'users' && <AdminUsersTab currentUser={currentUser} showSaved={showSaved} />}
        {activeTab === 'groups' && <AdminGroupsTab currentUser={currentUser} showSaved={showSaved} onInspectGroup={onInspectGroup} />}
        {activeTab === 'team' && <AdminTeamTab currentUser={currentUser} showSaved={showSaved} />}
        {activeTab === 'logs' && <AdminLogsTab currentUser={currentUser} />}
        {activeTab === 'vip' && <AdminVipTab currentUser={currentUser} showSaved={showSaved} />}
      </div>
    </div>
  );
}
