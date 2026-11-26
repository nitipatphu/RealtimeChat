import Icon from '../ui/Icon';

export default function LoadOlderButton({ hasMore, loading, onClick }) {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center my-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        <Icon name="refresh" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'กำลังโหลด...' : 'โหลดข้อความเก่ากว่านี้'}
      </button>
    </div>
  );
}
