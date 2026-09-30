'use client';

import { useRef } from 'react';

interface M { id: string; title: string; place: string; kind: string; pos: { x: number; y: number }; [k: string]: unknown }
const SCALE = 0.7;

/** 의뢰판 배경 위에서 카드를 끌어 위치를 정한다 (무대 1280×800 좌표) */
export default function BoardEditor({ missions, onChange }: { missions: M[]; onChange: (m: M[]) => void }) {
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const local = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / SCALE, y: (e.clientY - r.top) / SCALE }; };
  return (
    <div className="text-white">
      <div className="mb-2 text-[14px] text-[#bbb]">카드를 끌어서 옮기세요. 카드 중심이 좌표입니다. 아래 저장 단추를 눌러야 반영됩니다. (연습 의뢰는 지도에 나오지 않음)</div>
      <div ref={box} className="relative overflow-hidden rounded-lg border border-[#555]" style={{ width: 1280 * SCALE, height: 800 * SCALE, touchAction: 'none' }}
        onPointerMove={e => { const d = drag.current; if (!d) return; const p = local(e); onChange(missions.map(m => (m.id === d.id ? { ...m, pos: { x: Math.round(p.x - d.dx), y: Math.round(p.y - d.dy) } } : m))); }}
        onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/bg/board.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full pointer-events-none" />
        {missions.filter(m => m.kind !== 'tutorial').map(m => (
          <div key={m.id} className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-2xl border-4 border-amber-600 bg-amber-50 px-3 py-2 text-slate-800 shadow-xl select-none"
            style={{ left: m.pos.x * SCALE, top: m.pos.y * SCALE, width: 230 * SCALE }}
            onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const p = local(e); drag.current = { id: m.id, dx: p.x - m.pos.x, dy: p.y - m.pos.y }; }}>
            <div className="text-[11px] font-bold text-amber-700">{m.kind} · {m.place}</div>
            <div className="text-[15px] font-black leading-tight">{m.title}</div>
            <div className="text-[11px] text-slate-500">x {m.pos.x}, y {m.pos.y}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
