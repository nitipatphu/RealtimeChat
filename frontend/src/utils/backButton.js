import { useState, useEffect } from 'react';

let openPanels = [];
let openCount = 0;

export function useCloseOnBack(onClose) {
  const [openOrder] = useState(() => {
    openCount = openCount + 1;
    return openCount;
  });

  useEffect(() => {
    const panel = { order: openOrder, close: onClose };
    openPanels.push(panel);
    return () => {
      openPanels = openPanels.filter(p => p !== panel);
    };
  }, [openOrder, onClose]);
}

export function closeTopPanel() {
  if (openPanels.length === 0) return false;
  let top = openPanels[0];
  openPanels.forEach(panel => {
    if (panel.order > top.order) top = panel;
  });
  top.close();
  return true;
}
