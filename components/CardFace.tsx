'use client';

import { useDataStore } from '@/game/dataStore';
import { AssetImg } from '@/components/ui';

const STAMP: Record<string, string> = { measure: '측정', density: '밀도 차', solubility: '용해도 차', boiling: '끓는점 차' };
const TONE: Record<string, [string, string, string]> = {
  liquid: ['#7cc4f2', '#2f7bc0', '#dff2ff'],
  solid: ['#f0c27a', '#a9702b', '#fff1d6'],
  gas: ['#cfd8e6', '#7c8aa3', '#f0f4fa'],
};

/** 트럼프 카드 비율(5:7)의 물질 카드. 그림과 이름만 크게 보여 준다. w = 카드 너비(px) */
export function CardFace({ id, w = 300, stamp }: { id: string; w?: number; stamp?: string }) {
  const s = useDataStore(d => d.substances.find(x => x.id === id));
  if (!s) return null;
  const [c1, c2, bg] = TONE[s.state] ?? TONE.solid;
  const h = w * 1.4;
  return (
    <div style={{ width: w, height: h, borderRadius: w * 0.07, padding: w * 0.03, background: `linear-gradient(150deg,#ffe9a8,#d9a441 45%,#8a5a1a)`, boxShadow: '0 12px 30px rgba(0,0,0,.45)', position: 'relative' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: w * 0.05, background: `linear-gradient(170deg,${c1},${c2})`, padding: w * 0.045, display: 'flex', flexDirection: 'column', gap: w * 0.03 }}>
        <div style={{ flex: 1, borderRadius: w * 0.04, background: `radial-gradient(circle at 50% 42%,#fff 0%,${bg} 55%,${c1} 130%)`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`.cf-art img{max-width:90%;max-height:88%;object-fit:contain;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))}`}</style>
          <div className="cf-art" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AssetImg src={`/assets/items/${id}.webp`} fallback={<div style={{ width: '55%', aspectRatio: '1', borderRadius: '30%', background: s.color }} />} />
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,transparent 35%,rgba(255,255,255,.4) 48%,transparent 60%)', pointerEvents: 'none' }} />
          {stamp && <div style={{ position: 'absolute', top: w * 0.03, right: w * 0.03, fontSize: w * 0.06, fontWeight: 900, color: '#e11d48', border: `${Math.max(2, w * 0.012)}px solid #e11d48`, borderRadius: 999, padding: `${w * 0.005}px ${w * 0.03}px`, transform: 'rotate(-6deg)', background: 'rgba(255,255,255,.75)' }}>{STAMP[stamp] ?? stamp}</div>}
        </div>
        <div style={{ height: h * 0.14, borderRadius: w * 0.035, background: 'linear-gradient(#22345a,#132038)', border: `${Math.max(2, w * 0.01)}px solid #f1c85a`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: w * 0.115, letterSpacing: 1 }}>{s.name}</div>
      </div>
    </div>
  );
}
