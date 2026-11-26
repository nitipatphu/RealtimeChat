import { useState, useEffect } from 'react';
import { apiGet, apiSend } from '../../api';
import Card from '../ui/Card';
import Button, { IconButton } from '../ui/Button';
import Avatar from '../ui/Avatar';
import { VipBadge } from '../ui/Badge';
import { Field, ErrorBox, inputClass } from '../ui/Form';
import { VIP_NAMES } from '../../utils/vip';
import { formatDate } from '../../utils/format';
import { isAdminUser } from '../../utils/permissions';
import TierSettingsCard from './TierSettingsCard';
import UserPicker from '../ui/UserPicker';
import { copyText } from '../../utils/clipboard';

const DAY_OPTIONS = [
  { value: 7, label: '7 วัน' },
  { value: 30, label: '30 วัน' },
  { value: 90, label: '90 วัน' },
  { value: 365, label: '1 ปี' }
];

function TierPicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {['vip', 'supervip'].map(tier => {
        let colorClass = 'border-slate-200 text-slate-600';
        if (value === tier && tier === 'supervip') colorClass = 'border-amber-400 bg-amber-50 text-amber-700';
        if (value === tier && tier === 'vip') colorClass = 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700';
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            className={'flex-1 h-10 rounded-lg border-2 text-sm font-semibold ' + colorClass}
          >
            {tier === 'supervip' ? '👑 ' : '💎 '}{VIP_NAMES[tier]}
          </button>
        );
      })}
    </div>
  );
}

