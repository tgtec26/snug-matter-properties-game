'use client';

import { useMemo } from 'react';
import { useDataStore } from '@/game/dataStore';
import { CardFace } from '@/components/CardFace';

/** 컬렉션 북(bg/book.webp) 위 12칸의 중심 좌표 (무대 1280×800) */
const COLS = [[161, 345, 522], [764, 942, 1120]];
const ROWS = [236, 521];
export const SLOT_CARD_W = 158;
export const slotCenter = (i: number) => {
  const page = i < 6 ? 0 : 1; const k = i % 6;
  return { x: COLS[page][k % 3], y: ROWS[Math.floor(k / 3)] };
};

/** 도감에 실릴 물질 (자료실 제외, 소금물 제외) */
export const useDexList = () => {
  const subs = useDataStore(d => d.substances);
  return useMemo(() => subs.filter(x => !x.reference && x.id !== 'saltwater'), [subs]);
};

/** 펼친 카드 컬렉션 북. filled에 든 물질만 카드가 꽂혀 있다 */
export function CollectionBook({ filled, stamps, onPick }: { filled: string[]; stamps: Record<string, string>; onPick?: (id: string) => void }) {
  const list = useDexList();
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/bg/book.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
      {list.map((s, i) => {
        const c = slotCenter(i);
        const has = filled.includes(s.id);
        return (
          <div key={s.id} className="absolute" style={{ left: c.x - SLOT_CARD_W / 2, top: c.y - (SLOT_CARD_W * 1.4) / 2, width: SLOT_CARD_W, height: SLOT_CARD_W * 1.4 }}>
            {has && <div onClick={() => onPick?.(s.id)} style={{ cursor: onPick ? 'pointer' : undefined }}><CardFace id={s.id} w={SLOT_CARD_W} stamp={stamps[s.id]} /></div>}
          </div>
        );
      })}
    </>
  );
}
