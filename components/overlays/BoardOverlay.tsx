'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { isUnlocked } from '@/game/rules';
import { loadDex } from '@/game/dex';
import { Backdrop, SubstanceIcon } from '@/components/ui';
import { CardFace } from '@/components/CardFace';
import { CollectionBook } from '@/components/CollectionBook';

const KIND_LABEL = { tutorial: '연습', required: '필수', final: '최종', optional: '선택' } as const;

/** 의뢰판: 마을 그림 위 의뢰 카드. 최종 의뢰는 필수 3개 뒤에 열린다 */
export function BoardOverlay() {
  const phase = useGameStore(s => s.phase);
  const completed = useGameStore(s => s.completed);
  const records = useGameStore(s => s.records);
  const accept = useGameStore(s => s.acceptMission);
  const missions = useDataStore(d => d.missions);
  const [dexOpen, setDexOpen] = useState(false);
  if (phase !== 'board') return null;
  const shown = missions.filter(m => m.kind !== 'tutorial');
  return (
    <div className="absolute inset-0 pointer-events-auto">
      <Backdrop name="board" tone="linear-gradient(160deg,#6d8f4e,#c9b37a)" />
      {shown.map(m => {
        const done = completed.includes(m.id);
        const open = isUnlocked(m, completed, missions);
        return (
          <button key={m.id} disabled={done || !open} onClick={() => accept(m.id)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-[230px] rounded-2xl border-4 px-4 py-3 text-left shadow-xl transition ${done ? 'bg-emerald-100/90 border-emerald-500' : open ? 'bg-amber-50 border-amber-600 hover:scale-105 animate-[float_2.4s_ease-in-out_infinite]' : 'bg-slate-300/80 border-slate-500 opacity-70'}`}
            style={{ left: m.pos.x, top: m.pos.y }}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-amber-700">{KIND_LABEL[m.kind]} · {m.place}</span>
              <span className="text-[15px] text-amber-500 font-bold">{done ? '★'.repeat(records[m.id]?.stars ?? 0) || '완료' : ''}</span>
            </div>
            <div className="text-[21px] font-black text-slate-800 leading-tight">{m.title}</div>
            <div className="mt-1 flex gap-1">{m.components.filter(c => c !== 'saltwater').map(c => <SubstanceIcon key={c} id={c} size={26} />)}</div>
            {!open && <div className="text-[13px] text-slate-700 mt-1">필수 의뢰 3개를 마치면 열려요</div>}
          </button>
        );
      })}
      <button onClick={() => setDexOpen(true)} className="absolute left-4 bottom-4 rounded-xl bg-black/75 px-6 py-3 text-[20px] font-bold text-white hover:bg-black">도감</button>
      {dexOpen && <DexPopup onClose={() => setDexOpen(false)} />}
      <style jsx global>{`@keyframes float { 0%,100%{transform:translate(-50%,-50%)} 50%{transform:translate(-50%,calc(-50% - 6px))} }`}</style>
    </div>
  );
}

function DexPopup({ onClose }: { onClose: () => void }) {
  const substances = useDataStore(d => d.substances);
  const [dex] = useState(() => loadDex());
  const [sel, setSel] = useState<string | null>(null);
  const s = substances.find(x => x.id === sel);
  return (
    <div className="absolute inset-0 z-40" onClick={() => (sel ? setSel(null) : onClose())}>
      <CollectionBook filled={dex.known} stamps={dex.stamps} onPick={setSel} />
      {!sel && <div className="absolute inset-x-0 top-[8px] flex justify-center pointer-events-none"><div className="rounded-xl bg-black/65 px-6 py-1 text-[22px] font-bold text-white">물질 카드 컬렉션</div></div>}
      {sel && s && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(10,8,4,.7)' }}>
          <CardFace id={s.id} w={320} stamp={dex.stamps[s.id]} />
          <div className="rounded-xl bg-black/60 px-6 py-2 text-[22px] font-bold text-amber-100">{s.card.example}</div>
        </div>
      )}
      <button onClick={e => { e.stopPropagation(); onClose(); }} className="absolute right-6 bottom-5 rounded-xl bg-amber-500 px-8 py-3 text-[22px] font-bold text-black">닫기</button>
    </div>
  );
}

const STAMP = { measure: '측정', density: '밀도 차', solubility: '용해도 차', boiling: '끓는점 차' } as Record<string, string>;

/** 물질 카드 (도감·결과 화면 공용) */
export function SubstanceCard({ id, stamp }: { id: string; stamp?: string }) {
  const s = useDataStore(d => d.substances.find(x => x.id === id));
  if (!s) return null;
  const rows: [string, string][] = [
    ['상태', { solid: '고체', liquid: '액체', gas: '기체' }[s.state]],
    ['밀도', s.density !== null ? `${s.density < 0.01 ? s.density : s.density.toFixed(2)} g/cm³` : s.densityNote ?? '—'],
    ['녹는점', s.meltingPoint !== null ? `${s.meltingPoint} ℃` : '—'],
    ['끓는점', s.boilingPoint !== null ? `${s.boilingPoint} ℃` : '—'],
  ];
  if (s.solubility) rows.push(['용해도 (물 100 g)', `20 ℃ ${s.solubility.find(p => p.t === 20)?.g} g · 60 ℃ ${s.solubility.find(p => p.t === 60)?.g} g`]);
  if (s.misciblesWithWater !== undefined) rows.push(['물과', s.misciblesWithWater ? '잘 섞여요' : '섞이지 않아요']);
  return (
    <div>
      <div className="flex items-center gap-4">
        <SubstanceIcon id={s.id} size={72} />
        <div>
          <div className="text-[30px] font-black">{s.name}</div>
          {stamp && <div className="inline-block rounded-full border-2 border-rose-500 px-3 text-[15px] font-bold text-rose-500 -rotate-3">{STAMP[stamp] ?? stamp}</div>}
        </div>
      </div>
      <table className="mt-3 w-full text-[17px]"><tbody>
        {rows.map(([k, v]) => <tr key={k} className="border-t border-slate-200"><td className="py-1 text-slate-500 w-[150px]">{k}</td><td className="py-1 font-bold">{v}</td></tr>)}
      </tbody></table>
      <div className="mt-2 text-[16px]">{s.card.example} <span className="text-slate-400">({s.card.page})</span></div>
    </div>
  );
}
