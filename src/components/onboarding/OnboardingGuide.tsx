import { useState } from 'react';
import { useAuthStore } from '../../store/auth-store';
import { OnboardingModal } from './OnboardingModal';

const ONBOARDED_PREFIX = 'virtugene:onboarded:';

interface GuideTipProps {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  arrow: 'left' | 'top';
  step: string;
  title: string;
  desc: string;
  onClose: () => void;
}

function GuideTip({ top, bottom, left, right, arrow, step, title, desc, onClose }: GuideTipProps) {
  return (
    <div className="fixed z-[55] animate-fade-in" style={{ top, bottom, left, right }}>
      <div className="relative w-72 rounded-xl border border-gene-purple/30 bg-panel/95 backdrop-blur-xl shadow-xl p-4">
        {arrow === 'left' && (
          <span className="absolute top-1/2 -left-[7px] -translate-y-1/2 w-3.5 h-3.5 rotate-45 bg-panel/95 border-l border-b border-gene-purple/30" />
        )}
        {arrow === 'top' && (
          <span className="absolute -top-[7px] right-6 w-3.5 h-3.5 rotate-45 bg-panel/95 border-l border-t border-gene-purple/30" />
        )}
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none">🧬</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-xs text-gray-500 leading-relaxed mt-1.5">{desc}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[11px] text-gray-500">{step}</span>
          <button
            onClick={onClose}
            className="text-xs font-medium text-gene-purple hover:text-[#5B4BD4] transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingGuide() {
  const userId = useAuthStore((s) => s.userId) ?? '';
  const onboardedKey = ONBOARDED_PREFIX + userId;
  const [showWelcome, setShowWelcome] = useState(() => userId !== '' && localStorage.getItem(onboardedKey) == null);
  const [tipStep, setTipStep] = useState<0 | 1 | 2>(0);

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem(onboardedKey, '1');
    setTipStep(1);
  };

  return (
    <>
      <OnboardingModal open={showWelcome} onClose={closeWelcome} />

      {tipStep === 1 && (
        <GuideTip
          left={252}
          bottom={168}
          arrow="left"
          step="1 / 2"
          title="基因实验室"
          desc="点这里的「基因实验室」，从「基因库」挑选现成角色，或「创造基因」培育属于你的独特灵魂。"
          onClose={() => setTipStep(2)}
        />
      )}

      {tipStep === 2 && (
        <GuideTip
          right={16}
          top={92}
          arrow="top"
          step="2 / 2"
          title="查看 Ta 的情绪与关系"
          desc="点这里看 Ta 的情绪图谱、心情曲线，以及你们的好感度关系进展。"
          onClose={() => setTipStep(0)}
        />
      )}
    </>
  );
}
