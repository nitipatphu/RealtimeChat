import { useState, useEffect, useRef } from 'react';
import Icon from '../ui/Icon';
import Avatar, { GroupAvatar, StatusDot } from '../ui/Avatar';
import { isStaffUser, isAdminUser } from '../../utils/permissions';
import { PRESENCE, PRESENCE_ORDER } from '../../utils/presence';
import { loadSettings, saveSettings } from '../../settings';
import NotificationPanel from './NotificationPanel';

const THEMES = [
  { value: 'light', icon: 'sun', label: 'สว่าง' },
  { value: 'dark', icon: 'moon', label: 'มืด' },
  { value: 'system', icon: 'monitor', label: 'ตามระบบ' }
];

function PresenceMenu({ currentUser, onSetPresence, onOpenSettings, onLogout, onClose }) {
  const ref = useRef(null);
  const myPresence = currentUser.presence || 'online';
  const [theme, setTheme] = useState(loadSettings().theme);

  const changeTheme = (value) => {
    setTheme(value);
    saveSettings({ ...loadSettings(), theme: value });
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute left-full bottom-2 ml-3 z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
      <div className="h-14" style={{ backgroundColor: currentUser.bannerColor || '#6366f1' }} />
      <div className="px-4 pb-3">
        <span className="-mt-8 inline-block rounded-full ring-4 ring-white">
          <Avatar src={currentUser.avatar} name={currentUser.name} size="lg" status={myPresence} />
        </span>
        <p className="text-base font-semibold text-slate-900 mt-1">{currentUser.name}</p>
        <p className="text-xs text-slate-500">{currentUser.email}</p>
      </div>

      <div className="border-t border-slate-100 p-1.5">
        {PRESENCE_ORDER.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => { onSetPresence(key); onClose(); }}
            className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors ${myPresence === key ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
          >
            <StatusDot status={key} className="w-3 h-3 mt-1" />
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-800">{PRESENCE[key].label}</span>
              <span className="block text-xs text-slate-500">{PRESENCE[key].desc}</span>
            </span>
            {myPresence === key && <Icon name="check" className="w-4 h-4 text-indigo-600 mt-0.5" />}
          </button>
        ))}
      </div>

      <div className="border-t border-slate-100 px-3 py-2.5">
        <p className="text-xs font-medium text-slate-500 mb-2">ธีม</p>
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
          {THEMES.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => changeTheme(item.value)}
              className={`flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium transition-colors ${
                theme === item.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon name={item.icon} className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 p-1.5">
        <button type="button" onClick={() => { onOpenSettings(); onClose(); }} className="w-full flex items-center gap-3 px-3 h-10 rounded-lg hover:bg-slate-50 text-sm text-slate-700">
          <Icon name="settings" className="w-4 h-4 text-slate-500" />
          ตั้งค่าของฉัน
        </button>
        <button type="button" onClick={onLogout} className="w-full flex items-center gap-3 px-3 h-10 rounded-lg hover:bg-red-50 text-sm text-red-600">
          <Icon name="logout" className="w-4 h-4" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

function RailButton({ active, title, onClick, children, badge }) {
  return (
    <div className="relative group flex justify-center w-full">
      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-indigo-600 transition-all ${active ? 'h-8' : 'h-0 group-hover:h-4'}`} />
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
          active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`}
      >
        {children}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center border-2 border-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
      <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
        {title}
      </span>
    </div>
  );
}

export default function AppRail({
  currentUser,
  view,
  myGroups,
  currentGroup,
  onNavigate,
  onSelectGroup,
  onLogout,
  inspectingGroup,
  onSetPresence,
  notifications,
  unreadNotifications,
  onOpenNotification,
  onReadAllNotifications,
  messagesUnread,
  onAddGroup
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showInbox, setShowInbox] = useState(false);

  return (
    <nav className="w-[72px] shrink-0 h-full bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-1.5">
      <RailButton title="หน้าหลัก" active={view === 'lobby'} onClick={() => onNavigate('lobby')}>
        <Icon name="home" className="w-6 h-6" />
      </RailButton>
      <div className="relative w-full">
        <RailButton title="การแจ้งเตือน" active={showInbox} onClick={() => setShowInbox(!showInbox)} badge={unreadNotifications}>
          <Icon name="bell" className="w-6 h-6" />
        </RailButton>
        {showInbox && (
          <NotificationPanel
            notifications={notifications || []}
            onOpen={onOpenNotification}
            onReadAll={onReadAllNotifications}
            onClose={() => setShowInbox(false)}
          />
        )}
      </div>
      <RailButton title="ข้อความ" active={view === 'messages'} onClick={() => onNavigate('messages')} badge={messagesUnread}>
        <Icon name="chat" className="w-6 h-6" />
      </RailButton>
      <RailButton title="คลิปบอร์ดของฉัน" active={view === 'clipboard'} onClick={() => onNavigate('clipboard')}>
        <Icon name="clipboard" className="w-6 h-6" />
      </RailButton>
      <RailButton title="ภาพรวมของฉัน" active={view === 'overview'} onClick={() => onNavigate('overview')}>
        <Icon name="chart" className="w-6 h-6" />
      </RailButton>
      {isStaffUser(currentUser) && (
        <RailButton
          title={isAdminUser(currentUser) ? 'Admin Dashboard' : 'Staff Dashboard'}
          active={view === 'admin'}
          onClick={() => onNavigate('admin')}
        >
          <Icon name="shield" className="w-6 h-6" />
        </RailButton>
      )}

      <div className="w-8 border-t border-slate-200 my-1.5" />

      <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-1.5">
        {inspectingGroup && (
          <RailButton title={'กำลังตรวจสอบ: ' + inspectingGroup.name} active={view === 'workspace' || view === 'groupSettings'} onClick={() => onNavigate('workspace')}>
            <span className="relative">
              <GroupAvatar group={inspectingGroup} />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center border-2 border-white">
                <Icon name="eye" className="w-3 h-3" />
              </span>
            </span>
          </RailButton>
        )}
        {myGroups.map(group => {
          const isActive = (view === 'workspace' || view === 'groupSettings') && currentGroup && currentGroup.id === group.id;
          return (
            <RailButton key={group.id} title={group.name} active={isActive} onClick={() => onSelectGroup(group)}>
              <GroupAvatar group={group} />
            </RailButton>
          );
        })}
        <RailButton title="สร้างหรือค้นหากลุ่ม" onClick={onAddGroup}>
          <span className="w-10 h-10 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
            <Icon name="plus" className="w-5 h-5" />
          </span>
        </RailButton>
      </div>

      <div className="w-8 border-t border-slate-200 my-1.5" />

      <div className="relative w-full">
        <RailButton title={'สถานะ: ' + PRESENCE[currentUser.presence || 'online'].label} active={view === 'settings'} onClick={() => setShowMenu(!showMenu)}>
          <Avatar src={currentUser.avatar} name={currentUser.name} size="md" status={currentUser.presence || 'online'} />
        </RailButton>
        {showMenu && (
          <PresenceMenu
            currentUser={currentUser}
            onSetPresence={onSetPresence}
            onOpenSettings={() => onNavigate('settings')}
            onLogout={onLogout}
            onClose={() => setShowMenu(false)}
          />
        )}
      </div>
    </nav>
  );
}
