import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import Card, { StatCard, EmptyState } from '../ui/Card';
import Avatar, { GroupAvatar } from '../ui/Avatar';
import Badge, { VisibilityBadge, SystemRoleBadge } from '../ui/Badge';
import { PRIORITY_STYLE } from '../../utils/constants';
import BarChart from '../ui/BarChart';
import Button from '../ui/Button';
import { formatDate, timeAgo } from '../../utils/format';

export default function OverviewView({ currentUser, onOpenGroup, onOpenTask, myGroups, onEditProfile }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiGet('/users/' + currentUser.id + '/overview')
      .then(result => {
        setData(result);
        setError('');
      })
      .catch(err => setError(err.message));
  }, [currentUser.id, reloadKey]);

  const load = () => {
    setReloadKey(key => key + 1);
  };

  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-sm text-slate-500">กำลังโหลดภาพรวม...</div>;

  const stats = data.stats;
  const donePercent = stats.tasksAssigned > 0 ? Math.round((stats.tasksDone / stats.tasksAssigned) * 100) : 0;

  const openGroup = (groupId) => {
    const group = myGroups.find(g => g.id === groupId);
    if (group) onOpenGroup(group);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-24" style={{ backgroundColor: currentUser.bannerColor || '#6366f1' }} />
          <div className="px-6 pb-6 flex flex-col sm:flex-row sm:items-end gap-4">
            <span className="-mt-12 inline-block rounded-full ring-4 ring-white self-start">
              <Avatar src={currentUser.avatar} name={currentUser.name} size="2xl" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold text-slate-900">ภาพรวมของ {currentUser.name}</h1>
                <SystemRoleBadge systemRole={currentUser.systemRole} />
              </div>
              <p className="text-sm text-slate-500 mt-1">
                สมาชิกตั้งแต่ {formatDate(data.memberSince)} · เข้าสู่ระบบล่าสุด {timeAgo(data.lastLoginAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" icon="refresh" onClick={load}>รีเฟรช</Button>
              <Button variant="secondary" icon="pencil" onClick={onEditProfile}>แก้ไขโปรไฟล์</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="กลุ่มที่เข้าร่วม" value={stats.groupsJoined} icon="users" hint={'เป็นเจ้าของ ' + stats.groupsOwned + ' กลุ่ม'} />
          <StatCard label="ข้อความที่ส่ง" value={stats.messagesSent} icon="chat" tone="emerald" hint={'ตอบใน Thread ' + stats.threadReplies + ' ครั้ง'} />
          <StatCard label="ถูกกล่าวถึง" value={stats.mentionsReceived} icon="at" tone="amber" hint={'ได้รับรีแอคชัน ' + stats.reactionsReceived + ' ครั้ง'} />
          <StatCard label="งานที่ได้รับ" value={stats.tasksAssigned} icon="board" tone="slate" hint={'ทำเสร็จแล้ว ' + stats.tasksDone + ' งาน (' + donePercent + '%)'} />
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <Card title="ข้อความที่ส่งย้อนหลัง 14 วัน" description="นับทุกห้อง รวมข้อความส่วนตัว">
            <BarChart data={data.activity} label="ข้อความ" unit="ข้อความ" />
          </Card>

          <Card title="งานที่ยังไม่เสร็จ" description="งานที่มอบหมายให้คุณจากทุกกลุ่ม" padding="none">
            {data.openTasks.length === 0 ? (
              <EmptyState icon="check" title="ไม่มีงานค้าง" text="เยี่ยมมาก! ไม่มีงานที่ยังไม่เสร็จ" />
            ) : (
              <ul className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
                {data.openTasks.map(task => {
                  const priority = PRIORITY_STYLE[task.priority];
                  const overdue = task.dueDate && new Date(task.dueDate + 'T23:59:59') < new Date();
                  return (
                    <li key={task.id}>
                      <button type="button" onClick={() => onOpenTask(task)} className="w-full text-left px-6 py-3 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                        {priority && <span className={`text-xs font-medium px-2 h-6 inline-flex items-center rounded-md ${priority.cls}`}>{priority.label}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {task.groupName} · {task.projectName} · {task.columnTitle}
                        {task.dueDate && <span className={overdue ? 'text-red-600 font-medium' : ''}> · ส่ง {formatDate(task.dueDate + 'T00:00:00')}</span>}
                      </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card title={'กลุ่มของฉัน (' + data.groups.length + ')'} description="เรียงตามจำนวนข้อความที่คุณส่ง" padding="none">
            {data.groups.length === 0 ? (
              <EmptyState icon="users" title="ยังไม่ได้เข้าร่วมกลุ่ม" />
            ) : (
              <ul className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
                {data.groups.map(group => (
                  <li key={group.id}>
                    <button type="button" onClick={() => openGroup(group.id)} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-50 text-left">
                      <GroupAvatar group={group} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{group.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {group.memberCount} สมาชิก
                          {group.nickname && ' · ชื่อเล่น "' + group.nickname + '"'}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.roleColor }} />
                        {group.roleName}
                      </span>
                      <VisibilityBadge visibility={group.visibility} />
                      <span className="text-sm font-semibold text-slate-900 tabular-nums w-10 text-right">{group.messageCount}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="ข้อความล่าสุดของฉัน" padding="none">
            {data.recentMessages.length === 0 ? (
              <EmptyState icon="chat" title="ยังไม่ได้ส่งข้อความ" />
            ) : (
              <ul className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
                {data.recentMessages.map(message => (
                  <li key={message.id} className="px-6 py-3">
                    <p className="text-sm text-slate-800 line-clamp-1">{message.text}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{message.roomName} · {timeAgo(message.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {stats.dmPartners > 0 && (
          <p className="text-sm text-slate-500 text-center">
            <Badge tone="indigo">เกร็ดเล็กน้อย</Badge> คุณคุยข้อความส่วนตัวกับ {stats.dmPartners} คน
          </p>
        )}
      </div>
    </div>
  );
}
