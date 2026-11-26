import { useState, useEffect, useRef } from 'react';
import { apiSend } from '../../api';
import Icon from '../ui/Icon';
import { hasPermission, getTimeoutUntil } from '../../utils/permissions';
import { showError, askText } from '../../utils/dialog';

const TIMEOUT_OPTIONS = [
  { minutes: 5, label: '5 นาที' },
  { minutes: 10, label: '10 นาที' },
  { minutes: 60, label: '1 ชั่วโมง' },
  { minutes: 24 * 60, label: '1 วัน' },
  { minutes: 7 * 24 * 60, label: '1 สัปดาห์' }
];

export default function ModerationActions({ group, memberId, memberName, currentUser, onDone }) {
  const [showMenu, setShowMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  if (memberId === group.ownerId || memberId === currentUser.id) return null;

  const isOwner = currentUser.id === group.ownerId;
  const canTimeout = hasPermission(group, currentUser.id, 'timeout_members') && (isOwner || !hasPermission(group, memberId, 'timeout_members'));
  const canBan = hasPermission(group, currentUser.id, 'ban_members') && (isOwner || !hasPermission(group, memberId, 'ban_members'));
  if (!canTimeout && !canBan) return null;

  const timeoutUntil = getTimeoutUntil(group, memberId);

  const setTimeoutFor = async (minutes) => {
    setShowMenu(false);
    setSaving(true);
    try {
      await apiSend('PUT', '/groups/' + group.id + '/members/' + memberId + '/timeout', { minutes: minutes });
    } catch (err) {
      showError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const ban = async () => {
    const reason = await askText('แบน ' + memberName + ' ออกจากกลุ่ม?\nคนที่ถูกแบนจะกลับเข้ากลุ่มไม่ได้จนกว่าจะปลดแบน\n\nเหตุผล (ไม่บังคับ):', '');
    if (reason === null) return;
    setSaving(true);
    try {
      await apiSend('POST', '/groups/' + group.id + '/bans', { memberId: memberId, reason: reason });
      if (onDone) onDone();
    } catch (err) {
      showError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canTimeout && (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            disabled={saving}
            onClick={() => setShowMenu(!showMenu)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium ${
              timeoutUntil ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon name="clock" className="w-3.5 h-3.5" />
            {timeoutUntil ? 'Timeout ถึง ' + new Date(timeoutUntil).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Timeout'}
          </button>
          {showMenu && (
            <div className="absolute left-0 bottom-full mb-1 z-40 w-44 bg-white border border-slate-200 rounded-xl shadow-xl p-1">
              <p className="px-3 pt-1 pb-1.5 text-xs text-slate-500">ห้ามส่งข้อความเป็นเวลา</p>
              {TIMEOUT_OPTIONS.map(option => (
                <button
                  key={option.minutes}
                  type="button"
                  onClick={() => setTimeoutFor(option.minutes)}
                  className="w-full text-left px-3 h-8 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  {option.label}
                </button>
              ))}
              {timeoutUntil && (
                <button
                  type="button"
                  onClick={() => setTimeoutFor(0)}
                  className="w-full text-left px-3 h-8 rounded-lg text-sm text-emerald-700 hover:bg-emerald-50 border-t border-slate-100 mt-1"
                >
                  ยกเลิก Timeout
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {canBan && (
        <button
          type="button"
          disabled={saving}
          onClick={ban}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          <Icon name="ban" className="w-3.5 h-3.5" />
          แบน
        </button>
      )}
    </div>
  );
}
