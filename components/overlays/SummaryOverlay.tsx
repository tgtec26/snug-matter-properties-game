'use client';

import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { loadDex } from '@/game/dex';
import { formatMs } from '@/components/HUD';
import { Backdrop, SubstanceIcon } from '@/components/ui';

const METHOD = { density: '밀도 차', solubility: '용해도 차', boiling: '끓는점 차' } as const;

/** 한 판 요약: 의뢰별 별·방법 순서, 새 물질, 도감, 결과 카드 PNG 내려받기 */
export function SummaryOverlay() {
  const phase = useGameStore(s => s.phase);
  if (phase !== 'summary') return null;
  return <Summary />;
}

function Summary() {
  const s = useGameStore();
  const missions = useDataStore(d => d.missions);
  const subs = useDataStore(d => d.substances);
  const card = useRef<HTMLDivElement>(null);
  const [dex] = useState(() => loadDex());
  const [busy, setBusy] = useState(false);
  const list = subs.filter(x => !x.reference && x.id !== 'saltwater');
  const total = Object.values(s.records).reduce((a, r) => a + r.stars, 0);
  const name = (id: string) => subs.find(x => x.id === id)?.name ?? id;

  const save = async () => {
    if (!card.current || busy) return;
    setBusy(true);
    try {
      const url = await toPng(card.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a'); a.href = url; a.download = '물질분리공방_나의결과.png'; a.click();
    } finally { setBusy(false); }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.repeat) return; if (e.key === 'Enter') useGameStore.getState().restartRun(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
      <Backdrop name="board" tone="#222" />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-[1020px]">
        <div ref={card} className="rounded-3xl bg-white text-slate-900 px-9 py-6 shadow-2xl flex gap-8">
          <div className="flex-1">
            <div className="text-[15px] text-slate-500">물질 분리 공방 · 오늘의 기록</div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[34px] font-black">공방 기술자 인증</h2>
              <div className="text-[17px] text-slate-600">소요 {formatMs(s.elapsedMs)}</div>
            </div>
            <table className="w-full mt-2 text-[17px]"><tbody>
              {missions.filter(m => s.records[m.id] && m.kind !== 'tutorial').map(m => {
                const r = s.records[m.id];
                return (
                  <tr key={m.id} className="border-t border-slate-200">
                    <td className="py-1">{m.title}</td>
                    <td className="py-1 text-slate-500 text-[15px]">{r.methods.map(x => METHOD[x]).join(' → ')}</td>
                    <td className="py-1 text-right text-amber-500 font-bold">{'★'.repeat(r.stars) || '—'}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-400 font-bold"><td className="py-1.5" colSpan={2}>합계</td><td className="py-1.5 text-right text-[22px]">별 {total}</td></tr>
            </tbody></table>
            <div className="mt-2 text-[16px]">새로 알게 된 물질: {s.newKnown.length ? s.newKnown.map(name).join(', ') : '없음'}</div>
          </div>
          <div className="w-[360px]">
            <div className="text-[15px] text-slate-500 mb-1">물질 도감 {dex.known.filter(k => list.some(l => l.id === k)).length} / {list.length}</div>
            <div className="grid grid-cols-4 gap-2">
              {list.map(x => (
                <div key={x.id} className={`rounded-xl py-2 flex flex-col items-center ${dex.known.includes(x.id) ? 'bg-amber-50' : 'bg-slate-100'}`}>
                  {dex.known.includes(x.id) ? <SubstanceIcon id={x.id} size={40} /> : <div className="w-10 h-10 rounded-lg bg-slate-200" />}
                  <span className={`text-[13px] font-bold ${dex.known.includes(x.id) ? '' : 'text-slate-300'}`}>{dex.known.includes(x.id) ? x.name : '?'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3 justify-end">
          <button onClick={save} disabled={busy} className="rounded-xl bg-white px-6 py-3 text-[20px] font-bold text-slate-900">나의 결과 내려받기</button>
          <button onClick={() => s.reset()} className="rounded-xl border border-white/60 px-6 py-3 text-[20px] text-white">처음으로</button>
          <button onClick={() => s.restartRun()} className="rounded-xl bg-amber-500 px-8 py-3 text-[20px] font-bold text-black">다시 하기 (Enter)</button>
        </div>
      </div>
    </div>
  );
}
