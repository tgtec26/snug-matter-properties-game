'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { loadDex } from '@/game/dex';
import { evaluateChoice, remainingBefore } from '@/game/rules';
import type { Method, Substance } from '@/game/types';
import { AssetImg } from '@/components/ui';
import { playSfx } from '@/game/audio';

const DOORS: { method: Method; name: string; key: string }[] = [
  { method: 'density', name: '밀도 차', key: '1' },
  { method: 'solubility', name: '용해도 차', key: '2' },
  { method: 'boiling', name: '끓는점 차', key: '3' },
];

/** 조사 결과를 문 아래 힌트로 보여 준다. 값은 도감에 있는 성분만 */
function hintLine(method: Method, ids: string[], subs: Substance[], known: string[]): string {
  const list = ids.map(i => subs.find(s => s.id === i)).filter((s): s is Substance => !!s && known.includes(s.id));
  if (method === 'density') {
    const v = list.filter(s => s.state === 'liquid' || s.density !== null).map(s => `${s.name} ${s.density !== null ? s.density : '<물'}`);
    return v.length >= 2 ? v.join(' / ') : '';
  }
  if (method === 'boiling') {
    const v = list.filter(s => s.boilingPoint !== null && s.state === 'liquid').map(s => `${s.name} ${s.boilingPoint} ℃`);
    return v.length >= 2 ? v.join(' / ') : '';
  }
  const v = list.filter(s => s.solubility && s.dissolvesInWater).map(s => {
    const g = (t: number) => s.solubility!.find(p => p.t === t)?.g;
    return `${s.name} ${g(20)}→${g(60)} g`;
  });
  return v.length >= 2 ? v.join(' / ') : '';
}

/** 갈림길: 방법 3개 문. 안 맞으면 한 줄 안내 후 재선택 */
export function ChooseOverlay() {
  const phase = useGameStore(s => s.phase);
  const stepIndex = useGameStore(s => s.stepIndex);
  // 갈림길마다 새로 마운트해서 도감(known)을 다시 읽는다
  return phase === 'choose' ? <Choose key={stepIndex} /> : null;
}

/** 벽의 문 3개 (스테이지 1280×800 좌표, 그림 bg/doors.webp 기준) */
const DOOR_RECT = [{ x: 153, y: 206, w: 250 }, { x: 512, y: 206, w: 253 }, { x: 873, y: 206, w: 250 }].map(r => ({ ...r, h: 419 }));
const HANDLE = [{ x: 370, y: 444 }, { x: 726, y: 444 }, { x: 1085, y: 446 }];
const OPEN_MS = 1700;
const KEY_HOME = { x: 640, y: 668 };
const HOOK_R = 90;

