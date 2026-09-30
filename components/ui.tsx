'use client';

import { useId, useState } from 'react';
import SHAPES from '@/game/glassShapes.json';
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

/** 활동 화면 배경 그림(bg/<name>.webp) + 글자가 읽히도록 어둡게 덮는 막. 그림이 없으면 아래 단색이 보인다 */
export function StageBg({ name, dark = 0.55 }: { name: 'lab' | 'labheat' | 'kitchen'; dark?: number }) {
  return (
    <>
      <AssetImg src={`/assets/bg/${name}.webp`} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(rgba(10,18,28,${dark + 0.12}),rgba(10,18,28,${dark - 0.1}))` }} />
    </>
  );
}

/** SVG 안에서 쓰는 유리 도구: 액체(children)를 유리 안쪽 모양(glassShapes.json)으로 잘라 그린 뒤 유리 그림을 덮는다 */
export function GlassG({ name, x, y, w, h, children, opacity = 1 }: { name: string; x: number; y: number; w: number; h: number; children?: React.ReactNode; opacity?: number }) {
  const id = 'gl' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const rows = (SHAPES as Record<string, number[][]>)[name];
  const pts = rows
    ? [...rows.map(([fy, l]) => `${x + l * w},${y + fy * h}`), ...[...rows].reverse().map(([fy, , r]) => `${x + r * w},${y + fy * h}`)].join(' ')
    : '';
  return (
    <g>
      {children && pts && (
        <>
          <clipPath id={id}><polygon points={pts} /></clipPath>
          <g clipPath={`url(#${id})`}>{children}</g>
        </>
      )}
      <image href={`/assets/items/${name}.webp`} x={x} y={y} width={w} height={h} preserveAspectRatio="none" opacity={opacity} pointerEvents="none" />
    </g>
  );
}
