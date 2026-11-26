import { getVipTier, getTierInfo, tierGradient } from '../../utils/vip';
const TONES = {
  slate: 'bg-slate-100 text-slate-600',
  indigo: 'bg-indigo-50 text-indigo-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700'
};

export default function Badge({ tone, children, className }) {
  return (
    <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium whitespace-nowrap ${TONES[tone || 'slate']} ${className || ''}`}>
      {children}
    </span>
  );
}

export function RoleBadge({ role }) {
  if (!role) return null;
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-xs font-medium bg-slate-100 text-slate-700 whitespace-nowrap">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color || '#64748b' }} />
      {role.name}
    </span>
  );
}

export function SystemRoleBadge({ systemRole }) {
  if (systemRole === 'administrator') return <Badge tone="red">Administrator</Badge>;
  if (systemRole === 'staff') return <Badge tone="blue">Staff</Badge>;
  return <Badge tone="slate">Member</Badge>;
}

export function VipBadge({ user, size }) {
  const tier = getVipTier(user);
  if (!tier) return null;
  const info = getTierInfo(tier);
  const icon = info.icon || '💎';

  if (size === 'icon') {
    return (
      <span title={info.name} className="shrink-0 text-[13px] leading-none">
        {icon}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[11px] font-bold tracking-wide text-white"
      style={{ backgroundImage: tierGradient(info.color) }}
    >
      {icon} {info.name}
    </span>
  );
}

export function TierBadge({ tierId }) {
  const info = getTierInfo(tierId);
  return (
    <span
      className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[11px] font-bold tracking-wide text-white whitespace-nowrap"
      style={{ backgroundImage: tierGradient(info.color) }}
    >
      {info.icon} {info.name}
    </span>
  );
}

export function VisibilityBadge({ visibility }) {
  if (visibility === 'public') return <Badge tone="emerald">Public</Badge>;
  return <Badge tone="slate">Private</Badge>;
}