function Choose() {
  const phase = useGameStore(s => s.phase);
  const id = useGameStore(s => s.missionId);
  const stepIndex = useGameStore(s => s.stepIndex);
  const choose = useGameStore(s => s.chooseMethod);
  const m = useDataStore(d => d.missions.find(x => x.id === id));
  const subs = useDataStore(d => d.substances);
  const dialog = useDataStore(d => d.dialog);
  const [note, setNote] = useState({ key: '', text: '' });
  const [opening, setOpening] = useState<number | null>(null);
  const stepKey = `${phase}-${stepIndex}`;
  const msg = note.key === stepKey ? note.text : '';
  const [known] = useState(() => loadDex().known);
  const lockUntil = useRef(0);
  useEffect(() => { lockUntil.current = Date.now() + 700; }, [phase, stepIndex]);

  const pick = (i: number) => {
    if (Date.now() < lockUntil.current || opening !== null || !m) return;
    const method = DOORS[i].method;
    const r = evaluateChoice(m, stepIndex, method, subs);
    if (!r.ok) {
      choose(method); // 감점 기록
      playSfx('error');
      setNote({ key: stepKey, text: dialog?.reasons[r.reasonKey ?? ''] ?? '다른 문을 골라 보세요.' });
      return;
    }
    playSfx('correct');
    setOpening(i);
    setTimeout(() => choose(method), OPEN_MS);
  };
  useEffect(() => {
    if (phase !== 'choose') return;
    const onKey = (e: KeyboardEvent) => { if (e.repeat) return; const i = DOORS.findIndex(x => x.key === e.key); if (i >= 0) pick(i); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 열쇠 끌어다 손잡이에 넣기 (스테이지 좌표로 환산)
  const rootRef = useRef<HTMLDivElement>(null);
  const [keyPos, setKeyPos] = useState(KEY_HOME);
  const [dragging, setDragging] = useState(false);
  const toStage = (e: React.PointerEvent) => {
    const r = rootRef.current!.getBoundingClientRect();
    const k = 1280 / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };
  const nearest = (p: { x: number; y: number }) => {
    let best = -1, bd = HOOK_R;
    HANDLE.forEach((h, i) => { const d = Math.hypot(p.x - h.x, p.y - h.y); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const [near, setNear] = useState(-1);
  const onKeyDown = (e: React.PointerEvent) => {
    if (opening !== null || Date.now() < lockUntil.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true); setKeyPos(toStage(e)); setNear(nearest(toStage(e)));
  };
  const onKeyMove = (e: React.PointerEvent) => { if (!dragging) return; const p = toStage(e); setKeyPos(p); setNear(nearest(p)); };
  const onKeyUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    const i = nearest(toStage(e));
    setNear(-1);
    if (i >= 0) { setKeyPos({ x: HANDLE[i].x - 20, y: HANDLE[i].y }); pick(i); if (opening === null) setTimeout(() => setKeyPos(KEY_HOME), 350); }
    else setKeyPos(KEY_HOME);
  };
  if (!m) return null;
  return (
    <div ref={rootRef} className="absolute inset-0 pointer-events-auto overflow-hidden select-none" style={{ background: '#3b2a1a', touchAction: 'none' }}>
      <AssetImg src="/assets/bg/doors.webp" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-x-0 top-[56px] flex justify-center pointer-events-none">
        <div className="rounded-2xl border-4 border-amber-900 bg-amber-100 px-10 py-2 text-center text-[28px] font-black leading-tight text-amber-950 shadow-xl" style={{ maxWidth: 900 }}>{m.choosePrompt ?? '어떤 문으로 들어가시겠습니까?'}</div>
      </div>
      {DOOR_RECT.map((r, i) => {
        const d = DOORS[i];
        const open = opening === i;
        const hint = hintLine(d.method, remainingBefore(m, stepIndex), subs, known);
        return (
          <div key={d.method}>
            {/* 문 뒤에서 새어 나오는 빛 */}
            {open && <div className="absolute" style={{ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: `${r.w / 2}px ${r.w / 2}px 4px 4px`, background: 'radial-gradient(ellipse at 50% 55%, #fffbe0 0%, #ffe9a0 45%, #ffc94d 100%)', boxShadow: '0 0 90px 40px rgba(255,220,120,.9)' }} />}
            {/* 문짝: 그림 일부를 잘라 경첩 쪽(왼쪽)을 축으로 연다 */}
            <div className="absolute pointer-events-none" style={{ left: r.x, top: r.y, width: r.w, height: r.h, perspective: 900 }}>
              <div style={{ width: '100%', height: '100%', backgroundImage: 'url(/assets/bg/doors.webp)', backgroundSize: '1280px 800px', backgroundPosition: `-${r.x}px -${r.y}px`, borderRadius: `${r.w / 2}px ${r.w / 2}px 4px 4px`, transformOrigin: 'left center', transform: open ? 'rotateY(-78deg)' : 'none', transition: 'transform 900ms ease-in-out', filter: open ? 'brightness(.7)' : 'none' }} />
            </div>
            {/* 간판: 손잡이 위 */}
            {!open && (
              <div className="absolute flex flex-col items-center pointer-events-none" style={{ left: r.x + 10, top: 330, width: r.w - 20 }}>
                <div className="flex items-center gap-2 rounded-xl border-4 border-amber-950 bg-amber-200 px-4 py-1.5 shadow-lg">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-900 text-[18px] font-black text-amber-100">{d.key}</span>
                  <span className="text-[26px] font-black text-amber-950">{d.name}</span>
                </div>
                {hint && <div className="mt-1 rounded-lg bg-amber-950/90 px-2 py-1 text-center text-[15px] font-bold leading-tight text-amber-100">{hint}</div>}
              </div>
            )}
            {/* 열쇠를 끌면 손잡이 열쇠 구멍이 반짝인다 */}
            {!open && opening === null && (
              <div className="absolute rounded-full pointer-events-none" style={{ left: HANDLE[i].x - 34, top: HANDLE[i].y - 34, width: 68, height: 68, border: '4px solid rgba(255,240,170,.95)', animation: near === i ? 'handlepulse .5s ease-in-out infinite' : 'handlepulse 1.6s ease-in-out infinite', background: near === i ? 'rgba(255,240,170,.45)' : 'transparent' }} />
            )}
          </div>
        );
      })}
      {/* 바닥의 열쇠 */}
      {opening === null && (
        <div onPointerDown={onKeyDown} onPointerMove={onKeyMove} onPointerUp={onKeyUp} onPointerCancel={onKeyUp} onLostPointerCapture={() => setDragging(false)}
          className="absolute cursor-grab" style={{ left: keyPos.x - 70, top: keyPos.y - 50, width: 140, height: 100, touchAction: 'none', transition: dragging ? 'none' : 'left .3s, top .3s', zIndex: 20, filter: 'drop-shadow(0 6px 6px rgba(0,0,0,.5))', animation: dragging ? 'none' : 'keybob 1.4s ease-in-out infinite' }}>
          <svg viewBox="0 0 140 100" width="140" height="100">
            <circle cx="30" cy="50" r="24" fill="none" stroke="#f2c14e" strokeWidth="11" />
            <circle cx="30" cy="50" r="24" fill="none" stroke="#ffe08a" strokeWidth="3" strokeDasharray="30 120" />
            <rect x="52" y="44" width="78" height="12" rx="5" fill="#f2c14e" />
            <rect x="100" y="52" width="10" height="20" rx="3" fill="#f2c14e" />
            <rect x="118" y="52" width="10" height="14" rx="3" fill="#f2c14e" />
          </svg>
        </div>
      )}
      {/* 문이 열리면 빛이 화면을 채운다 */}
      {opening !== null && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: '#fff3c4', ['--cx' as string]: `${DOOR_RECT[opening].x + DOOR_RECT[opening].w / 2}px`, animation: `lightfill ${OPEN_MS - 800}ms ease-in 800ms both` }} />
      )}
      <div className="absolute inset-x-0 bottom-[14px] flex justify-center pointer-events-none">
        <div className={`rounded-2xl px-8 py-2 text-[24px] font-bold ${msg && opening === null ? 'bg-rose-600 text-white' : 'bg-black/50 text-white/85'}`}>
          {opening !== null ? '문이 열린다…' : msg || '열쇠를 끌어다 문 손잡이에 넣어요'}
        </div>
      </div>
      <style jsx global>{`
        @keyframes keybob { 0%,100%{transform:translateY(0) rotate(-6deg)} 50%{transform:translateY(-8px) rotate(4deg)} }
        @keyframes handlepulse { 0%,100%{transform:scale(1);box-shadow:0 0 8px 2px rgba(255,235,150,.6)} 50%{transform:scale(1.18);box-shadow:0 0 22px 8px rgba(255,235,150,.95)} }
        @keyframes lightfill { 0%{opacity:.85;clip-path:circle(8% at var(--cx) 50%)} 100%{opacity:1;clip-path:circle(160% at var(--cx) 50%)} }
      `}</style>
    </div>
  );
}
