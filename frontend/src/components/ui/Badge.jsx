import { getVipTier, VIP_NAMES } from '../../utils/vip';
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
  const isSuper = tier === 'supervip';

  if (size === 'icon') {
    return (
      <span title={VIP_NAMES[tier]} className={`shrink-0 text-[13px] leading-none ${isSuper ? 'drop-shadow-[0_0_3px_rgba(245,158,11,0.6)]' : ''}`}>
        {isSuper ? '👑' : '💎'}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[11px] font-bold tracking-wide text-white ${
        isSuper ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-fuchsia-500 to-indigo-500'
      }`}
    >
      {isSuper ? '👑' : '💎'} {VIP_NAMES[tier]}
    </span>
  );
}

export function VisibilityBadge({ visibility }) {
  if (visibility === 'public') return <Badge tone="emerald">Public</Badge>;
  return <Badge tone="slate">Private</Badge>;
}