function daysLeft(expiresAt) {
  return Math.ceil((new Date(expiresAt).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
}

function daysLeftColor(left) {
  if (left <= 3) return 'text-red-600';
  if (left <= 7) return 'text-amber-600';
  return 'text-slate-700';
}

export default function AdminVipTab({ currentUser, showSaved }) {
  const [data, setData] = useState({ members: [], codes: [] });
  const [reloadKey, setReloadKey] = useState(0);

  const [grantUserId, setGrantUserId] = useState('');
  const [grantTier, setGrantTier] = useState('vip');
  const [grantDays, setGrantDays] = useState(30);
  const [grantError, setGrantError] = useState('');

  const [codeTier, setCodeTier] = useState('vip');
  const [codeDays, setCodeDays] = useState(30);
  const [codeUses, setCodeUses] = useState(1);
  const [codeNote, setCodeNote] = useState('');
  const [codeError, setCodeError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    apiGet('/admin/vip')
      .then(result => setData(result))
      .catch(err => setGrantError(err.message));
  }, [currentUser.id, reloadKey]);

  const reload = () => setReloadKey(reloadKey + 1);

  const grant = async (e) => {
    e.preventDefault();
    if (!grantUserId) {
      setGrantError('กรุณาค้นหาและเลือกผู้ใช้');
      return;
    }
    setGrantError('');
    try {
      await apiSend('PUT', '/admin/users/' + grantUserId + '/vip', { tier: grantTier, days: grantDays });
      setGrantUserId('');
      showSaved();
      reload();
    } catch (err) {
      setGrantError(err.message);
    }
  };

  const revoke = async (member) => {
    if (!window.confirm('ยกเลิก ' + VIP_NAMES[member.vip.tier] + ' ของ ' + member.name + '?')) return;
    try {
      await apiSend('DELETE', '/admin/users/' + member.id + '/vip');
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const createCode = async (e) => {
    e.preventDefault();
    setCodeError('');
    try {
      const item = await apiSend('POST', '/admin/vip-codes', { tier: codeTier, days: codeDays, maxUses: codeUses, note: codeNote });
      copyText(item.code);
      setCopied(item.code);
      setCodeNote('');
      reload();
    } catch (err) {
      setCodeError(err.message);
    }
  };

  const deleteCode = async (code) => {
    if (!window.confirm('ลบรหัส ' + code + '? คนที่ใช้ไปแล้วยังเป็น VIP ต่อ')) return;
    try {
      await apiSend('DELETE', '/admin/vip-codes/' + code);
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const copyCode = (code) => {
    copyText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 1500);
  };

  const vipCount = data.members.filter(m => m.vip.tier === 'vip').length;
  const superCount = data.members.filter(m => m.vip.tier === 'supervip').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">💎 VIP</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{vipCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">👑 SUPER VIP</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{superCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">หมดอายุใน 7 วัน</p>
          <p className="text-2xl font-semibold text-amber-600 mt-1">{data.members.filter(m => daysLeft(m.vip.expiresAt) <= 7).length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">รหัสที่ยังใช้ได้</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{data.codes.filter(c => c.usedBy.length < c.maxUses).length}</p>
        </div>
      </div>

      <TierSettingsCard currentUser={currentUser} canEdit={isAdminUser(currentUser)} showSaved={showSaved} />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="ให้ VIP กับผู้ใช้" description="ถ้าผู้ใช้มีระดับเดียวกันอยู่แล้ว จะต่อวันหมดอายุออกไป">
          <form onSubmit={grant} className="space-y-3">
            <UserPicker label="ผู้ใช้" value={grantUserId} onChange={setGrantUserId} />
            <Field label="ระดับ">
              <TierPicker value={grantTier} onChange={setGrantTier} />
            </Field>
            <Field label="ระยะเวลา">
              <select value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value))} className={inputClass}>
                {DAY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <ErrorBox message={grantError} />
            <Button type="submit" icon="sparkles">ให้ VIP</Button>
          </form>
        </Card>

        <Card title="สร้างรหัส VIP" description="ส่งรหัสให้ผู้ใช้ไปกรอกเองที่ ตั้งค่าของฉัน > VIP">
          <form onSubmit={createCode} className="space-y-3">
            <Field label="ระดับ">
              <TierPicker value={codeTier} onChange={setCodeTier} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ระยะเวลา">
                <select value={codeDays} onChange={(e) => setCodeDays(Number(e.target.value))} className={inputClass}>
                  {DAY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="ใช้ได้กี่คน">
                <input type="number" min={1} max={1000} value={codeUses} onChange={(e) => setCodeUses(Number(e.target.value))} className={inputClass} />
              </Field>
            </div>
            <Field label="หมายเหตุ (ไม่บังคับ)">
              <input value={codeNote} onChange={(e) => setCodeNote(e.target.value)} maxLength={100} className={inputClass} placeholder="เช่น รางวัลกิจกรรมเดือนนี้" />
            </Field>
            <ErrorBox message={codeError} />
            <div className="flex items-center gap-3">
              <Button type="submit" icon="plus">สร้างและคัดลอก</Button>
              {copied && <span className="font-mono text-sm text-emerald-600">คัดลอก {copied} แล้ว</span>}
            </div>
          </form>
        </Card>
      </div>

      <Card title={'สมาชิก VIP (' + data.members.length + ')'} padding="none">
        {data.members.length === 0 ? (
          <p className="px-6 pb-5 text-sm text-slate-400">ยังไม่มีสมาชิก VIP</p>
        ) : (
          <div className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
            {data.members.map(member => {
              const left = daysLeft(member.vip.expiresAt);
              return (
                <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3.5">
                  <Avatar src={member.avatar} name={member.name} size="md" />
                  <div className="flex-1 min-w-[160px]">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {member.name}
                      <VipBadge user={member} />
                    </p>
                    <p className="text-xs text-slate-500">
                      {member.email} · ได้มาจาก{member.vip.source === 'code' ? 'รหัส' : 'ผู้ดูแลระบบ'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={'text-sm font-medium ' + daysLeftColor(left)}>เหลือ {left} วัน</p>
                    <p className="text-xs text-slate-500">ถึง {formatDate(member.vip.expiresAt)}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => revoke(member)}>ยกเลิก VIP</Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title={'รหัส VIP (' + data.codes.length + ')'} padding="none">
        {data.codes.length === 0 ? (
          <p className="px-6 pb-5 text-sm text-slate-400">ยังไม่มีรหัส</p>
        ) : (
          <div className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
            {data.codes.map(item => {
              const usedUp = item.usedBy.length >= item.maxUses;
              return (
                <div key={item.code} className={`flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3.5 ${usedUp ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-[200px]">
                    <p className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tracking-wider text-slate-900">{item.code}</span>
                      <VipBadge user={{ vip: { tier: item.tier } }} />
                      {usedUp && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">ใช้ครบแล้ว</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.days} วัน · ใช้ไป {item.usedBy.length}/{item.maxUses} · สร้างโดย {item.createdByName} · {formatDate(item.createdAt)}
                      {item.note ? ' · ' + item.note : ''}
                    </p>
                  </div>
                  {!usedUp && (
                    <Button variant="secondary" size="sm" icon={copied === item.code ? 'check' : 'copy'} onClick={() => copyCode(item.code)}>
                      {copied === item.code ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </Button>
                  )}
                  <IconButton icon="trash" title="ลบรหัส" size="sm" danger onClick={() => deleteCode(item.code)} />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
