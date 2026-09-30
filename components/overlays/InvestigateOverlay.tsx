'use client';

import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import type { Substance } from '@/game/types';
import { DensityBench } from '@/components/minigames/DensityBench';
import { DensityCup } from '@/components/minigames/DensityCup';
import { SolubilityBottle } from '@/components/minigames/SolubilityBottle';
import { HeatingCurve } from '@/components/minigames/HeatingCurve';

/** 조사 미니게임 자리: 의뢰의 investigate.kind로 고른다 */
export function InvestigateOverlay() {
  const phase = useGameStore(s => s.phase);
  const id = useGameStore(s => s.missionId);
  const finish = useGameStore(s => s.finishInvestigation);
  const m = useDataStore(d => d.missions.find(x => x.id === id));
  const subs = useDataStore(d => d.substances);
  const mg = useDataStore(d => d.minigame);
  if (phase !== 'investigate' || !m?.investigate) return null;
  const targets = m.investigate.targets.map(t => subs.find(s => s.id === t)).filter((s): s is Substance => !!s);
  const props = { targets, onDone: (r: { stars: 0 | 1 | 2 | 3 }) => finish(r.stars) };
  const key = m.id;
  switch (m.investigate.kind) {
    case 'density-solid': return <DensityBench key={key} {...props} config={mg.densityBench ?? {}} />;
    case 'density-liquid': return <DensityCup key={key} {...props} config={mg.densityCup ?? {}} />;
    case 'solubility': return <SolubilityBottle key={key} {...props} config={mg.solubilityBottle ?? {}} />;
    case 'heating': return <HeatingCurve key={key} {...props} config={mg.heatingCurve ?? {}} />;
  }
}
