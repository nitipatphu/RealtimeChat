import { useRef, useEffect } from 'react';

export default function useChatScroll(lastId, lastAuthorId, currentUserId, roomId) {
  const scrollRef = useRef(null);
  const isNearBottom = useRef(true);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    isFirstLoad.current = true;
    isNearBottom.current = true;
  }, [roomId]);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !lastId) return;

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      box.scrollTop = box.scrollHeight;
      return;
    }

    if (isNearBottom.current || lastAuthorId === currentUserId) {
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }
  }, [lastId, lastAuthorId, currentUserId]);

  const handleScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    const spaceBelow = box.scrollHeight - box.scrollTop - box.clientHeight;
    isNearBottom.current = spaceBelow < 150;
  };

  const rememberPosition = () => {
    const box = scrollRef.current;
    if (!box) return;
    const spaceBelow = box.scrollHeight - box.scrollTop;
    setTimeout(() => {
      box.scrollTop = box.scrollHeight - spaceBelow;
    }, 0);
  };

  return { scrollRef, handleScroll, rememberPosition };
}
