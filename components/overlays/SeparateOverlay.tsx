'use client';

import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { remainingBefore } from '@/game/rules';
import type { Substance } from '@/game/types';
import { Funnel } from '@/components/minigames/Funnel';
import { FloatSieve } from '@/components/minigames/FloatSieve';
import { Recrystal } from '@/components/minigames/Recrystal';
import { Distill } from '@/components/minigames/Distill';

/** 분리 미니게임 자리: 방법 + 혼합물로 고른다 (밀도 차는 액체 층이면 분별 깔때기, 아니면 띄우기) */
export function SeparateOverlay() {
  const phase = useGameStore(s => s.phase);
  const id = useGameStore(s => s.missionId);
  const stepIndex = useGameStore(s => s.stepIndex);
  const done = useGameStore(s => s.completeMinigame);
  const m = useDataStore(d => d.missions.find(x => x.id === id));
  const subs = useDataStore(d => d.substances);
  const mg = useDataStore(d => d.minigame);
  if (phase !== 'separate' || !m) return null;
  const step = m.steps[stepIndex];
  const pick = (ids: string[]) => ids.map(x => subs.find(s => s.id === x)).filter((s): s is Substance => !!s);
  const mixture = pick(remainingBefore(m, stepIndex));
  const key = `${m.id}-${stepIndex}`;
  const props = {
    method: step.method, mixture, obtains: pick(step.obtains), leaves: pick(step.leaves ?? []),
    saltRemains: step.method === 'boiling' && (step.leaves ?? []).includes('nacl'),
    onDone: (r: { stars: 0 | 1 | 2 | 3 }) => done(r.stars),
  };
  if (step.method === 'solubility') return <Recrystal key={key} {...props} config={mg.recrystal ?? {}} />;
  if (step.method === 'boiling') return <Distill key={key} {...props} config={mg.distill ?? {}} />;
  const layered = mixture.some(s => s.state === 'liquid' && s.misciblesWithWater === false);
  return layered ? <Funnel key={key} {...props} config={mg.funnel ?? {}} /> : <FloatSieve key={key} {...props} config={mg.floatSieve ?? {}} />;
}
