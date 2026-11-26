import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';
import { Field, ErrorBox, Toggle, inputClass } from '../ui/Form';
import { PERMISSIONS, ROLE_COLORS, hasPermission, getMemberRole } from '../../utils/permissions';
import { showError, askConfirm } from '../../utils/dialog';


function saveRoleLabel(saving, role) {
  if (saving) return 'กำลังบันทึก...';
  if (role) return 'บันทึก Role';
  return 'สร้าง Role';
}

function permissionNames(role) {
  if (role.permissions.length === 0) return 'ไม่มีสิทธิ์พิเศษ';
  const names = [];
  role.permissions.forEach(key => {
    const permission = PERMISSIONS.find(p => p.key === key);
    if (permission) names.push(permission.label);
  });
  return names.join(', ');
}

function RoleEditor({ group, role, onDone, showSaved }) {
  const [name, setName] = useState(role ? role.name : '');
  const [color, setColor] = useState(role ? role.color : ROLE_COLORS[0]);
  const [permissions, setPermissions] = useState(role ? role.permissions : ['change_nickname']);
  const [hoist, setHoist] = useState(role ? role.hoist === true : false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const togglePermission = (key) => {
    if (permissions.includes(key)) {
      setPermissions(permissions.filter(p => p !== key));
    } else {
      setPermissions([...permissions, key]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body = { name: name, color: color, permissions: permissions, hoist: hoist };
      if (role) {
        await apiSend('PUT', '/groups/' + group.id + '/roles/' + role.id, body);
      } else {
        await apiSend('POST', '/groups/' + group.id + '/roles', body);
      }
      showSaved();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await askConfirm('ลบ Role ' + role.name + '? สมาชิกที่มี Role นี้จะกลับไปเป็น Role เริ่มต้น');
    if (!confirmed) return;
    try {
      await apiSend('DELETE', '/groups/' + group.id + '/roles/' + role.id);
      showSaved();
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card
      title={role ? 'แก้ไข Role' : 'สร้าง Role ใหม่'}
      description={role && role.isDefault ? 'Role เริ่มต้น: สมาชิกใหม่ทุกคนจะได้ Role นี้' : 'ตั้งชื่อ สี และเลือกสิทธิ์ที่ Role นี้ทำได้'}
      action={<Button variant="ghost" size="sm" icon="x" onClick={onDone}>ปิด</Button>}
    >
      <div className="space-y-5">
        <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
          <Field label="ชื่อ Role">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className={inputClass} placeholder="เช่น Moderator, Designer" autoFocus />
          </Field>
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">สี</span>
            <div className="flex gap-1.5 h-10 items-center">
              {ROLE_COLORS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColor(item)}
                  className={`w-6 h-6 rounded-full ${color === item ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                  style={{ backgroundColor: item }}
                  title={item}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">แสดงสมาชิก Role นี้แยกในรายชื่อ</p>
            <p className="text-xs text-slate-500">สมาชิกที่ออนไลน์จะมีหัวข้อชื่อ Role นี้แยกออกมาในรายชื่อสมาชิกด้านซ้าย แบบ Discord (หัวข้อจะขึ้นเมื่อมีคนใน Role นี้ออนไลน์อยู่อย่างน้อย 1 คน)</p>
          </div>
          <Toggle checked={hoist} onChange={setHoist} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">สิทธิ์ ({permissions.length}/{PERMISSIONS.length})</span>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setPermissions(PERMISSIONS.map(p => p.key))}>เลือกทั้งหมด</button>
              <button type="button" className="text-slate-500 hover:underline" onClick={() => setPermissions([])}>ล้าง</button>
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {PERMISSIONS.map(permission => (
              <div key={permission.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{permission.label}</p>
                  <p className="text-xs text-slate-500">{permission.desc}</p>
                </div>
                <Toggle
                  checked={permissions.includes(permission.key) || (permission.key !== 'administrator' && permissions.includes('administrator'))}
                  disabled={permission.key !== 'administrator' && permissions.includes('administrator')}
                  onChange={() => togglePermission(permission.key)}
                />
              </div>
            ))}
          </div>
        </div>

        <ErrorBox message={error} />

        <div className="flex justify-between">
          {role && !role.isDefault ? (
            <Button variant="dangerSoft" icon="trash" onClick={handleDelete}>ลบ Role</Button>
          ) : (
            <span />
          )}
          <Button onClick={handleSave} disabled={saving}>{saveRoleLabel(saving, role)}</Button>
        </div>
      </div>
    </Card>
  );
}

export default function GroupRolesTab({ group, currentUser, showSaved }) {
  const [editing, setEditing] = useState(null);

  const canManage = hasPermission(group, currentUser.id, 'manage_roles');
  const myRole = getMemberRole(group, currentUser.id);
  const roles = group.roles || [];

  const countMembers = (role) => {
    return (group.members || []).filter(id => id !== group.ownerId && getMemberRole(group, id).roleIds.includes(role.id)).length;
  };

  const moveRole = async (index, step) => {
    const target = index + step;
    if (target < 0 || target >= roles.length) return;
    const ids = roles.map(r => r.id);
    const temp = ids[index];
    ids[index] = ids[target];
    ids[target] = temp;
    try {
      await apiSend('PUT', '/groups/' + group.id + '/roles-order', { roleIds: ids });
      showSaved();
    } catch (err) {
      showError(err.message);
    }
  };

  if (editing) {
    const role = editing === 'new' ? null : roles.find(r => r.id === editing);
    return <RoleEditor key={editing} group={group} role={role} currentUser={currentUser} showSaved={showSaved} onDone={() => setEditing(null)} />;
  }

  return (
    <Card
      title="Role ในกลุ่ม"
      description="Role ใช้กำหนดว่าสมาชิกทำอะไรได้บ้าง ลำดับด้านล่างคือลำดับหัวข้อในรายชื่อสมาชิก"
      action={canManage && <Button icon="plus" size="sm" onClick={() => setEditing('new')}>สร้าง Role</Button>}
      padding="none"
    >
      <div className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
        <div className="flex items-center gap-4 px-6 py-4">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Owner <Icon name="star" className="w-4 h-4 text-amber-500" />
            </p>
            <p className="text-xs text-slate-500">เจ้าของกลุ่ม มีสิทธิ์ทุกอย่าง แก้ไขไม่ได้</p>
          </div>
          <span className="text-sm text-slate-500">1 คน</span>
        </div>

        {roles.map((role, index) => {
          const lockedForMe = !myRole.isOwner && !role.isDefault && myRole.roleIds.includes(role.id);
          return (
            <div key={role.id} className="flex items-center gap-4 px-6 py-4">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  {role.name}
                  {role.isDefault && <Badge tone="indigo">เริ่มต้น</Badge>}
                  {role.hoist && <Badge tone="emerald">แสดงแยกในรายชื่อ</Badge>}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {permissionNames(role)}
                </p>
              </div>
              <span className="text-sm text-slate-500 whitespace-nowrap">{countMembers(role)} คน</span>
              {canManage && (
                <span className="flex flex-col">
                  <button type="button" title="เลื่อนขึ้น" disabled={index === 0} onClick={() => moveRole(index, -1)} className="text-slate-400 hover:text-slate-800 disabled:opacity-30">
                    <Icon name="chevronDown" className="w-4 h-4 rotate-180" />
                  </button>
                  <button type="button" title="เลื่อนลง" disabled={index === roles.length - 1} onClick={() => moveRole(index, 1)} className="text-slate-400 hover:text-slate-800 disabled:opacity-30">
                    <Icon name="chevronDown" className="w-4 h-4" />
                  </button>
                </span>
              )}
              {canManage && !lockedForMe && (
                <Button variant="secondary" size="sm" icon="pencil" onClick={() => setEditing(role.id)}>แก้ไข</Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
