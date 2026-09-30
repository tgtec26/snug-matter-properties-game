'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { Backdrop } from '@/components/ui';
import { SubstanceCard } from '@/components/overlays/BoardOverlay';
import { playSfx } from '@/game/audio';

/** 분리 결과: 얻은 물질 카드 + 방법 도장 */
export function ResultOverlay() {
  const phase = useGameStore(s => s.phase);
  const id = useGameStore(s => s.missionId);
  const stepIndex = useGameStore(s => s.stepIndex);
  const obtained = useGameStore(s => s.obtained);
  const next = useGameStore(s => s.next);
  const m = useDataStore(d => d.missions.find(x => x.id === id));
  const at = useRef(0);
  useEffect(() => { if (phase === 'result') { at.current = Date.now(); playSfx('success'); } }, [phase]);
  const go = () => { if (Date.now() - at.current > 900) next(); };
  useEffect(() => {
    if (phase !== 'result') return;
    const onKey = (e: KeyboardEvent) => { if (e.repeat) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (phase !== 'result' || !m) return null;
  const step = m.steps[stepIndex];
  return (
    <div className="absolute inset-0 pointer-events-auto" onClick={go}>
      <Backdrop name="bench" tone="linear-gradient(#5b4128,#8a6238)" />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 top-[120px] flex justify-center gap-6">
        {obtained.map(o => (
          <div key={o} className="w-[430px] rounded-3xl bg-white text-slate-900 px-8 py-6 shadow-2xl">
            <div className="text-[16px] font-bold text-emerald-600 mb-1">얻었다!</div>
            <SubstanceCard id={o} stamp={step.method} />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[50px] text-center text-[20px] text-white/80">탭하거나 Enter</div>
    </div>
  );
}
