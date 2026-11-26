import { PageHeader, Tabs } from '../ui/Card';
import { SystemRoleBadge } from '../ui/Badge';
import AdminUsersTab from '../admin/AdminUsersTab';
import AdminGroupsTab from '../admin/AdminGroupsTab';
import StaffWorkTab from './StaffWorkTab';
import AdminVipTab from '../admin/AdminVipTab';

export default function StaffView({ currentUser, tab, onChangeTab, showSaved }) {
  const tabs = [
    { id: 'users', icon: 'users', label: 'ผู้ใช้' },
    { id: 'groups', icon: 'grid', label: 'กลุ่ม' },
    { id: 'vip', icon: 'sparkles', label: 'VIP' },
    { id: 'work', icon: 'chart', label: 'งานของฉัน' }
  ];
  const activeTab = tabs.some(t => t.id === tab) ? tab : 'users';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <PageHeader
          title="Staff Dashboard"
          description="ตรวจสอบรายงาน ดูแลผู้ใช้ และรักษาความเรียบร้อยของชุมชน"
          action={
            <div className="flex items-center gap-2 text-sm text-slate-500">
              เข้าใช้งานในฐานะ <SystemRoleBadge systemRole={currentUser.systemRole} />
            </div>
          }
        />
        <Tabs tabs={tabs} value={activeTab} onChange={onChangeTab} />

        {activeTab === 'users' && <AdminUsersTab currentUser={currentUser} showSaved={showSaved} />}
        {activeTab === 'groups' && <AdminGroupsTab currentUser={currentUser} showSaved={showSaved} />}
        {activeTab === 'work' && <StaffWorkTab currentUser={currentUser} onGoTo={onChangeTab} />}
        {activeTab === 'vip' && <AdminVipTab currentUser={currentUser} showSaved={showSaved} />}
      </div>
    </div>
  );
}
