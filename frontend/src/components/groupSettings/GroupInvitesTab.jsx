import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button, { IconButton } from '../ui/Button';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { Field, ErrorBox, inputClass } from '../ui/Form';
import { hasPermission } from '../../utils/permissions';
import { formatDateTime } from '../../utils/format';
import { copyText } from '../../utils/clipboard';
import { showError } from '../../utils/dialog';

const EXPIRE_OPTIONS = [
  { value: 30, label: '30 นาที' },
  { value: 60, label: '1 ชั่วโมง' },
  { value: 6 * 60, label: '6 ชั่วโมง' },
  { value: 24 * 60, label: '1 วัน' },
  { value: 7 * 24 * 60, label: '7 วัน' },
  { value: 0, label: 'ไม่หมดอายุ' }
];

const USE_OPTIONS = [
  { value: 0, label: 'ไม่จำกัด' },
  { value: 1, label: '1 คน' },
  { value: 5, label: '5 คน' },
  { value: 10, label: '10 คน' },
  { value: 25, label: '25 คน' },
  { value: 50, label: '50 คน' },
  { value: 100, label: '100 คน' }
];

function makeLink(code) {
  return window.location.origin + '/?invite=' + code;
}

function inviteStatus(invite) {
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return 'หมดอายุแล้ว';
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return 'ใช้ครบแล้ว';
  return '';
}

export default function GroupInvitesTab({ group, currentUser, users, readOnly }) {
  const [expires, setExpires] = useState(7 * 24 * 60);
  const [maxUses, setMaxUses] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const canCreate = !readOnly && hasPermission(group, currentUser.id, 'create_invites');
  const canManageAll = !readOnly && hasPermission(group, currentUser.id, 'manage_group');
  const invites = group.invites || [];

  const copy = (code) => {
    copyText(makeLink(code));
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 1500);
  };

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      const invite = await apiSend('POST', '/groups/' + group.id + '/invites', { expiresInMinutes: expires, maxUses: maxUses });
      copy(invite.code);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (code) => {
    try {
      await apiSend('DELETE', '/groups/' + group.id + '/invites/' + code);
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {canCreate && (
        <Card title="สร้างลิงก์เชิญ" description="เพื่อนกดลิงก์แล้วเข้ากลุ่มได้ทันทีหลังเข้าสู่ระบบ หรือจะพิมพ์รหัสในหน้าแรกก็ได้">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="หมดอายุใน">
              <select value={expires} onChange={(e) => setExpires(Number(e.target.value))} className={inputClass}>
                {EXPIRE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="ใช้ได้สูงสุด">
              <select value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className={inputClass}>
                {USE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button icon="plus" onClick={create} disabled={saving}>สร้างและคัดลอกลิงก์</Button>
            {copiedCode && <span className="text-sm text-emerald-600">คัดลอกลิงก์แล้ว</span>}
          </div>
          <ErrorBox message={error} />
        </Card>
      )}

      <Card title={'ลิงก์เชิญทั้งหมด (' + invites.length + ')'} description="รหัสเชิญหลักของกลุ่มอยู่ที่หน้าภาพรวม และใช้ได้ตลอด" padding="none">
        {invites.length === 0 ? (
          <p className="px-6 pb-5 text-sm text-slate-400">ยังไม่มีลิงก์เชิญ</p>
        ) : (
          <div className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
            {invites.map(invite => {
              const creator = (users || []).find(u => u.id === invite.createdBy);
              const status = inviteStatus(invite);
              const canDelete = !readOnly && (invite.createdBy === currentUser.id || canManageAll);
              return (
                <div key={invite.code} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-3.5 ${status ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-[200px]">
                    <p className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tracking-wider text-slate-900">{invite.code}</span>
                      {status && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{status}</span>}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      {creator && <Avatar src={creator.avatar} name={creator.name} size="xs" />}
                      {creator ? creator.name : '-'} ·
                      <Icon name="users" className="w-3.5 h-3.5" />
                      ใช้ไป {invite.uses || 0}{invite.maxUses > 0 ? '/' + invite.maxUses : ''} ·
                      <Icon name="clock" className="w-3.5 h-3.5" />
                      {invite.expiresAt ? 'หมดอายุ ' + formatDateTime(invite.expiresAt) : 'ไม่หมดอายุ'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!status && (
                      <Button variant="secondary" size="sm" icon={copiedCode === invite.code ? 'check' : 'copy'} onClick={() => copy(invite.code)}>
                        {copiedCode === invite.code ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                      </Button>
                    )}
                    {canDelete && <IconButton icon="trash" title="ลบลิงก์นี้" size="sm" danger onClick={() => remove(invite.code)} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
