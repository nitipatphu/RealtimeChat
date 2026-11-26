import { useEffect } from 'react';
import MemberRolesEditor from '../groupSettings/MemberRolesEditor';
import ModerationActions from '../groupSettings/ModerationActions';
import Avatar, { StatusDot } from '../ui/Avatar';
import { PRESENCE } from '../../utils/presence';
import Button, { IconButton } from '../ui/Button';
import { SystemRoleBadge, VipBadge } from '../ui/Badge';
import { getMemberRole, getNickname, isGroupMember } from '../../utils/permissions';
import { formatDate } from '../../utils/format';
import { vipNameClass } from '../../utils/vip';
import { useCloseOnBack } from '../../utils/backButton';

export default function UserProfileModal({ user, group, currentUser, status, onClose, onMessage, onEditProfile, isBlocked, onToggleBlock }) {
  useCloseOnBack(onClose);
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isMe = user.id === currentUser.id;
  const inGroup = group && isGroupMember(group, user.id);
  const nickname = inGroup ? getNickname(group, user.id) : '';
  const role = inGroup ? getMemberRole(group, user.id) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="h-24 relative" style={{ backgroundColor: user.bannerColor || '#6366f1' }}>
          <div className="absolute top-2 right-2">
            <IconButton icon="x" title="ปิด" onClick={onClose} size="sm" className="bg-white/80 hover:bg-white" />
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-12 mb-3">
            <span className="inline-block rounded-full ring-4 ring-white">
              <Avatar src={user.avatar} name={user.name} size="2xl" status={status} />
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-xl font-semibold ${vipNameClass(user) || 'text-slate-900'}`}>{nickname || user.name}</h3>
            <VipBadge user={user} />
            {user.systemRole !== 'member' && <SystemRoleBadge systemRole={user.systemRole} />}
          </div>
          {nickname && <p className="text-sm text-slate-500">{user.name}</p>}
          {user.title && <p className="text-sm text-slate-600 mt-1">{user.title}</p>}

          <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <StatusDot status={status} className="w-2.5 h-2.5" />
            {PRESENCE[status].label}
          </p>

          <div className="mt-4 space-y-3 text-sm">
            {user.bio && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">เกี่ยวกับ</p>
                <p className="text-slate-700 whitespace-pre-wrap">{user.bio}</p>
              </div>
            )}
            {role && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Role ใน {group.name}</p>
                <MemberRolesEditor group={group} memberId={user.id} currentUser={currentUser} />
              </div>
            )}
            {inGroup && !isMe && (
              <ModerationActions group={group} memberId={user.id} memberName={nickname || user.name} currentUser={currentUser} onDone={onClose} />
            )}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">สมาชิกตั้งแต่</p>
              <p className="text-slate-700">{formatDate(user.createdAt)}</p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            {isMe ? (
              <Button variant="secondary" icon="pencil" className="flex-1" onClick={onEditProfile}>แก้ไขโปรไฟล์</Button>
            ) : (
              <>
                {!isBlocked && <Button icon="chat" className="flex-1" onClick={onMessage}>ส่งข้อความ</Button>}
                <Button
                  variant="secondary"
                  icon="ban"
                  className={isBlocked ? 'flex-1' : ''}
                  onClick={() => {
                    if (!isBlocked && !window.confirm('บล็อก ' + user.name + '?' + String.fromCharCode(10) + 'ข้อความของเขาจะถูกซ่อน และเขาส่ง DM หาคุณไม่ได้')) return;
                    onToggleBlock(!isBlocked);
                  }}
                >
                  {isBlocked ? 'ปลดบล็อก' : 'บล็อก'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
