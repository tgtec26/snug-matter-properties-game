'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { isUnlocked } from '@/game/rules';
import { loadDex } from '@/game/dex';
import { Backdrop, SubstanceIcon } from '@/components/ui';

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
  const list = substances.filter(x => !x.reference && x.id !== 'saltwater');
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-[1000px] rounded-3xl bg-white text-slate-900 px-8 py-6 shadow-2xl flex gap-6" onClick={e => e.stopPropagation()}>
        <div className="w-[520px]">
          <div className="text-[24px] font-black mb-3">물질 도감 {dex.known.filter(k => list.some(l => l.id === k)).length} / {list.length}</div>
          <div className="grid grid-cols-4 gap-2">
            {list.map(x => {
              const known = dex.known.includes(x.id);
              return (
                <button key={x.id} disabled={!known} onClick={() => setSel(x.id)}
                  className={`rounded-xl border-2 py-2 flex flex-col items-center gap-1 ${sel === x.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200'} ${known ? '' : 'opacity-40'}`}>
                  {known ? <SubstanceIcon id={x.id} size={48} /> : <div className="w-12 h-12 rounded-xl bg-slate-200" />}
                  <span className="text-[15px] font-bold">{known ? x.name : '?'}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-h-[300px]">
          {s ? <SubstanceCard id={s.id} stamp={dex.stamps[s.id]} /> : <div className="text-slate-400 text-[18px] mt-20 text-center">물질을 눌러 보세요</div>}
          <div className="mt-6 text-right"><button onClick={onClose} className="rounded-xl bg-amber-500 px-6 py-2 text-[18px] font-bold">닫기</button></div>
        </div>
      </div>
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
