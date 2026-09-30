'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { loadDex } from '@/game/dex';
import { remainingBefore } from '@/game/rules';
import type { Method, Substance } from '@/game/types';
import { Backdrop, MixtureTray } from '@/components/ui';
import { playSfx } from '@/game/audio';

const DOORS: { method: Method; name: string; key: string }[] = [
  { method: 'density', name: '밀도 차', key: '1' },
  { method: 'solubility', name: '용해도 차', key: '2' },
  { method: 'boiling', name: '끓는점 차', key: '3' },
];

/** 조사 결과를 문 아래 힌트로 보여 준다. 값은 도감에 있는 성분만 */
function hintLine(method: Method, ids: string[], subs: Substance[], known: string[]): string {
  const list = ids.map(i => subs.find(s => s.id === i)).filter((s): s is Substance => !!s && known.includes(s.id));
  if (method === 'density') {
    const v = list.filter(s => s.state === 'liquid' || s.density !== null).map(s => `${s.name} ${s.density !== null ? s.density : '<물'}`);
    return v.length >= 2 ? v.join(' / ') : '';
  }
  if (method === 'boiling') {
    const v = list.filter(s => s.boilingPoint !== null && s.state === 'liquid').map(s => `${s.name} ${s.boilingPoint} ℃`);
    return v.length >= 2 ? v.join(' / ') : '';
  }
  const v = list.filter(s => s.solubility && s.dissolvesInWater).map(s => {
    const g = (t: number) => s.solubility!.find(p => p.t === t)?.g;
    return `${s.name} ${g(20)}→${g(60)} g`;
  });
  return v.length >= 2 ? v.join(' / ') : '';
}

/** 갈림길: 방법 3개 문. 안 맞으면 한 줄 안내 후 재선택 */
export function ChooseOverlay() {
  const phase = useGameStore(s => s.phase);
  const stepIndex = useGameStore(s => s.stepIndex);
  // 갈림길마다 새로 마운트해서 도감(known)을 다시 읽는다
  return phase === 'choose' ? <Choose key={stepIndex} /> : null;
}

function Choose() {
  const phase = useGameStore(s => s.phase);
  const id = useGameStore(s => s.missionId);
  const stepIndex = useGameStore(s => s.stepIndex);
  const choose = useGameStore(s => s.chooseMethod);
  const m = useDataStore(d => d.missions.find(x => x.id === id));
  const subs = useDataStore(d => d.substances);
  const dialog = useDataStore(d => d.dialog);
  const [note, setNote] = useState({ key: '', text: '' });
  const stepKey = `${phase}-${stepIndex}`;
  const msg = note.key === stepKey ? note.text : '';
  const [known] = useState(() => loadDex().known);
  const lockUntil = useRef(0);
  useEffect(() => { lockUntil.current = Date.now() + 700; }, [phase, stepIndex]);

  const pick = (method: Method) => {
    if (Date.now() < lockUntil.current) return;
    const r = choose(method);
    if (r.ok) return;
    playSfx('error');
    setNote({ key: stepKey, text: dialog?.reasons[r.reasonKey ?? ''] ?? '다른 방법을 골라 보세요.' });
  };
  useEffect(() => {
    if (phase !== 'choose') return;
    const onKey = (e: KeyboardEvent) => { if (e.repeat) return; const d = DOORS.find(x => x.key === e.key); if (d) pick(d.method); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!m) return null;
  const ids = remainingBefore(m, stepIndex);
  return (
    <div className="absolute inset-0 pointer-events-auto">
      <Backdrop name="bench" tone="linear-gradient(#5b4128,#8a6238)" />
      <div className="absolute inset-x-0 top-[70px] flex flex-col items-center gap-3">
        <MixtureTray ids={ids} known={known} />
      </div>
      <div className="absolute inset-x-0 top-[330px] flex justify-center gap-8">
        {DOORS.map(d => {
          const hint = hintLine(d.method, ids, subs, known);
          return (
            <button key={d.method} onClick={() => pick(d.method)}
              className="w-[300px] h-[300px] rounded-t-[150px] rounded-b-2xl border-[6px] border-amber-900 bg-gradient-to-b from-amber-200 to-amber-500 shadow-2xl flex flex-col items-center justify-center gap-4 hover:scale-105 transition text-slate-900 px-4">
              <div className="text-[44px] font-black">{d.name}</div>
              <div className="min-h-[52px] text-[18px] font-bold text-amber-900 text-center">{hint}</div>
              <div className="text-[14px] text-amber-900/70">키 {d.key}</div>
            </button>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-[36px] flex justify-center">
        <div className={`rounded-2xl px-8 py-3 text-[24px] font-bold ${msg ? 'bg-rose-600 text-white' : 'bg-black/50 text-white/80'}`}>
          {msg || '어떤 특성의 차이로 가를까?'}
        </div>
      </div>
    </div>
  );
}
