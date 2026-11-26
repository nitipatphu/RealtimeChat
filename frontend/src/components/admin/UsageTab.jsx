import { useState, useEffect } from 'react';
import socket from '../../socket';
import { apiGet } from '../../api';
import Card, { StatCard } from '../ui/Card';
import BarChart from '../ui/BarChart';
import Avatar from '../ui/Avatar';
import { SystemRoleBadge } from '../ui/Badge';
import { ErrorBox } from '../ui/Form';
import { shortDay } from '../../utils/format';

function clockText(value) {
  const date = new Date(value);
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
}

function peakHint(day) {
  if (!day || !day.peakAt) return 'ยังไม่มีข้อมูล';
  return 'ตอน ' + clockText(day.peakAt);
}

function recordHint(record) {
  if (!record) return 'ยังไม่มีข้อมูล';
  return shortDay(record.date) + ' ตอน ' + clockText(record.peakAt);
}

export default function UsageTab({ currentUser }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiGet('/admin/usage')
      .then(result => {
        setData(result);
        setError('');
      })
      .catch(err => setError(err.message));
  }, [currentUser.id, reloadKey]);

  useEffect(() => {
    const reload = () => setReloadKey(key => key + 1);
    socket.on('online-users', reload);
    const timer = setInterval(reload, 60000);
    return () => {
      socket.off('online-users', reload);
      clearInterval(timer);
    };
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <p className="text-sm text-slate-500">กำลังโหลด...</p>;

  const activeDays = data.days.map(day => ({ date: day.date, count: day.active }));
  const peakDays = data.days.map(day => ({ date: day.date, count: day.peak }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="กำลังใช้งานตอนนี้" value={data.onlineNow} icon="users" tone="emerald" hint="อัปเดตอัตโนมัติ" />
        <StatCard label="ผู้ใช้งานวันนี้" value={data.today.active} icon="chart" hint="คนที่เข้าใช้หรือส่งข้อความวันนี้" />
        <StatCard label="ออนไลน์พร้อมกันสูงสุดวันนี้" value={data.today.peak} icon="clock" tone="amber" hint={peakHint(data.today)} />
        <StatCard
          label="ออนไลน์พร้อมกันสูงสุดตลอดกาล"
          value={data.record ? data.record.peak : 0}
          icon="sparkles"
          tone="slate"
          hint={recordHint(data.record)}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="ผู้ใช้งานต่อวัน" description={'ย้อนหลัง 14 วัน · วันที่คนใช้มากที่สุด ' + shortDay(data.busiestDay.date) + ' (' + data.busiestDay.active + ' คน)'}>
          <BarChart data={activeDays} label="ผู้ใช้งาน" unit="คน" showMax />
        </Card>
        <Card
          title="ออนไลน์พร้อมกันสูงสุดต่อวัน"
          description={data.trackingSince ? 'เริ่มเก็บข้อมูลตั้งแต่ ' + shortDay(data.trackingSince) : 'ยังไม่มีข้อมูล'}
        >
          <BarChart data={peakDays} label="ออนไลน์สูงสุด" unit="คน" showMax />
        </Card>
      </div>

      <Card title={'คนที่กำลังใช้งาน (' + data.onlineNow + ' คน)'}>
        {data.online.length === 0 && <p className="text-sm text-slate-500">ไม่มีใครออนไลน์อยู่</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.online.map(user => (
            <div key={user.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-100">
              <Avatar src={user.avatar} name={user.name} size="sm" status="online" />
              <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{user.name}</span>
              {user.systemRole !== 'member' && <SystemRoleBadge systemRole={user.systemRole} />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
