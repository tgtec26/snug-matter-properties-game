'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/game/store';
import { enterFullscreen } from '@/components/TopControls';
import { AssetImg } from '@/components/ui';

/** 첫 터치(시작)가 곧 전체 화면 전환 */
export function TitleOverlay() {
  const phase = useGameStore(s => s.phase);
  const start = useGameStore(s => s.start);
  const go = () => { enterFullscreen(); start(); };
  useEffect(() => {
    if (phase !== 'title') return;
    const onKey = (e: KeyboardEvent) => { if (e.repeat) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (phase !== 'title') return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto cursor-pointer select-none" onClick={go}
      style={{ background: 'linear-gradient(160deg,#3b2a1a,#7a5230 60%,#c98a46)' }}>
      <AssetImg src="/assets/bg/board.webp" className="absolute inset-0 w-full h-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative flex flex-col items-center">
        <AssetImg src="/assets/npc/apprentice.webp" className="w-[190px] h-[190px] rounded-full border-[6px] border-amber-200 object-cover mb-4 shadow-2xl" />
        <div className="text-[22px] text-amber-300 tracking-widest mb-2">중2 과학 · 물질의 특성</div>
        <h1 className="text-[84px] font-black text-white mb-8 drop-shadow-lg">물질 분리 공방</h1>
        <button className="text-[30px] px-14 py-4 rounded-2xl bg-amber-500 text-black font-black animate-pulse">시작하기</button>
        <div className="text-[15px] text-white/60 mt-6">화면을 터치하거나 Enter</div>
      </div>
    </div>
  );
}
