import { useState } from 'react';
import { shortDay } from '../../utils/format';

export default function BarChart({ data, label, unit, height }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const chartHeight = height || 160;
  let maxValue = 0;
  data.forEach(item => {
    if (item.count > maxValue) maxValue = item.count;
  });
  if (maxValue < 2) maxValue = 2;
  if (maxValue % 2 === 1) maxValue = maxValue + 1;

  let total = 0;
  data.forEach(item => {
    total = total + item.count;
  });
  const middleValue = maxValue / 2;
  const labelStep = Math.ceil(data.length / 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          รวม <span className="font-semibold text-slate-900 tabular-nums">{total}</span> {unit}
        </p>
        <button type="button" onClick={() => setShowTable(!showTable)} className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2">
          {showTable ? 'ดูเป็นกราฟ' : 'ดูเป็นตาราง'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-medium px-3 py-2">วันที่</th>
                <th className="text-right font-medium px-3 py-2">{label}</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.date} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-600">{shortDay(item.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-900">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex flex-col justify-between text-[11px] text-slate-400 tabular-nums text-right w-6" style={{ height: chartHeight }}>
            <span>{maxValue}</span>
            <span>{middleValue}</span>
            <span>0</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative border-b border-slate-200" style={{ height: chartHeight }}>
              <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-100" />
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" />

              <div className="absolute inset-0 flex items-end gap-[2px]">
                {data.map((item, index) => {
                  const barHeight = (item.count / maxValue) * 100;
                  const isHover = hoverIndex === index;
                  return (
                    <div
                      key={item.date}
                      className="relative flex-1 h-full flex items-end justify-center cursor-default"
                      onMouseEnter={() => setHoverIndex(index)}
                      onMouseLeave={() => setHoverIndex(null)}
                    >
                      {isHover && <div className="absolute inset-0 bg-slate-100/70 rounded" />}
                      <div
                        className={`relative w-full max-w-7 rounded-t transition-colors ${isHover ? 'bg-indigo-700' : 'bg-indigo-500'}`}
                        style={{ height: item.count > 0 ? Math.max(barHeight, 2) + '%' : '0%' }}
                      />
                      {isHover && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg pointer-events-none">
                          <p className="text-slate-300">{shortDay(item.date)}</p>
                          <p className="font-semibold tabular-nums">{item.count} {unit}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-[2px] mt-1.5">
              {data.map((item, index) => {
                const showLabel = (data.length - 1 - index) % labelStep === 0;
                return (
                  <span key={item.date} className="flex-1 text-center text-[11px] text-slate-400 truncate">
                    {showLabel ? shortDay(item.date) : ''}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HorizontalBars({ items, unit }) {
  let maxValue = 0;
  items.forEach(item => {
    if (item.value > maxValue) maxValue = item.value;
  });
  if (maxValue === 0) maxValue = 1;

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} title={item.label + ': ' + item.value + ' ' + unit}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-700 truncate">{item.label}</span>
            <span className="text-slate-900 font-medium tabular-nums">{item.value}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: (item.value / maxValue) * 100 + '%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
