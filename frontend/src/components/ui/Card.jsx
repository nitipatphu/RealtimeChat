import Icon from './Icon';

export default function Card({ title, description, action, children, className, padding }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-2xl ${className || ''}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padding === 'none' ? '' : 'p-6'}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, icon, hint, tone }) {
  let iconBox = 'bg-indigo-50 text-indigo-600';
  if (tone === 'amber') iconBox = 'bg-amber-50 text-amber-600';
  if (tone === 'emerald') iconBox = 'bg-emerald-50 text-emerald-600';
  if (tone === 'red') iconBox = 'bg-red-50 text-red-600';
  if (tone === 'slate') iconBox = 'bg-slate-100 text-slate-600';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        {icon && (
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBox}`}>
            <Icon name={icon} className="w-5 h-5" />
          </span>
        )}
      </div>
      <p className="text-3xl font-semibold text-slate-900 mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <span className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
        <Icon name={icon || 'sparkles'} className="w-6 h-6" />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {text && <p className="text-sm text-slate-500 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-3 h-10 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
            value === tab.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {tab.icon && <Icon name={tab.icon} className="w-4 h-4" />}
          {tab.label}
          {tab.count > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
