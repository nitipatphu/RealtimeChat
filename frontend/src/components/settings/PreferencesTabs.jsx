import { useState } from 'react';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { Toggle } from '../ui/Form';
import { loadSettings, saveSettings, previewSound, SOUND_TYPES } from '../../settings';
import { VIP_THEMES, getTierName, canUseTheme, lowestTierFor } from '../../utils/vip';
import CustomThemeCard from './CustomThemeCard';

function ToggleRow({ title, desc, checked, onChange, extra }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {desc && <p className="text-sm text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

export function NotificationTab({ showSaved }) {
  const [settings, setSettings] = useState(loadSettings());
  const [permission, setPermission] = useState('Notification' in window ? Notification.permission : 'unsupported');

  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    showSaved();
  };

  const chooseSound = (soundId) => {
    update('soundType', soundId);
    previewSound(soundId, settings.volume, false);
  };

  const finishVolume = (value) => {
    update('volume', value);
    previewSound(settings.soundType, value, false);
  };

  const handleDesktopToggle = async (value) => {
    if (value && permission !== 'granted') {
      if (permission === 'unsupported') return;
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return;
    }
    update('desktop', value);
  };

  let desktopDesc = 'แสดงป๊อปอัปเมื่อคุณไม่ได้เปิดแท็บนี้อยู่';
  if (permission === 'unsupported') desktopDesc = 'เบราว์เซอร์นี้ไม่รองรับ';
  if (permission === 'denied') desktopDesc = 'เบราว์เซอร์บล็อกการแจ้งเตือนไว้ ต้องไปเปิดในการตั้งค่าเบราว์เซอร์';

  return (
    <div className="space-y-6">
      <Card title="แจ้งเตือนเมื่อ">
        <div className="divide-y divide-slate-100">
          <ToggleRow title="ข้อความส่วนตัว" desc="มีคนส่งข้อความส่วนตัวหาคุณ" checked={settings.notifyDm} onChange={(v) => update('notifyDm', v)} />
          <ToggleRow title="ถูกกล่าวถึง" desc="มีคนพิมพ์ @ชื่อของคุณ หรือ @everyone" checked={settings.notifyMention} onChange={(v) => update('notifyMention', v)} />
          <ToggleRow title="ทุกข้อความใน Channel และ Project" desc="เตือนทุกครั้งที่มีข้อความใหม่ในห้องที่ไม่ได้เปิดอยู่" checked={settings.notifyChannel} onChange={(v) => update('notifyChannel', v)} />
          <ToggleRow title="ได้รับมอบหมายงาน" desc="มีคนมอบหมายงานในบอร์ดให้คุณ" checked={settings.notifyTask} onChange={(v) => update('notifyTask', v)} />
        </div>
      </Card>

      <Card title="รูปแบบการแจ้งเตือน">
        <div className="divide-y divide-slate-100">
          <ToggleRow
            title="เสียงแจ้งเตือน"
            desc="เล่นเสียงเมื่อมีข้อความหรือการแจ้งเตือนใหม่ ถ้าถูกแท็กชื่อจะดัง 2 ครั้ง"
            checked={settings.sound}
            onChange={(v) => update('sound', v)}
          />
          {settings.sound && (
            <div className="py-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-800 mb-2">เลือกเสียง</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SOUND_TYPES.map(sound => {
                    const selected = settings.soundType === sound.id;
                    return (
                      <button
                        key={sound.id}
                        type="button"
                        onClick={() => chooseSound(sound.id)}
                        className={`h-11 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 ${
                          selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Icon name="bell" className="w-4 h-4" />
                        {sound.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-800">ความดัง</p>
                  <span className="text-sm text-slate-500 tabular-nums">{settings.volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.volume}
                  onChange={(e) => setSettings({ ...settings, volume: Number(e.target.value) })}
                  onPointerUp={(e) => finishVolume(Number(e.target.value))}
                  onKeyUp={(e) => finishVolume(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => previewSound(settings.soundType, settings.volume, false)} className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                  ทดลองเสียงข้อความใหม่
                </button>
                <button type="button" onClick={() => previewSound(settings.soundType, settings.volume, true)} className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                  ทดลองเสียงถูกแท็กชื่อ
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ChoiceCard({ selected, onClick, icon, label, preview }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border-2 p-3 transition-colors ${selected ? 'border-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}
    >
      {preview}
      <span className="flex items-center gap-2 mt-3 text-sm font-medium text-slate-800">
        {icon && <Icon name={icon} className="w-4 h-4" />}
        {label}
        {selected && <Icon name="check" className="w-4 h-4 text-indigo-600 ml-auto" />}
      </span>
    </button>
  );
}

export function AppearanceTab({ showSaved, currentUser, onGoVip, onUserUpdated }) {
  const [settings, setSettings] = useState(loadSettings());

  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    showSaved();
  };

  const lightPreview = (
    <div className="h-20 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-2 flex gap-1.5">
      <div className="w-5 rounded bg-white border border-[#e2e8f0]" />
      <div className="flex-1 rounded bg-white border border-[#e2e8f0] p-1.5 space-y-1">
        <div className="h-1.5 w-2/3 rounded bg-[#cbd5e1]" />
        <div className="h-1.5 w-1/2 rounded bg-[#6366f1]" />
      </div>
    </div>
  );
  const darkPreview = (
    <div className="h-20 rounded-lg bg-[#0b101c] border border-[#283247] p-2 flex gap-1.5">
      <div className="w-5 rounded bg-[#151b2b]" />
      <div className="flex-1 rounded bg-[#151b2b] p-1.5 space-y-1">
        <div className="h-1.5 w-2/3 rounded bg-[#3a465e]" />
        <div className="h-1.5 w-1/2 rounded bg-[#818cf8]" />
      </div>
    </div>
  );
  const systemPreview = (
    <div className="h-20 rounded-lg overflow-hidden flex border border-[#e2e8f0]">
      <div className="flex-1 bg-[#f8fafc]" />
      <div className="flex-1 bg-[#0b101c]" />
    </div>
  );

  const sizes = [
    { id: 'small', label: 'เล็ก', sample: 'text-sm' },
    { id: 'normal', label: 'ปกติ', sample: 'text-base' },
    { id: 'large', label: 'ใหญ่', sample: 'text-lg' }
  ];

  return (
    <div className="space-y-6">
      <Card title="ธีม" description="เลือกโทนสีของแอป">
        <div className="grid grid-cols-3 gap-3">
          <ChoiceCard selected={settings.theme === 'light'} onClick={() => update('theme', 'light')} icon="sun" label="สว่าง" preview={lightPreview} />
          <ChoiceCard selected={settings.theme === 'dark'} onClick={() => update('theme', 'dark')} icon="moon" label="มืด" preview={darkPreview} />
          <ChoiceCard selected={settings.theme === 'system'} onClick={() => update('theme', 'system')} icon="monitor" label="ตามระบบ" preview={systemPreview} />
        </div>
      </Card>

      <Card title="ธีมพิเศษ VIP" description="ธีมสีเฉพาะสมาชิก VIP">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {VIP_THEMES.map(theme => {
            const allowed = canUseTheme(currentUser, theme.id);
            const preview = (
              <div className="relative h-20 rounded-lg p-2 flex gap-1.5" style={{ backgroundColor: theme.colors[0] }}>
                <div className="w-5 rounded" style={{ backgroundColor: theme.colors[1] }} />
                <div className="flex-1 rounded p-1.5 space-y-1" style={{ backgroundColor: theme.colors[1] }}>
                  <div className="h-1.5 w-2/3 rounded" style={{ backgroundColor: theme.dark ? '#ffffff33' : '#0000001a' }} />
                  <div className="h-1.5 w-1/2 rounded" style={{ backgroundColor: theme.colors[2] }} />
                </div>
                {!allowed && (
                  <span className="absolute inset-0 rounded-lg bg-slate-900/40 flex items-center justify-center text-white">
                    <Icon name="lock" className="w-5 h-5" />
                  </span>
                )}
              </div>
            );
            return (
              <ChoiceCard
                key={theme.id}
                selected={settings.theme === theme.id && allowed}
                onClick={() => (allowed ? update('theme', theme.id) : onGoVip())}
                label={theme.label + (allowed || !lowestTierFor(theme.id) ? '' : ' · ' + getTierName(lowestTierFor(theme.id)))}
                preview={preview}
              />
            );
          })}
        </div>
      </Card>

      <CustomThemeCard
        key={currentUser.customTheme ? JSON.stringify(currentUser.customTheme) : 'new'}
        currentUser={currentUser}
        isActive={settings.theme === 'custom'}
        onGoVip={onGoVip}
        onSaved={(user) => {
          localStorage.setItem('user', JSON.stringify(user));
          onUserUpdated(user);
          update('theme', 'custom');
        }}
      />

      <Card title="ขนาดตัวอักษร" description="ปรับขนาดตัวอักษรและระยะห่างทั้งแอป">
        <div className="grid grid-cols-3 gap-3">
          {sizes.map(size => (
            <ChoiceCard
              key={size.id}
              selected={settings.fontSize === size.id}
              onClick={() => update('fontSize', size.id)}
              label={size.label}
              preview={<div className={`h-12 flex items-center justify-center rounded-lg bg-slate-50 text-slate-700 ${size.sample}`}>กขค Aa</div>}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
