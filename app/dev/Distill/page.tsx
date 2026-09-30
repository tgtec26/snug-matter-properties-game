'use client';
import { useEffect, useState } from 'react';
import { Distill } from '@/components/minigames/Distill';
import type { MinigameResult, Substance } from '@/game/types';

export default function Page() {
  const [subs, setSubs] = useState<Substance[] | null>(null);
  const [result, setResult] = useState<MinigameResult | null>(null);
  useEffect(() => { fetch('/data/substances.json').then((r) => r.json()).then(setSubs); }, []);
  if (!subs) return null;
  const by = (id: string) => subs.find((s) => s.id === id)!;
  return (
    <div style={{ padding: 16, background: '#222', minHeight: '100vh', color: '#fff' }}>
      <div style={{ position: 'relative', width: 1280, height: 800, overflow: 'hidden' }}>
        <Distill method="boiling" mixture={[by("ethanol"), by("water")]} obtains={[by("ethanol"), by("water")]} leaves={[]} saltRemains config={{}} onDone={setResult} />
      </div>
      <pre>{result ? JSON.stringify(result) : '결과 없음'}</pre>
    </div>
  );
}
