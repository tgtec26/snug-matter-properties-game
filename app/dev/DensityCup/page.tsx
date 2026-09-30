'use client';

import { useEffect, useState } from 'react';
import type { Substance, MinigameResult } from '@/game/types';
import { DensityCup } from '@/components/minigames/DensityCup';

export default function Page() {
  const [targets, setTargets] = useState<Substance[] | null>(null);
  const [result, setResult] = useState<MinigameResult | null>(null);
  const [run, setRun] = useState(0);
  useEffect(() => {
    fetch('/data/substances.json').then(r => r.json()).then((all: Substance[]) =>
      setTargets(['water', 'cooking-oil'].map(id => all.find(s => s.id === id)!)));
  }, []);
  return (
    <main className="p-4">
      <div className="relative overflow-hidden" style={{ width: 1280, height: 800 }}>
        {targets && <DensityCup key={run} targets={targets} config={{}} onDone={setResult} />}
      </div>
      <div className="mt-2 flex gap-4 items-center">
        <span>결과: {result ? JSON.stringify(result) : '-'}</span>
        <button className="border px-3 py-1" onClick={() => { setResult(null); setRun(r => r + 1); }}>다시</button>
      </div>
    </main>
  );
}
