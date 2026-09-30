'use client';

import { useEffect, useState } from 'react';
import type { Substance, MinigameResult } from '@/game/types';
import { SolubilityBottle } from '@/components/minigames/SolubilityBottle';

export default function Page() {
  const [subs, setSubs] = useState<Substance[] | null>(null);
  const [result, setResult] = useState<MinigameResult | null>(null);
  const [run, setRun] = useState(0);
  useEffect(() => { fetch('/data/substances.json').then(r => r.json()).then(setSubs); }, []);
  if (!subs) return null;
  const targets = ['kno3', 'nacl'].map(id => subs.find(s => s.id === id)!);
  return (
    <div className="p-4 bg-neutral-900 min-h-screen">
      <div className="relative overflow-hidden" style={{ width: 1280, height: 800 }}>
        <SolubilityBottle key={run} targets={targets} config={{}} onDone={setResult} />
      </div>
      <div className="mt-2 text-lg">결과: {result ? JSON.stringify(result) : '(진행 중)'} <button className="ml-4 underline" onClick={() => { setResult(null); setRun(r => r + 1); }}>다시</button></div>
    </div>
  );
}
