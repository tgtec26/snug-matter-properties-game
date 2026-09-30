'use client';

import { useState } from 'react';
import { useDataStore } from '@/game/dataStore';

/** 이미지가 없으면 fallback을 보여 준다 (플레이스홀더 → WebP 자동 교체) */
export function AssetImg({ src, className, fallback }: { src: string; className?: string; fallback?: React.ReactNode }) {
  const [bad, setBad] = useState(false);
  if (bad) return <>{fallback ?? null}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} draggable={false} onError={() => setBad(true)} />;
}

export function Backdrop({ name, tone }: { name: 'board' | 'bench'; tone: string }) {
  return (
    <div className="absolute inset-0" style={{ background: tone }}>
      <AssetImg src={`/assets/bg/${name}.webp`} className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

export function SubstanceIcon({ id, size = 56 }: { id: string; size?: number }) {
  const s = useDataStore(d => d.substances.find(x => x.id === id));
  const color = s?.color ?? '#999';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <AssetImg src={`/assets/items/${id}.webp`} className="w-full h-full object-contain"
        fallback={<div className="w-full h-full rounded-2xl border-2 border-white/60" style={{ background: color }} />} />
    </div>
  );
}

/** 실험대 위 혼합물 성분 카드. 특성은 도감에 있을 때만 값이 보이고 아니면 "?" */
export function MixtureTray({ ids, known, labels }: { ids: string[]; known: string[]; labels?: (id: string) => string }) {
  const subs = useDataStore(d => d.substances);
  return (
    <div className="flex gap-3">
      {ids.map(id => {
        const s = subs.find(x => x.id === id); if (!s) return null;
        const k = known.includes(id);
        return (
          <div key={id} className="w-[132px] rounded-2xl bg-white/90 border-2 border-amber-700/50 px-2 py-2 flex flex-col items-center gap-1 text-slate-800">
            <SubstanceIcon id={id} size={56} />
            <div className="text-[17px] font-black">{s.name}</div>
            <div className="text-[13px] text-slate-600">{k ? labels?.(id) ?? '조사 완료' : '특성 ?'}</div>
          </div>
        );
      })}
    </div>
  );
}
