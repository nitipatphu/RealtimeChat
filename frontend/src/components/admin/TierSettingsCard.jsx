import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button, { IconButton } from '../ui/Button';
import Modal from '../ui/Modal';
import { TierBadge } from '../ui/Badge';
import { Field, ErrorBox, Toggle, inputClass } from '../ui/Form';
import { VIP_THEMES, NO_TIER, getTierList, setTierSettings, tierGradient } from '../../utils/vip';
import { showError, askConfirm } from '../../utils/dialog';

const ICON_CHOICES = ['💎', '👑', '⭐', '🔥', '🚀', '🌈', '🍀', '🦄', '🐉', '⚡', '🎖️', '🏆'];
const COLOR_CHOICES = ['#c026d3', '#f59e0b', '#6366f1', '#0ea5e9', '#10b981', '#ef4444', '#ec4899', '#64748b'];

function themeNames(list) {
  const names = VIP_THEMES.filter(theme => list.includes(theme.id)).map(theme => theme.label);
  if (names.length === 0) return '–';
  return names.join(', ');
}

function emptyTier() {
  return { name: '', icon: '⭐', color: '#6366f1', fileMB: 10, presetThemes: [], customTheme: false };
}

function TierFormModal({ tier, onClose, onSaved }) {
  const isNew = !tier;
  const isBasic = tier && tier.id === NO_TIER;
  const [form, setForm] = useState(tier ? { ...tier } : emptyTier());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const change = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  const toggleTheme = (themeId) => {
    let next = [...form.presetThemes, themeId];
    if (form.presetThemes.includes(themeId)) {
      next = form.presetThemes.filter(id => id !== themeId);
    }
    change('presetThemes', next);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name,
        icon: form.icon,
        color: form.color,
        fileMB: form.fileMB,
        presetThemes: form.presetThemes,
        customTheme: form.customTheme
      };
      let data;
      if (isNew) {
        data = await apiSend('POST', '/admin/vip-tiers', body);
      } else {
        data = await apiSend('PUT', '/admin/vip-tiers/' + tier.id, body);
      }
      onSaved(data.tiers);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  let title = 'แก้ไขระดับ ' + form.name;
  if (isNew) title = 'เพิ่มระดับ VIP ใหม่';

  return (
    <Modal
      title={title}
      description={isNew ? 'ระดับใหม่จะอยู่สูงสุด เลื่อนลำดับได้ทีหลัง' : 'มีผลกับผู้ใช้ทุกคนในระดับนี้ทันที'}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" form="tier-form" icon="check" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </>
      }
    >
      <form id="tier-form" onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">ตัวอย่าง:</span>
          <span
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs font-bold text-white"
            style={{ backgroundImage: tierGradient(form.color) }}
          >
            {form.icon} {form.name || 'ชื่อระดับ'}
          </span>
        </div>

        <Field label="ชื่อระดับ">
          <input value={form.name} onChange={(e) => change('name', e.target.value)} maxLength={30} className={inputClass} placeholder="เช่น GOLD, DIAMOND" autoFocus />
        </Field>

        {!isBasic && (
          <>
            <Field label="ไอคอน">
              <div className="flex flex-wrap gap-1.5">
                {ICON_CHOICES.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => change('icon', icon)}
                    className={`w-9 h-9 rounded-lg border-2 text-lg ${form.icon === icon ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="สี">
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_CHOICES.map(color => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onClick={() => change('color', color)}
                    className={`w-8 h-8 rounded-full border-2 ${form.color === color ? 'border-slate-900' : 'border-white'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input type="color" value={form.color} onChange={(e) => change('color', e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
              </div>
            </Field>
          </>
        )}

        <Field label="ขนาดไฟล์แนบสูงสุด (MB)" hint="1 ถึง 1000 MB">
          <input type="number" min={1} max={1000} value={form.fileMB} onChange={(e) => change('fileMB', Number(e.target.value))} className={inputClass} />
        </Field>

        <Field label="ธีมสำเร็จรูปที่ใช้ได้">
          <div className="flex flex-wrap gap-1.5">
            {VIP_THEMES.map(theme => {
              const on = form.presetThemes.includes(theme.id);
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => toggleTheme(theme.id)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium ${
                    on ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors[2] }} />
                  {theme.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">ออกแบบธีมเองได้</span>
          <Toggle checked={form.customTheme} onChange={(value) => change('customTheme', value)} />
        </div>

        <ErrorBox message={error} />
      </form>
    </Modal>
  );
}

export default function TierSettingsCard({ canEdit, showSaved }) {
  const [editing, setEditing] = useState(null);

  const tiers = getTierList();
  const vipTiers = tiers.filter(tier => tier.id !== NO_TIER);

  const applyTiers = (next) => {
    setTierSettings(next);
    showSaved();
  };

  const handleSaved = (next) => {
    applyTiers(next);
    setEditing(null);
  };

  const move = async (tier, direction) => {
    try {
      const data = await apiSend('PUT', '/admin/vip-tiers/' + tier.id + '/move', { direction: direction });
      applyTiers(data.tiers);
    } catch (err) {
      showError(err.message);
    }
  };

  const remove = async (tier) => {
    const confirmed = await askConfirm('ลบระดับ ' + tier.name + '? รหัส VIP ของระดับนี้จะถูกลบด้วย');
    if (!confirmed) return;
    try {
      const data = await apiSend('DELETE', '/admin/vip-tiers/' + tier.id);
      applyTiers(data.tiers);
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <Card
      title="ระดับ VIP"
      description={canEdit ? 'เพิ่มระดับใหม่ แก้สิทธิ์ เรียงลำดับ หรือลบได้ มีผลกับผู้ใช้ทันที' : 'เฉพาะ Administrator เท่านั้นที่แก้ไขได้'}
      action={canEdit ? <Button size="sm" icon="plus" onClick={() => setEditing('new')}>เพิ่มระดับ VIP</Button> : null}
      padding="none"
    >
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-slate-500">
              <th className="px-4 sm:px-6 py-2.5 font-medium">ระดับ</th>
              <th className="px-3 py-2.5 font-medium">ไฟล์แนบ</th>
              <th className="px-3 py-2.5 font-medium">ธีมสำเร็จรูป</th>
              <th className="px-3 py-2.5 font-medium">ธีมเอง</th>
              {canEdit && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...tiers].reverse().map(tier => {
              const isBasic = tier.id === NO_TIER;
              const position = vipTiers.findIndex(item => item.id === tier.id);
              return (
                <tr key={tier.id}>
                  <td className="px-4 sm:px-6 py-3">
                    {isBasic ? <span className="font-medium text-slate-600">{tier.name}</span> : <TierBadge tierId={tier.id} />}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-800">{tier.fileMB} MB</td>
                  <td className="px-3 py-3 text-slate-600">{themeNames(tier.presetThemes)}</td>
                  <td className="px-3 py-3 text-slate-600">{tier.customTheme ? '✓' : '–'}</td>
                  {canEdit && (
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!isBasic && (
                          <>
                            <button type="button" title="เลื่อนขึ้น" disabled={position === vipTiers.length - 1} onClick={() => move(tier, 'up')} className="w-7 h-7 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30">▲</button>
                            <button type="button" title="เลื่อนลง" disabled={position === 0} onClick={() => move(tier, 'down')} className="w-7 h-7 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30">▼</button>
                          </>
                        )}
                        <IconButton icon="pencil" title="แก้ไข" size="sm" onClick={() => setEditing(tier)} />
                        {!isBasic && <IconButton icon="trash" title="ลบระดับ" size="sm" danger onClick={() => remove(tier)} />}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 sm:px-6 py-3 text-xs text-slate-400 border-t border-slate-100">เรียงจากระดับสูงสุดลงมา ผู้ใช้ระดับสูงใช้รหัสของระดับที่ต่ำกว่าไม่ได้จนกว่าจะหมดอายุ</p>

      {editing && (
        <TierFormModal
          tier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </Card>
  );
}
