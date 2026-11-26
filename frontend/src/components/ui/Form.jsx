export const inputBaseClass =
  'rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 transition';

export const inputClass = inputBaseClass + ' w-full h-10';

export const textareaClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 resize-none transition';

export function Field({ label, hint, children, error }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-slate-400 mt-1.5">{hint}</span>}
      {error && <span className="block text-xs text-red-600 mt-1.5">{error}</span>}
    </label>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{message}</p>
  );
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex p-1 bg-slate-100 rounded-lg">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-3 h-8 text-sm rounded-md font-medium transition-colors ${
            value === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
