import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { ErrorBox, inputClass } from '../ui/Form';
import { TierBadge } from '../ui/Badge';
import { getVipTier, getTierInfo, getTierList, VIP_THEMES, NO_TIER, tierGradient } from '../../utils/vip';
import { formatDate } from '../../utils/format';

function themeNames(list) {
  if (list.length === 0) return '–';
  return VIP_THEMES.filter(t => list.includes(t.id)).map(t => t.label).join(', ');
}

function perkText(tier, key) {
  const isBasic = tier.id === NO_TIER;
  if (key === 'badge') {
    if (isBasic) return '–';
    return tier.icon + ' ' + tier.name;
  }
  if (key === 'nameColor') {
    if (isBasic) return '–';
    return 'มี';
  }
  if (key === 'file') return tier.fileMB + ' MB';
  if (key === 'themes') return themeNames(tier.presetThemes);
  if (tier.customTheme) return '✓';
  return '–';
}

const PERK_ROWS = [
  { key: 'badge', label: 'ป้ายข้างชื่อ' },
  { key: 'nameColor', label: 'สีชื่อพิเศษ' },
  { key: 'file', label: 'ขนาดไฟล์แนบ' },
  { key: 'themes', label: 'ธีมสำเร็จรูป' },
  { key: 'custom', label: 'ออกแบบธีมเอง' }
];

export default function VipTab({ currentUser, onUserUpdated }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const tier = getVipTier(currentUser);
  const vip = currentUser.vip;

  let daysLeft = 0;
  if (tier && vip.expiresAt) {
    daysLeft = Math.ceil((new Date(vip.expiresAt).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
  }

  const redeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await apiSend('POST', '/users/redeem-vip', { code: code });
      setMessage(data.message);
      setCode('');
      onUserUpdated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  let cardStyle = { backgroundImage: tierGradient('#64748b') };
  let cardIcon = <Icon name="star" className="w-7 h-7" />;
  let tierName = 'ผู้ใช้ทั่วไป';
  if (tier) {
    const info = getTierInfo(tier);
    cardStyle = { backgroundImage: tierGradient(info.color) };
    cardIcon = info.icon || '💎';
    tierName = info.name;
  }
  const tiers = getTierList();
  const myTierId = tier || NO_TIER;

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6 text-white shadow-lg"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">สถานะของคุณ</p>
            <p className="text-3xl font-bold mt-1 flex items-center gap-2">
              {cardIcon}
              {tierName}
            </p>
            {tier ? (
              <p className="text-sm text-white/90 mt-2">
                ใช้ได้ถึง {formatDate(vip.expiresAt)} · เหลืออีก {daysLeft} วัน
              </p>
            ) : (
              <p className="text-sm text-white/90 mt-2">กรอกรหัส VIP ด้านล่าง หรือติดต่อผู้ดูแลระบบเพื่อรับ VIP</p>
            )}
          </div>
          {tier && (
            <span className="hidden sm:block rounded-xl bg-white/15 px-3 py-2 text-right text-xs text-white/90">
              เป็นสมาชิกตั้งแต่
              <span className="block text-sm font-semibold text-white">{formatDate(vip.since)}</span>
            </span>
          )}
        </div>
        {tier && daysLeft <= 3 && (
          <p className="mt-4 rounded-lg bg-white/20 px-3 py-2 text-sm">⚠️ ใกล้หมดอายุแล้ว กรอกรหัสใหม่เพื่อต่ออายุได้เลย</p>
        )}
      </div>

      <Card title="กรอกรหัส VIP" description="ถ้าเป็นระดับเดียวกับที่มีอยู่ จะต่อวันหมดอายุออกไป ถ้าเป็นระดับสูงกว่าจะอัปเกรดทันที">
        <form onSubmit={redeem} className="flex flex-col sm:flex-row gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VIP-XXXX-XXXX"
            className={inputClass + ' font-mono tracking-wider'}
          />
          <Button type="submit" icon="sparkles" disabled={saving || !code.trim()}>{saving ? 'กำลังตรวจสอบ...' : 'ใช้รหัส'}</Button>
        </form>
        <ErrorBox message={error} />
        {message && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <Icon name="check" className="w-4 h-4" />
            {message}
          </p>
        )}
      </Card>

      <Card title="สิทธิพิเศษ" padding="none">
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-left">
                <th className="px-4 sm:px-6 py-2.5 font-medium text-slate-500">สิทธิ์</th>
                {tiers.map(item => (
                  <th key={item.id} className="px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">
                    {item.id === NO_TIER ? item.name : <TierBadge tierId={item.id} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERK_ROWS.map(perk => (
                <tr key={perk.key}>
                  <td className="px-4 sm:px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{perk.label}</td>
                  {tiers.map(item => (
                    <td key={item.id} className={`px-3 py-3 ${item.id === myTierId ? 'text-slate-900 font-semibold bg-indigo-50/50' : 'text-slate-600'}`}>
                      {perkText(item, perk.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
