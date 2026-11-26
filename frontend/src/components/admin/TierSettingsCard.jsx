import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { ErrorBox, Toggle, inputBaseClass } from '../ui/Form';
import { VIP_THEMES, TIER_NAMES, getTierSettings, setTierSettings } from '../../utils/vip';

const TIERS = ['none', 'vip', 'supervip'];

function copySettings(tiers) {
  return JSON.parse(JSON.stringify(tiers));
}

function tierIcon(tier) {
  if (tier === 'supervip') return '👑 ';
  if (tier === 'vip') return '💎 ';
  return '';
}

export default function TierSettingsCard({ canEdit, showSaved }) {
  const [tiers, setTiers] = useState(copySettings(getTierSettings()));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const change = (tier, key, value) => {
    setTiers({ ...tiers, [tier]: { ...tiers[tier], [key]: value } });
    setDirty(true);
  };

  const toggleTheme = (tier, themeId) => {
    const list = tiers[tier].presetThemes;
    const next = list.includes(themeId) ? list.filter(id => id !== themeId) : [...list, themeId];
    change(tier, 'presetThemes', next);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await apiSend('PUT', '/admin/vip-settings', { tiers: tiers });
      setTierSettings(data.tiers);
      setTiers(copySettings(data.tiers));
      setDirty(false);
      showSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setTiers(copySettings(getTierSettings()));
    setDirty(false);
    setError('');
  };

  const headClass = (tier) => {
    if (tier === 'supervip') return 'text-amber-600';
    if (tier === 'vip') return 'text-fuchsia-600';
    return 'text-slate-500';
  };

  return (
    <Card
      title="สิทธิ์ของแต่ละระดับ"
      description={canEdit ? 'มีผลกับผู้ใช้ทุกคนทันทีหลังบันทึก และถูกบันทึกใน Log ผู้ดูแลระบบ' : 'เฉพาะ Administrator เท่านั้นที่แก้ไขได้'}
      padding="none"
    >
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-left">
              <th className="px-4 sm:px-6 py-2.5 font-medium text-slate-500">สิทธิ์</th>
              {TIERS.map(tier => (
                <th key={tier} className={`px-3 py-2.5 font-semibold ${headClass(tier)}`}>
                  {tierIcon(tier)}{TIER_NAMES[tier]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 sm:px-6 py-3">
                <p className="font-medium text-slate-800">ขนาดไฟล์แนบสูงสุด</p>
                <p className="text-xs text-slate-500">1 ถึง 100 MB</p>
              </td>
              {TIERS.map(tier => (
                <td key={tier} className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      disabled={!canEdit}
                      value={tiers[tier].fileMB}
                      onChange={(e) => change(tier, 'fileMB', Number(e.target.value))}
                      className={inputBaseClass + ' w-20 h-9'}
                    />
                    <span className="text-slate-500">MB</span>
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 sm:px-6 py-3">
                <p className="font-medium text-slate-800">ธีมสำเร็จรูป</p>
                <p className="text-xs text-slate-500">เลือกได้หลายธีม</p>
              </td>
              {TIERS.map(tier => (
                <td key={tier} className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {VIP_THEMES.map(theme => {
                      const on = tiers[tier].presetThemes.includes(theme.id);
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => toggleTheme(tier, theme.id)}
                          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium disabled:cursor-default ${
                            on ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-400'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors[2] }} />
                          {theme.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 sm:px-6 py-3">
                <p className="font-medium text-slate-800">ออกแบบธีมเอง</p>
                <p className="text-xs text-slate-500">เลือกสีหลักและพื้นหลังเอง</p>
              </td>
              {TIERS.map(tier => (
                <td key={tier} className="px-3 py-3">
                  <Toggle checked={tiers[tier].customTheme} disabled={!canEdit} onChange={(value) => change(tier, 'customTheme', value)} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <Button icon="check" onClick={save} disabled={saving || !dirty}>{saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}</Button>
          {dirty && <Button variant="secondary" onClick={reset}>ยกเลิกการแก้ไข</Button>}
          <div className="w-full"><ErrorBox message={error} /></div>
        </div>
      )}
    </Card>
  );
}
