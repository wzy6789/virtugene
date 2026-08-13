import { useEffect, useRef } from 'react';
import { ChatWindow } from '../components/chat/ChatWindow';
import { EmotionPanel } from '../components/chat/EmotionPanel';
import { EmotionToggleButton } from '../components/chat/EmotionToggleButton';
import { useChatStore } from '../store/chat-store';
import { useAuthStore } from '../store/auth-store';
import { useEmotionStore } from '../store/emotion-store';
import { useCharacterStateStore } from '../store/character-state-store';

function useProactiveTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const triggerProactive = useChatStore((s) => s.triggerProactive);
  const fetchUnreadCounts = useChatStore((s) => s.fetchUnreadCounts);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Fetch unread counts on mount
    fetchUnreadCounts();

    const schedule = () => {
      // Random interval: 2-5 minutes for subsequent messages
      const delay = 120000 + Math.random() * 180000;
      timerRef.current = setTimeout(async () => {
        console.log('[proactive] timer fired, triggering...');
        await triggerProactive();
        schedule();
      }, delay);
    };

    // First trigger after 15-45 seconds
    const firstDelay = 15000 + Math.random() * 30000;
    console.log(`[proactive] first trigger in ${Math.round(firstDelay / 1000)}s`);
    timerRef.current = setTimeout(async () => {
      console.log('[proactive] first timer fired');
      await triggerProactive();
      schedule();
    }, firstDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoggedIn]);
}

export function ChatPage() {
  useProactiveTimer();

  const isPanelOpen = useEmotionStore((s) => s.isPanelOpen);
  const togglePanel = useEmotionStore((s) => s.togglePanel);
  const currentSnapshot = useEmotionStore((s) => s.currentSnapshot);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const loadSessionSnapshots = useEmotionStore((s) => s.loadSessionSnapshots);
  const clearCurrent = useEmotionStore((s) => s.clearCurrent);
  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const loadCharacterState = useCharacterStateStore((s) => s.load);

  // Load snapshots when session changes (if panel is open)
  useEffect(() => {
    clearCurrent();
    if (currentSessionId) {
      loadSessionSnapshots(currentSessionId);
    }
  }, [currentSessionId]);

  // Load character affinity/mood when selected character changes
  useEffect(() => {
    if (selectedCharacterId) {
      loadCharacterState(selectedCharacterId);
    }
  }, [selectedCharacterId, loadCharacterState]);

  const emotionToggle = (
    <EmotionToggleButton
      isOpen={isPanelOpen}
      hasData={currentSnapshot != null}
      valence={currentSnapshot?.dimensions.valence}
      onClick={togglePanel}
    />
  );

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <ChatWindow emotionToggle={emotionToggle} />
      </div>
      <EmotionPanel />
    </div>
  );
}
