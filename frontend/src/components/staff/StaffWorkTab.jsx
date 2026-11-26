import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import Card, { StatCard } from '../ui/Card';
import BarChart from '../ui/BarChart';
import Button from '../ui/Button';
import LogList from '../ui/LogList';
import { ErrorBox } from '../ui/Form';

export default function StaffWorkTab({ currentUser, onGoTo }) {
  const [work, setWork] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiGet('/admin/my-work')
      .then(data => setWork(data))
      .catch(err => setError(err.message));
    apiGet('/admin/logs')
      .then(data => setLogs(data))
      .catch(err => setError(err.message));
  }, [currentUser.id, reloadKey]);

  if (error) return <ErrorBox message={error} />;
  if (!work) return <p className="text-sm text-slate-500">กำลังโหลด...</p>;

  const stats = work.stats;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="การกระทำทั้งหมด" value={stats.actionsTotal} icon="clock" tone="slate" hint={'สัปดาห์นี้ ' + stats.actionsWeek + ' ครั้ง'} />
        <StatCard label="บัญชีที่ฉันระงับ" value={stats.suspendTotal} icon="ban" tone="amber" />
        <button type="button" onClick={() => onGoTo('vip')} className="text-left">
          <StatCard label="VIP ที่ฉันจัดการ" value={stats.vipTotal} icon="sparkles" tone="emerald" hint="ให้ VIP และสร้างรหัส" />
        </button>
        <button type="button" onClick={() => onGoTo('users')} className="text-left">
          <StatCard label="ดูแลผู้ใช้" value={'→'} icon="users" tone="slate" hint="ไปที่รายชื่อผู้ใช้" />
        </button>
      </div>

      <Card title="งานของฉันย้อนหลัง 14 วัน" description="นับทุกการกระทำในฐานะทีมงาน">
        <BarChart data={work.activity} label="การกระทำ" unit="ครั้ง" />
      </Card>

      <Card
        title="Log ของฉัน"
        description="สิ่งที่คุณทำในฐานะทีมงาน"
        action={<Button variant="secondary" size="sm" icon="refresh" onClick={() => setReloadKey(key => key + 1)}>รีเฟรช</Button>}
      >
        <LogList logs={logs} />
      </Card>
    </div>
  );
}
