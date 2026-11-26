import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { ErrorBox, SegmentedControl } from '../ui/Form';
import { getPerks, mixColor } from '../../utils/vip';

const ACCENTS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6'];
const LIGHT_BACKGROUNDS = ['#f8fafc', '#fff7ed', '#fdf2f8', '#f0fdf4', '#eff6ff', '#faf5ff'];
const DARK_BACKGROUNDS = ['#0b101c', '#0c0a18', '#07121a', '#0a1410', '#1a0b12', '#111111'];

function Swatches({ colors, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.map(color => (
        <button
          key={color}
          type="button"
          title={color}
          onClick={() => onChange(color)}
          className={`w-8 h-8 rounded-full border-2 ${value === color ? 'border-slate-900 scale-110' : 'border-slate-200'} transition-transform`}
          style={{ backgroundColor: color }}
        />
      ))}
      <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer text-slate-500 hover:border-slate-400" title="เลือกสีเอง">
        <Icon name="palette" className="w-4 h-4" />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
      <span className="font-mono text-xs text-slate-500 uppercase">{value}</span>
    </div>
  );
}

function Preview({ accent, background, mode }) {
  const dark = mode === 'dark';
  const surface = dark ? mixColor(background, '#ffffff', 0.06) : mixColor(background, '#ffffff', 0.85);
  const line = dark ? mixColor(background, '#ffffff', 0.16) : mixColor(background, '#000000', 0.08);
  const text = dark ? '#eef1f5' : '#1e293b';
  const soft = dark ? mixColor(accent, background, 0.75) : mixColor(accent, '#ffffff', 0.88);

  return (
    <div className="rounded-xl overflow-hidden border" style={{ backgroundColor: background, borderColor: line }}>
      <div className="flex h-44">
        <div className="w-12 flex flex-col items-center gap-2 py-3" style={{ backgroundColor: surface, borderRight: '1px solid ' + line }}>
          <span className="w-7 h-7 rounded-lg" style={{ backgroundColor: accent }} />
          <span className="w-7 h-7 rounded-lg" style={{ backgroundColor: line }} />
        </div>
        <div className="w-32 p-2 space-y-1.5 hidden sm:block" style={{ backgroundColor: surface, borderRight: '1px solid ' + line }}>
          <div className="h-6 rounded-md px-2 flex items-center text-[11px] font-semibold" style={{ backgroundColor: soft, color: dark ? mixColor(accent, '#ffffff', 0.35) : mixColor(accent, '#000000', 0.15) }}># general</div>
          <div className="h-6 rounded-md px-2 flex items-center text-[11px]" style={{ color: text, opacity: 0.7 }}># frontend</div>
          <div className="h-6 rounded-md px-2 flex items-center text-[11px]" style={{ color: text, opacity: 0.7 }}># backend</div>
        </div>
        <div className="flex-1 p-3 flex flex-col">
          <div className="flex gap-2">
            <span className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold" style={{ color: text }}>Mint</p>
              <p className="text-[12px]" style={{ color: text, opacity: 0.8 }}>ธีมนี้สวยมาก 🎨</p>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-2 rounded-lg px-2 h-8 border" style={{ backgroundColor: surface, borderColor: line }}>
            <span className="flex-1 text-[11px]" style={{ color: text, opacity: 0.5 }}>พิมพ์ข้อความ...</span>
            <span className="w-6 h-6 rounded-md" style={{ backgroundColor: accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomThemeCard({ currentUser, isActive, onSaved, onGoVip }) {
  const saved = currentUser.customTheme || { accent: '#6366f1', background: '#f8fafc', mode: 'light' };
  const [mode, setMode] = useState(saved.mode);
  const [accent, setAccent] = useState(saved.accent);
  const [background, setBackground] = useState(saved.background);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const allowed = getPerks(currentUser).customTheme;

  const changeMode = (value) => {
    setMode(value);
    setBackground(value === 'dark' ? DARK_BACKGROUNDS[0] : LIGHT_BACKGROUNDS[0]);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await apiSend('PUT', '/users/' + currentUser.id + '/custom-theme', { accent: accent, background: background, mode: mode });
      onSaved(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <Card title="ธีมของฉัน" description="ออกแบบธีมเอง เลือกสีหลักและสีพื้นหลังได้ตามใจ">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl bg-gradient-to-r from-fuchsia-50 to-indigo-50 border border-indigo-100 p-4">
          <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shrink-0">
            <Icon name="lock" className="w-5 h-5" />
          </span>
          <p className="flex-1 text-sm text-slate-700">ฟีเจอร์นี้สำหรับสมาชิก VIP ขึ้นไป</p>
          <Button icon="sparkles" onClick={onGoVip}>ดูสิทธิ์ VIP</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="ธีมของฉัน"
      description="ออกแบบธีมเอง ดูตัวอย่างด้านขวา แล้วกดบันทึกเพื่อใช้งาน"
      action={isActive ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Icon name="check" className="w-4 h-4" />กำลังใช้อยู่</span> : null}
    >
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">โหมด</p>
            <SegmentedControl
              value={mode}
              onChange={changeMode}
              options={[
                { value: 'light', label: 'สว่าง' },
                { value: 'dark', label: 'มืด' }
              ]}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">สีหลัก</p>
            <Swatches colors={ACCENTS} value={accent} onChange={setAccent} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">สีพื้นหลัง</p>
            <Swatches colors={mode === 'dark' ? DARK_BACKGROUNDS : LIGHT_BACKGROUNDS} value={background} onChange={setBackground} />
          </div>
          <ErrorBox message={error} />
          <Button icon="check" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกและใช้ธีมนี้'}</Button>
        </div>
        <Preview accent={accent} background={background} mode={mode} />
      </div>
    </Card>
  );
}
