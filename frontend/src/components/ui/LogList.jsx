import Icon from './Icon';
import { formatDateTime, timeAgo } from '../../utils/format';

const ACTION_ICONS = {
  member_join: 'login',
  member_add: 'users',
  member_leave: 'logout',
  member_kick: 'ban',
  role_create: 'tag',
  role_update: 'tag',
  role_delete: 'tag',
  role_assign: 'tag',
  nickname: 'pencil',
  channel_create: 'hash',
  channel_rename: 'hash',
  channel_delete: 'hash',
  project_create: 'board',
  project_delete: 'board',
  project_member: 'board',
  settings_update: 'settings',
  admin_update: 'shield',
  invite_reset: 'key',
  owner_transfer: 'star',
  message_delete: 'trash',
  group_create: 'sparkles',
  group_update: 'settings',
  group_delete: 'trash',
  user_create: 'user',
  user_update: 'user',
  user_suspend: 'ban',
  user_activate: 'check',
  user_delete: 'trash',
  user_password: 'key',
  vip_grant: 'sparkles',
  vip_revoke: 'sparkles',
  vip_code: 'sparkles',
  vip_redeem: 'sparkles',
  vip_settings: 'sparkles',
  group_inspect: 'eye'
};

const DANGER_ACTIONS = ['member_kick', 'role_delete', 'channel_delete', 'project_delete', 'message_delete', 'group_delete', 'user_suspend', 'user_delete'];

export default function LogList({ logs, filterText }) {
  let list = logs || [];
  if (filterText) {
    const query = filterText.toLowerCase();
    list = list.filter(log => log.text.toLowerCase().includes(query));
  }

  if (list.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-10">ไม่มีรายการ</p>;
  }

  return (
    <ol className="relative">
      {list.map((log, index) => {
        const isDanger = DANGER_ACTIONS.includes(log.action);
        return (
          <li key={log.id} className="flex gap-4 relative pb-5">
            {index < list.length - 1 && <span className="absolute left-[17px] top-9 bottom-0 w-px bg-slate-200" />}
            <span className={`relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isDanger ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
              <Icon name={ACTION_ICONS[log.action] || 'clock'} className="w-4 h-4" />
            </span>
            <div className="pt-1.5 min-w-0">
              <p className="text-sm text-slate-800">{log.text}</p>
              <p className="text-xs text-slate-400 mt-0.5" title={formatDateTime(log.createdAt)}>{timeAgo(log.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
