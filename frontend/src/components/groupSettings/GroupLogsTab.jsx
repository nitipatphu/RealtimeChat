import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import Card from '../ui/Card';
import LogList from '../ui/LogList';
import Button from '../ui/Button';
import { ErrorBox, inputBaseClass } from '../ui/Form';

export default function GroupLogsTab({ group, currentUser }) {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiGet('/groups/' + group.id + '/logs')
      .then(data => {
        setLogs(data);
        setError('');
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [group, currentUser.id, reloadKey]);

  const load = () => {
    setReloadKey(key => key + 1);
  };

  return (
    <Card
      title="Log ของกลุ่ม"
      description="ประวัติการเปลี่ยนแปลงในกลุ่ม เช่น สมาชิกเข้าออก เปลี่ยน Role หรือลบ Channel"
      action={
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาใน Log..." className={inputBaseClass + ' w-48 h-9'} />
          <Button variant="secondary" size="sm" icon="refresh" onClick={load} className="h-9">รีเฟรช</Button>
        </div>
      }
    >
      <ErrorBox message={error} />
      {loading ? <p className="text-sm text-slate-500">กำลังโหลด...</p> : <LogList logs={logs} filterText={search} />}
    </Card>
  );
}
