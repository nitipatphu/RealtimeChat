import { useEffect, useRef } from 'react';

const MAX_PAGES = 20;

function highlightMessage(messageId) {
  const element = document.getElementById('msg-' + messageId);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.add('ring-2', 'ring-amber-400');
  setTimeout(() => {
    element.classList.remove('ring-2', 'ring-amber-400');
  }, 2500);
}

export default function useJumpToMessage({ focusId, ready, messages, hasMore, loadingOlder, loadOlder, onOpenThread }) {
  const finishedId = useRef(null);
  const pageCount = useRef(0);

  useEffect(() => {
    if (!focusId || !ready) return;
    if (finishedId.current === focusId) return;

    const found = messages.find(m => m.id === focusId);

    if (found) {
      finishedId.current = focusId;
      pageCount.current = 0;
      if (found.parentId) {
        onOpenThread(found.parentId);
        setTimeout(() => highlightMessage(found.parentId), 150);
      } else {
        setTimeout(() => highlightMessage(found.id), 150);
      }
      return;
    }

    if (loadingOlder) return;

    if (hasMore && pageCount.current < MAX_PAGES) {
      pageCount.current = pageCount.current + 1;
      loadOlder();
    } else {
      finishedId.current = focusId;
      pageCount.current = 0;
    }
  }, [focusId, ready, messages, hasMore, loadingOlder, loadOlder, onOpenThread]);
}
