import { useState, useEffect } from 'react';
import { apiGet, apiSend } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import { SystemRoleBadge } from '../ui/Badge';
import { ErrorBox } from '../ui/Form';
import UserPicker from '../ui/UserPicker';
import { timeAgo } from '../../utils/format';

export default function AdminTeamTab({ currentUser, showSaved }) {
  const [data, setData] = useState(null);
  const [newStaff, setNewStaff] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiGet('/admin/team')
      .then(result => setData(result))
      .catch(err => setError(err.message));
  }, [currentUser.id, reloadKey]);

  const changeRole = async (user, systemRole, question) => {
    if (!window.confirm(question)) return;
    setError('');
    try {
      await apiSend('PUT', '/admin/users/' + user.id + '/system-role', { systemRole: systemRole });
      setNewStaff(null);
      showSaved();
      setReloadKey(key => key + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const appointStaff = () => {
    const user = newStaff;
    if (!user) return;
    changeRole(user, 'staff', 'แต่งตั้ง ' + user.name + ' เป็น Staff?');
  };

  if (!data) {
    return error ? <ErrorBox message={error} /> : <p className="text-sm text-slate-500">กำลังโหลด...</p>;
  }

  return (
    <div className="space-y-6">
      <Card title="แต่งตั้ง Staff" description="Staff จะเข้า Staff Dashboard ได้ ตรวจสอบรายงาน และระงับบัญชี Member ได้">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <UserPicker searchFilter="&role=member&status=active" value={newStaff ? newStaff.id : ''} onChange={(id, user) => setNewStaff(user)} placeholder="พิมพ์อีเมลหรือชื่อของ Member..." />
          </div>
          <Button icon="shield" onClick={appointStaff} disabled={!newStaff}>แต่งตั้งเป็น Staff</Button>
        </div>
      </Card>

      <ErrorBox message={error} />

      <Card title={'ทีมงาน (' + data.team.length + ')'} padding="none">
        <div className="overflow-x-auto mt-4 border-t border-slate-100">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="font-medium px-5 py-3">ทีมงาน</th>
                <th className="font-medium px-3 py-3">สิทธิ์</th>
                <th className="font-medium px-3 py-3 text-right">การกระทำทั้งหมด</th>
                <th className="font-medium px-3 py-3 text-right">สัปดาห์นี้</th>
                <th className="font-medium px-3 py-3 text-right">จัดการ VIP</th>
                <th className="font-medium px-3 py-3 text-right">ระงับบัญชี</th>
                <th className="font-medium px-3 py-3">ทำงานล่าสุด</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.team.map(user => {
                const isMe = user.id === currentUser.id;
                return (
                  <tr key={user.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar} name={user.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{user.name} {isMe && <span className="text-slate-400 font-normal">(คุณ)</span>}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><SystemRoleBadge systemRole={user.systemRole} /></td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{user.actionsTotal}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{user.actionsWeek}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{user.vipTotal}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{user.suspendTotal}</td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{user.lastActionAt ? timeAgo(user.lastActionAt) : '-'}</td>
                    <td className="px-5 py-3 text-right">
                      {user.systemRole === 'staff' && (
                        <Button size="sm" variant="dangerSoft" onClick={() => changeRole(user, 'member', 'ถอด ' + user.name + ' ออกจาก Staff? จะกลับเป็น Member')}>
                          ถอดออก
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
