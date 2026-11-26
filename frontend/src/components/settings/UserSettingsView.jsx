import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import ProfileTab from './ProfileTab';
import AccountTab from './AccountTab';
import { NotificationTab, AppearanceTab } from './PreferencesTabs';
import VipTab from './VipTab';

const TABS = [
  { id: 'profile', icon: 'user', label: 'โปรไฟล์', desc: 'ชื่อ รูป และข้อมูลที่คนอื่นเห็น' },
  { id: 'account', icon: 'key', label: 'บัญชีและความปลอดภัย', desc: 'รหัสผ่านและการจัดการบัญชี' },
  { id: 'notification', icon: 'bell', label: 'การแจ้งเตือน', desc: 'เลือกว่าจะให้เตือนเมื่อไหร่' },
  { id: 'appearance', icon: 'palette', label: 'การแสดงผล', desc: 'ธีมและขนาดตัวอักษร' },
  { id: 'vip', icon: 'sparkles', label: 'VIP', desc: 'สถานะ VIP สิทธิพิเศษ และการกรอกรหัส' }
];

export default function UserSettingsView({ currentUser, tab, onChangeTab, onUserUpdated, onLogout, showSaved }) {
  const activeTab = TABS.find(t => t.id === tab) || TABS[0];

  return (
    <div className="flex h-full min-w-0">
      <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-slate-200 flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <Avatar src={currentUser.avatar} name={currentUser.name} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</p>
            <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
          </div>
        </div>
        <nav className="p-2 space-y-0.5">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">ตั้งค่าของฉัน</p>
          {TABS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm font-medium transition-colors ${
                activeTab.id === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon name={item.icon} className="w-[18px] h-[18px]" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
          <div className="md:hidden flex gap-2 overflow-x-auto pb-4 -mx-1 px-1">
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium ${activeTab.id === item.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                <Icon name={item.icon} className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{activeTab.label}</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">{activeTab.desc}</p>

          {activeTab.id === 'profile' && <ProfileTab key={currentUser.id} currentUser={currentUser} onUserUpdated={onUserUpdated} showSaved={showSaved} />}
          {activeTab.id === 'account' && <AccountTab currentUser={currentUser} onLogout={onLogout} showSaved={showSaved} />}
          {activeTab.id === 'notification' && <NotificationTab showSaved={showSaved} />}
          {activeTab.id === 'appearance' && <AppearanceTab showSaved={showSaved} currentUser={currentUser} onUserUpdated={onUserUpdated} onGoVip={() => onChangeTab('vip')} />}
          {activeTab.id === 'vip' && <VipTab currentUser={currentUser} onUserUpdated={onUserUpdated} />}
        </div>
      </main>
    </div>
  );
}
