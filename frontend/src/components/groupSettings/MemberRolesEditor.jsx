import { useState, useEffect, useRef } from 'react';
import { apiSend } from '../../api';
import Icon from '../ui/Icon';
import { getMemberRoles, hasPermission } from '../../utils/permissions';

export default function MemberRolesEditor({ group, memberId, currentUser }) {
  const [showMenu, setShowMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);

  const isOwner = memberId === group.ownerId;
  const isMe = memberId === currentUser.id;
  const canEdit = !isOwner && !isMe && hasPermission(group, currentUser.id, 'manage_roles');

  const myRoles = isOwner ? [] : getMemberRoles(group, memberId).filter(r => !r.isDefault);
  const myRoleIds = myRoles.map(r => r.id);
  const otherRoles = (group.roles || []).filter(r => !r.isDefault && !myRoleIds.includes(r.id));

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const setRole = async (roleId, assigned) => {
    setSaving(true);
    try {
      await apiSend('PUT', '/groups/' + group.id + '/members/' + memberId + '/role', { roleId: roleId, assigned: assigned });
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isOwner) {
    return (
      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
        <Icon name="star" className="w-3.5 h-3.5" />
        Owner
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {myRoles.map(role => (
        <span key={role.id} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
          {role.name}
          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setRole(role.id, false)}
              title={'นำ Role ' + role.name + ' ออก'}
              className="w-4 h-4 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"
            >
              <Icon name="x" className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}

      {myRoles.length === 0 && !canEdit && <span className="text-xs text-slate-400">ไม่มี Role เพิ่มเติม</span>}

      {canEdit && otherRoles.length > 0 && (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            title="เพิ่ม Role"
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:text-indigo-700 hover:border-indigo-400"
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
            เพิ่ม Role
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-40 w-56 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-1">
              {otherRoles.map(role => (
                <button
                  key={role.id}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setShowMenu(false);
                    setRole(role.id, true);
                  }}
                  className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-slate-700 hover:bg-slate-50 text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                  {role.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
