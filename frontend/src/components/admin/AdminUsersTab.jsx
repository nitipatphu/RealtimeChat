import { useState, useEffect } from 'react';
import { apiGet, apiSend } from '../../api';
import Card from '../ui/Card';
import Button, { IconButton } from '../ui/Button';
import Avatar from '../ui/Avatar';
import Badge, { SystemRoleBadge } from '../ui/Badge';
import Modal from '../ui/Modal';
import { Field, ErrorBox, inputClass, inputBaseClass } from '../ui/Form';
import { isAdminUser } from '../../utils/permissions';
import { formatDate, timeAgo } from '../../utils/format';

function UserFormModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user ? user.name : '');
  const [email, setEmail] = useState(user ? user.email : '');
  const [password, setPassword] = useState('');
  const [systemRole, setSystemRole] = useState(user ? user.systemRole : 'member');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (user) {
        await apiSend('PUT', '/admin/users/' + user.id, { name: name, email: email, systemRole: systemRole });
        if (password) {
          await apiSend('PUT', '/admin/users/' + user.id + '/password', { newPassword: password });
        }
      } else {
        await apiSend('POST', '/admin/users', { name: name, email: email, password: password, systemRole: systemRole });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={user ? 'แก้ไขบัญชี' : 'สร้างบัญชีใหม่'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="ชื่อ">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={50} autoFocus />
        </Field>
        <Field label="อีเมล">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label={user ? 'รีเซ็ตรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน'} hint="อย่างน้อย 6 ตัวอักษร">
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <Field label="สิทธิ์ในระบบ">
          <select value={systemRole} onChange={(e) => setSystemRole(e.target.value)} className={inputClass}>
            <option value="member">Member</option>
            <option value="staff">Staff</option>
            <option value="administrator">Administrator</option>
          </select>
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export default function AdminUsersTab({ currentUser, showSaved }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const isAdmin = isAdminUser(currentUser);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchText(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let url = '/admin/users?page=' + page;
    if (searchText) url += '&q=' + encodeURIComponent(searchText);
    if (roleFilter !== 'all') url += '&role=' + roleFilter;
    apiGet(url)
      .then(data => {
        setUsers(data.users);
        setTotal(data.total);
        setPages(data.pages);
      })
      .catch(err => setError(err.message));
  }, [currentUser.id, reloadKey, page, searchText, roleFilter]);

  const changeRoleFilter = (value) => {
    setRoleFilter(value);
    setPage(1);
  };

  const load = () => {
    setReloadKey(key => key + 1);
  };

  const run = async (action) => {
    setError('');
    try {
      await action();
      showSaved();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSuspend = (user) => {
    if (user.accountStatus === 'active') {
      const reason = window.prompt('เหตุผลในการระงับบัญชี ' + user.name, '');
      if (reason === null) return;
      run(() => apiSend('PUT', '/admin/users/' + user.id + '/status', { status: 'suspended', reason: reason }));
    } else {
      if (!window.confirm('ยกเลิกการระงับบัญชี ' + user.name + '?')) return;
      run(() => apiSend('PUT', '/admin/users/' + user.id + '/status', { status: 'active' }));
    }
  };

  const deleteUser = (user) => {
    if (!window.confirm('ลบบัญชี ' + user.name + ' (' + user.email + ') ถาวร?')) return;
    run(() => apiSend('DELETE', '/admin/users/' + user.id));
  };

  const list = users;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อหรืออีเมล..." className={inputBaseClass + ' w-64 h-10'} />
        <select value={roleFilter} onChange={(e) => changeRoleFilter(e.target.value)} className={inputBaseClass + ' w-44 h-10'}>
          <option value="all">ทุกสิทธิ์</option>
          <option value="administrator">Administrator</option>
          <option value="staff">Staff</option>
          <option value="member">Member</option>
          <option value="suspended">ถูกระงับ</option>
        </select>
        <span className="text-sm text-slate-500">พบ {total} คน</span>
        <div className="flex-1" />
        {isAdmin && <Button icon="plus" onClick={() => setEditing('new')}>สร้างบัญชี</Button>}
      </div>

      <ErrorBox message={error} />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="font-medium px-5 py-3">ผู้ใช้</th>
                <th className="font-medium px-3 py-3">สิทธิ์</th>
                <th className="font-medium px-3 py-3">สถานะ</th>
                <th className="font-medium px-3 py-3 text-right">กลุ่ม</th>
                <th className="font-medium px-3 py-3 text-right">ข้อความ</th>
                <th className="font-medium px-3 py-3">เข้าใช้ล่าสุด</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(user => {
                const isMe = user.id === currentUser.id;
                const canSuspend = !isMe && (isAdmin || user.systemRole === 'member');
                return (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar} name={user.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{user.name} {isMe && <span className="text-slate-400 font-normal">(คุณ)</span>}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email} · สมัคร {formatDate(user.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><SystemRoleBadge systemRole={user.systemRole} /></td>
                    <td className="px-3 py-3">
                      {user.accountStatus === 'suspended' ? (
                        <span title={user.suspendReason}><Badge tone="red">ถูกระงับ</Badge></span>
                      ) : (
                        <Badge tone="emerald">ใช้งานได้</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{user.groupCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{user.messageCount}</td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{user.lastLoginAt ? timeAgo(user.lastLoginAt) : '-'}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {isAdmin && <IconButton icon="pencil" title="แก้ไข" size="sm" onClick={() => setEditing(user)} />}
                        {canSuspend && (
                          <IconButton
                            icon={user.accountStatus === 'active' ? 'ban' : 'check'}
                            title={user.accountStatus === 'active' ? 'ระงับบัญชี' : 'ยกเลิกการระงับ'}
                            size="sm"
                            danger={user.accountStatus === 'active'}
                            onClick={() => toggleSuspend(user)}
                          />
                        )}
                        {isAdmin && !isMe && <IconButton icon="trash" title="ลบบัญชี" size="sm" danger onClick={() => deleteUser(user)} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <p className="text-center text-sm text-slate-400 py-10">ไม่พบผู้ใช้</p>}
        </div>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</Button>
          <span className="text-sm text-slate-600">หน้า {page} / {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>ถัดไป</Button>
        </div>
      )}

      {editing && (
        <UserFormModal
          user={editing === 'new' ? null : editing}
          currentUser={currentUser}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            showSaved();
            load();
          }}
        />
      )}
    </div>
  );
}
