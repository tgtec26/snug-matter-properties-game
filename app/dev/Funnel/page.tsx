'use client';

import { useEffect, useState } from 'react';
import { Funnel } from '@/components/minigames/Funnel';
import type { MinigameResult, Substance } from '@/game/types';

export default function FunnelDev() {
  const [subs, setSubs] = useState<Substance[] | null>(null);
  const [res, setRes] = useState<MinigameResult | null>(null);
  const [run, setRun] = useState(0);
  useEffect(() => { fetch('/data/substances.json').then((r) => r.json()).then(setSubs); }, []);
  if (!subs) return <main className="p-4">불러오는 중…</main>;
  const get = (id: string) => subs.find((s) => s.id === id)!;
  return (
    <main className="p-4">
      <div className="mb-2 flex gap-4 text-sm">
        <button type="button" className="border px-2" onClick={() => { setRes(null); setRun(run + 1); }}>처음부터</button>
        <span>onDone: {res ? JSON.stringify(res) : '아직'}</span>
      </div>
      <div className="relative overflow-hidden" style={{ width: 1280, height: 800 }}>
        <Funnel key={run} method="density" mixture={[get('cooking-oil'), get('water')]} obtains={[get('cooking-oil')]} leaves={[get('water')]}
          saltRemains={false} config={{}} onDone={setRes} />
      </div>
    </main>
  );
}
