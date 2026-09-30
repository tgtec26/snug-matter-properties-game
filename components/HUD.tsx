'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { loadDex } from '@/game/dex';

export const formatMs = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/** 좌상단: 의뢰·단계. 우측(전체 화면 단추 왼쪽): 별·도감·시간 */
export function HUD() {
  const s = useGameStore();
  const missions = useDataStore(d => d.missions);
  const substances = useDataStore(d => d.substances);
  const [now, setNow] = useState(() => Date.now());
  const [known, setKnown] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setKnown(loadDex().known.length); }, 1000);
    return () => clearInterval(t);
  }, []);
  if (s.phase === 'title' || s.phase === 'summary' || s.phase === 'investigate' || s.phase === 'choose' || s.phase === 'result' || s.phase === 'separate') return null;
  const m = missions.find(x => x.id === s.missionId);
  const stars = Object.values(s.records).reduce((a, r) => a + r.stars, 0);
  const total = substances.filter(x => !x.reference && x.id !== 'saltwater').length;
  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-2 text-white select-none pointer-events-none">
      <div className="rounded-xl bg-black/65 px-4 py-1.5 text-[17px]">
        {m ? <><span className="text-amber-300 font-bold">{m.title}</span><span className="text-white/70"> · {m.place}</span>{m.steps.length > 0 && <span className="text-white/70"> · 단계 {Math.min(s.stepIndex + 1, m.steps.length)}/{m.steps.length}</span>}</> : <span className="text-amber-300 font-bold">의뢰판</span>}
      </div>
      <div className="mr-[250px] rounded-xl bg-black/65 px-4 py-1.5 text-[17px] flex items-center gap-4">
        <span className="text-amber-300 font-bold">별 {stars}</span>
        <span>도감 {known} / {total}</span>
        <span className="font-mono text-white/80">{s.startedAt ? formatMs(Math.max(0, now - s.startedAt)) : '00:00'}</span>
      </div>
    </div>
  );
}
