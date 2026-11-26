import Icon from './Icon';

const VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  dangerSoft: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
  soft: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2'
};

export default function Button({ variant, size, icon, children, className, type, ...rest }) {
  const variantClass = VARIANTS[variant || 'primary'];
  const sizeClass = SIZES[size || 'md'];
  const iconClass = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';

  return (
    <button
      type={type || 'button'}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${variantClass} ${sizeClass} ${className || ''}`}
      {...rest}
    >
      {icon && <Icon name={icon} className={iconClass} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, title, onClick, className, active, danger, size }) {
  const box = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  let color = 'text-slate-500 hover:text-slate-800 hover:bg-slate-100';
  if (active) color = 'text-indigo-600 bg-indigo-50';
  if (danger) color = 'text-slate-500 hover:text-red-600 hover:bg-red-50';

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg transition-colors shrink-0 ${box} ${color} ${className || ''}`}
    >
      <Icon name={icon} className={iconSize} />
    </button>
  );
}
