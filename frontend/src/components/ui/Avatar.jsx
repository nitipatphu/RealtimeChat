const SIZES = {
  xs: 'w-5 h-5',
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
  xl: 'w-20 h-20',
  '2xl': 'w-24 h-24'
};

const DOT_SIZES = {
  xs: 'w-2.5 h-2.5 border',
  sm: 'w-3 h-3 border-2',
  md: 'w-3.5 h-3.5 border-2',
  lg: 'w-4 h-4 border-2',
  xl: 'w-6 h-6 border-[3px]',
  '2xl': 'w-7 h-7 border-[4px]'
};

const DOT_COLORS = {
  online: 'bg-emerald-500',
  busy: 'bg-red-500',
  sleep: 'bg-amber-400',
  offline: 'bg-slate-400'
};

export function StatusDot({ status, className }) {
  const color = DOT_COLORS[status] || DOT_COLORS.offline;

  return (
    <span className={`relative inline-block rounded-full overflow-hidden shrink-0 ${color} ${className || 'w-3 h-3'}`}>
      {status === 'busy' && (
        <span className="absolute left-[22%] right-[22%] top-1/2 -translate-y-1/2 h-[24%] rounded-full bg-white" />
      )}
      {status === 'sleep' && (
        <span className="absolute -top-[12%] -left-[12%] w-[68%] h-[68%] rounded-full bg-white" />
      )}
      {(status === 'offline' || !DOT_COLORS[status]) && (
        <span className="absolute inset-[28%] rounded-full bg-white" />
      )}
    </span>
  );
}

export default function Avatar({ src, name, size, status, className }) {
  const sizeKey = size || 'md';
  const fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || 'U') + '&background=random';

  return (
    <span className={`relative inline-block shrink-0 ${className || ''}`}>
      <img
        src={src || fallback}
        alt={name || ''}
        className={`${SIZES[sizeKey]} rounded-full object-cover bg-slate-200`}
      />
      {status && (
        <span className="absolute -bottom-0.5 -right-0.5 flex">
          <StatusDot status={status} className={`border-white ${DOT_SIZES[sizeKey]}`} />
        </span>
      )}
    </span>
  );
}

export function GroupAvatar({ group, size }) {
  let sizeClass = 'w-10 h-10 text-sm rounded-xl';
  if (size === 'lg') sizeClass = 'w-12 h-12 text-lg rounded-2xl';
  if (size === 'sm') sizeClass = 'w-8 h-8 text-xs rounded-lg';
  let name = 'G';
  let color = '#6366f1';
  if (group && group.name) name = group.name;
  if (group && group.color) color = group.color;

  if (group && group.icon) {
    return <img src={group.icon} alt={name} className={`shrink-0 object-cover bg-slate-200 ${sizeClass}`} />;
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 font-bold text-white ${sizeClass}`}
      style={{ backgroundColor: color }}
    >
      {name.substring(0, 2).toUpperCase()}
    </span>
  );
}
