import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import Card, { StatCard } from '../ui/Card';
import BarChart, { HorizontalBars } from '../ui/BarChart';
import { ErrorBox } from '../ui/Form';

export default function AdminStatsTab({ currentUser, onGoTo }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet('/admin/stats');
        setStats(data);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [currentUser.id]);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <p className="text-sm text-slate-500">กำลังโหลด...</p>;

  const topGroups = stats.topGroups.map(g => ({ id: g.id, label: g.name, value: g.messageCount }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ผู้ใช้ทั้งหมด" value={stats.users.total} icon="users" hint={'ถูกระงับ ' + stats.users.suspended + ' บัญชี'} />
        <StatCard label="กลุ่มทั้งหมด" value={stats.groups.total} icon="grid" tone="emerald" hint={'Public ' + stats.groups.public + ' · Private ' + stats.groups.private} />
        <StatCard label="ข้อความทั้งหมด" value={stats.messages.total} icon="chat" tone="slate" hint="รวมทุก Channel, Project และ DM" />
        <button type="button" onClick={() => onGoTo('vip')} className="text-left">
          <StatCard label="สมาชิก VIP" value={stats.users.vip + stats.users.supervip} icon="sparkles" tone="amber" hint={'VIP ' + stats.users.vip + ' · SUPER VIP ' + stats.users.supervip} />
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="ข้อความใหม่ต่อวัน" description="ย้อนหลัง 14 วัน">
          <BarChart data={stats.messageActivity} label="ข้อความ" unit="ข้อความ" />
        </Card>
        <Card title="ผู้ใช้สมัครใหม่ต่อวัน" description="ย้อนหลัง 14 วัน">
          <BarChart data={stats.signupActivity} label="ผู้ใช้ใหม่" unit="คน" />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="กลุ่มที่คุยกันมากที่สุด" description="จำนวนข้อความทั้งหมดในกลุ่ม">
          <HorizontalBars items={topGroups} unit="ข้อความ" />
        </Card>
        <Card title="บัญชีตามสิทธิ์ระบบ">
          <div className="space-y-3">
            {[
              { label: 'Administrator', value: stats.users.administrator },
              { label: 'Staff', value: stats.users.staff },
              { label: 'Member', value: stats.users.member }
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                <span className="text-slate-600">{row.label}</span>
                <span className="font-semibold text-slate-900 tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
