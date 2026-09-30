'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/store';
import { loadDex } from '@/game/dex';
import { playSfx } from '@/game/audio';
import { CardFace } from '@/components/CardFace';
import { CollectionBook, SLOT_CARD_W, slotCenter, useDexList } from '@/components/CollectionBook';

const BIG_W = 300;
const CENTER = { x: 640, y: 380 };
const POP_MS = 1500;
const FLY_MS = 900;

/** 분리 결과: 얻은 물질 카드가 크게 나타났다가 컬렉션 북의 빈 칸에 끼워진다 */
export function ResultOverlay() {
  const phase = useGameStore(s => s.phase);
  const obtained = useGameStore(s => s.obtained);
  if (phase !== 'result') return null;
  return <Result key={obtained.join(',')} obtained={obtained} />;
}

function Result({ obtained }: { obtained: string[] }) {
  const next = useGameStore(s => s.next);
  const list = useDexList();
  const [dex] = useState(() => loadDex());
  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState<'pop' | 'fly' | 'placed'>('pop');
  const at = useRef(0);
  const finished = idx >= obtained.length - 1 && stage === 'placed';

  useEffect(() => { at.current = Date.now(); }, []);
  useEffect(() => {
    if (stage === 'pop') {
      playSfx('success');
      const t = setTimeout(() => setStage('fly'), POP_MS);
      return () => clearTimeout(t);
    }
    if (stage === 'fly') {
      const t = setTimeout(() => { playSfx('correct'); setStage('placed'); }, FLY_MS);
      return () => clearTimeout(t);
    }
    if (idx < obtained.length - 1) {
      const t = setTimeout(() => { setIdx(idx + 1); setStage('pop'); }, 700);
      return () => clearTimeout(t);
    }
  }, [stage, idx, obtained.length]);

  const go = () => { if (finished && Date.now() - at.current > 900) next(); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.repeat) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 아직 꽂히지 않은 카드는 책에서 뺀다
  const pending = obtained.filter((_, i) => i > idx || (i === idx && stage !== 'placed'));
  const filled = dex.known.filter(k => !pending.includes(k));
  const id = obtained[idx];
  const slotI = list.findIndex(x => x.id === id);
  const sc = slotI >= 0 ? slotCenter(slotI) : CENTER;
  const stamp = dex.stamps[id];
  const flying = stage !== 'pop';
  const scale = SLOT_CARD_W / BIG_W;

  return (
    <div className="absolute inset-0 pointer-events-auto overflow-hidden" onClick={go}>
      <CollectionBook filled={filled} stamps={dex.stamps} />
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-500" style={{ background: 'rgba(10,8,4,.62)', opacity: stage === 'pop' ? 1 : 0 }} />
      {stage !== 'placed' && (
        <div className="absolute pointer-events-none" style={{
          left: CENTER.x - BIG_W / 2, top: CENTER.y - (BIG_W * 1.4) / 2, width: BIG_W, height: BIG_W * 1.4, zIndex: 20,
          transform: flying ? `translate(${sc.x - CENTER.x}px, ${sc.y - CENTER.y}px) scale(${scale})` : undefined,
          transition: flying ? `transform ${FLY_MS}ms cubic-bezier(.5,0,.3,1)` : undefined,
          animation: flying ? undefined : `cardpop ${POP_MS}ms cubic-bezier(.2,1.3,.4,1) both`,
        }}>
          <CardFace id={id} w={BIG_W} stamp={stamp} />
        </div>
      )}
      {stage === 'placed' && slotI >= 0 && (
        <div className="absolute pointer-events-none rounded-2xl" style={{ left: sc.x - SLOT_CARD_W / 2 - 6, top: sc.y - (SLOT_CARD_W * 1.4) / 2 - 6, width: SLOT_CARD_W + 12, height: SLOT_CARD_W * 1.4 + 12, animation: 'slotflash 0.9s ease-out both' }} />
      )}
      {stage === 'pop' && (
        <div className="absolute inset-x-0 top-[70px] flex justify-center pointer-events-none">
          <div className="rounded-2xl bg-amber-400 px-8 py-2 text-[34px] font-black text-amber-950 shadow-xl" style={{ animation: 'qpop2 .5s cubic-bezier(.2,1.4,.4,1) both' }}>새로운 물질 카드!</div>
        </div>
      )}
      {finished && <div className="absolute inset-x-0 bottom-[22px] text-center text-[22px] font-bold text-white drop-shadow pointer-events-none">탭하거나 Enter</div>}
      <style jsx global>{`
        @keyframes cardpop { 0%{transform:scale(.2) rotate(-14deg);opacity:0} 55%{transform:scale(1.12) rotate(3deg);opacity:1} 100%{transform:scale(1) rotate(0)} }
        @keyframes qpop2 { 0%{transform:scale(.3);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes slotflash { 0%{box-shadow:0 0 0 0 rgba(255,235,120,.95),inset 0 0 40px rgba(255,235,120,.9)} 100%{box-shadow:0 0 60px 30px rgba(255,235,120,0),inset 0 0 0 rgba(255,235,120,0)} }
      `}</style>
    </div>
  );
}
