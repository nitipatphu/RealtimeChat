import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import { SystemRoleBadge } from '../ui/Badge';
import { ErrorBox, inputBaseClass } from '../ui/Form';
import { formatDateTime, timeAgo } from '../../utils/format';

export default function AdminLogsTab({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiGet('/admin/logs')
      .then(data => setLogs(data))
      .catch(err => setError(err.message));
  }, [currentUser.id, reloadKey]);

  const load = () => {
    setReloadKey(key => key + 1);
  };

  let list = logs;
  if (search.trim()) {
    const query = search.trim().toLowerCase();
    list = list.filter(log => log.text.toLowerCase().includes(query) || log.actorName.toLowerCase().includes(query));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาใน Log..." className={inputBaseClass + ' w-72 h-10'} />
        <div className="flex-1" />
        <Button variant="secondary" size="sm" icon="refresh" onClick={load}>รีเฟรช</Button>
      </div>
      <ErrorBox message={error} />

      <Card padding="none">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500 border-b border-slate-200">
            <tr>
              <th className="font-medium px-5 py-3 w-56">ผู้ดำเนินการ</th>
              <th className="font-medium px-3 py-3">การกระทำ</th>
              <th className="font-medium px-5 py-3 w-44">เวลา</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(log => (
              <tr key={log.id}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={log.actorAvatar} name={log.actorName} size="sm" />
                    <div>
                      <p className="font-medium text-slate-900">{log.actorName}</p>
                      <SystemRoleBadge systemRole={log.actorRole} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-700">{log.text}</td>
                <td className="px-5 py-3 text-slate-500" title={formatDateTime(log.createdAt)}>{timeAgo(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-center text-sm text-slate-400 py-10">ยังไม่มี Log</p>}
      </Card>
    </div>
  );
}
