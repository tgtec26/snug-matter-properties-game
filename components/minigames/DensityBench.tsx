'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InvestigateProps } from '@/game/minigameTypes';
import { playSfx } from '@/game/audio';
import { buildPieces, calcStars, identify, isSharp, readError } from '@/game/minigames/densityBench';

type Stage = 'idle' | 'balance' | 'water' | 'done';
interface Rec { id: string; label: string; mass: number; vol: number; density: number; name: string; color: string }

const SLOTS = [90, 170, 250, 330];
const SLOT_Y = 690;
const BAL = { x0: 470, x1: 690, y0: 500, y1: 700, cx: 580, floor: 655 };
const TUBE = { x0: 880, x1: 960, top: 160, bottom: 620 };
const TUBE_ZONE = { x0: 830, x1: 1010, y0: 100, y1: 640 };
const TRAY = { x0: 30, x1: 400, y0: 610, y1: 790 };
const EYE_X = 1070;
const PX_PER_ML = (TUBE.bottom - TUBE.top) / 100;
const yOf = (ml: number) => TUBE.bottom - ml * PX_PER_ML;
const inZ = (p: { x: number; y: number }, z: { x0: number; x1: number; y0: number; y1: number }) => p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1;
const now = () => performance.now();
const size = (v: number) => Math.cbrt(v) * 22;

export function DensityBench({ targets, config, onDone }: InvestigateProps) {
  const vols = [config.smallVolume ?? 10, config.largeVolume ?? 20];
  const initial = config.initialVolume ?? 50;
  const tol = config.eyeTolerance ?? 0.3;
  const maxErr = config.maxReadError ?? 5;
  const fastSec = config.fastSec ?? 75;

  const [pieces] = useState(() => buildPieces(targets, vols));
  const [stages, setStages] = useState<Record<string, Stage>>(() => Object.fromEntries(pieces.map(p => [p.id, 'idle'])));
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [eyeY, setEyeY] = useState(180);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState<string | null>(pieces[0]?.id ?? null);
  const [kbd, setKbd] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(0);
  const doneRef = useRef(false);
  const t0 = useRef(0);
  const secRef = useRef(0);
  const reads = useRef({ sharp: 0, total: 0 });
  const dragOff = useRef({ dx: 0, dy: 0, from: 'idle' as Stage });

  useEffect(() => { t0.current = now(); lockRef.current = t0.current + 700; }, []);

  const active = pieces.find(p => stages[p.id] === 'balance' || stages[p.id] === 'water') ?? null;
  const level = initial + (active && stages[active.id] === 'water' ? active.volume : 0);
  const surfaceY = yOf(level);
  const offset = Math.max(-1, Math.min(1, (eyeY - surfaceY) / 50));
  const sharp = isSharp(offset, tol);
  const canFinish = recs.length >= 3;
  const pair = canFinish && recs.some((a, i) => recs.some((b, j) => i < j && a.name === b.name && a.vol !== b.vol));

  const put = useCallback((id: string, to: Stage) => {
    setStages(s => {
      const n: Record<string, Stage> = {};
      for (const k in s) n[k] = s[k] === 'done' ? 'done' : (s[k] === 'balance' || s[k] === 'water') ? 'idle' : s[k];
      n[id] = to;
      return n;
    });
    setMsg('');
  }, []);

  const read = useCallback(() => {
    if (!active || stages[active.id] !== 'water') return;
    const readV = Math.round((level + readError(offset, tol, maxErr)) * 10) / 10;
    const inc = readV - initial;
    const density = inc > 0.5 ? active.mass / inc : NaN;
    const sub = Number.isNaN(density) ? null : identify(density, targets);
    reads.current.total++;
    if (sharp) reads.current.sharp++;
    if (sub && sub.id === active.substance.id) {
      playSfx('correct');
      const next = [...recs, { id: active.id, label: active.label, mass: active.mass, vol: inc, density, name: sub.name, color: sub.color }];
      setRecs(next);
      setStages(s => ({ ...s, [active.id]: 'done' }));
      setMsg(`${active.mass.toFixed(1)} g ÷ ${inc.toFixed(1)} cm³ = ${density.toFixed(2)} g/cm³  →  ${sub.name} (${sub.density!.toFixed(2)})`);
      if (next.length >= 3 && !secRef.current) { secRef.current = (now() - t0.current) / 1000; setShowNext(true); setSel(null); }
      else setSel(pieces.find(p => p.id !== active.id && stages[p.id] === 'idle')?.id ?? null);
    } else {
      playSfx('error');
      setMsg(Number.isNaN(density) ? '수면을 눈높이에 맞춰 다시 읽어요' : `${density.toFixed(2)} g/cm³ — 눈금이 흐려요. 눈높이를 수면에 맞춰 다시 읽어요`);
    }
  }, [active, stages, level, offset, tol, maxErr, initial, sharp, targets, recs, pieces]);

  const finish = useCallback(() => {
    if (doneRef.current || now() < lockRef.current || !canFinish) return;
    doneRef.current = true;
    onDone({ stars: calcStars(reads.current.sharp, reads.current.total, secRef.current, fastSec) });
  }, [canFinish, onDone, fastSec]);

  // 키보드 대체: ←/→ 조각 선택, Enter/Space 다음 단계(저울→실린더→읽기), ↑/↓ 눈높이
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (now() < lockRef.current) return;
      const k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); setKbd(true); setEyeY(y => Math.max(TUBE.top, Math.min(TUBE.bottom, y + (k === 'ArrowUp' ? -8 : 8)))); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault(); setKbd(true);
        const open = pieces.filter(p => stages[p.id] !== 'done');
        if (!open.length) return;
        const i = open.findIndex(p => p.id === sel);
        setSel(open[(i + (k === 'ArrowRight' ? 1 : -1) + open.length) % open.length].id);
        return;
      }
      if ((k === 'Enter' || k === ' ') && !e.repeat) {
        e.preventDefault(); setKbd(true);
        if (sel) {
          const st = stages[sel];
          if (st === 'idle') put(sel, 'balance');
          else if (st === 'balance') put(sel, 'water');
          else if (st === 'water') read();
        } else if (canFinish) finish();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [pieces, stages, sel, put, read, finish, canFinish]);

  const toStage = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * 1280) / r.width, y: ((e.clientY - r.top) * 800) / r.height };
  };
  const posOf = (id: string, st: Stage, idx: number, v: number) => {
    if (st === 'balance') return { x: BAL.cx, y: BAL.floor - size(v) / 2 };
    if (st === 'water') return { x: (TUBE.x0 + TUBE.x1) / 2, y: TUBE.bottom - size(v) / 2 - 4 };
    return { x: SLOTS[idx], y: SLOT_Y - 20 };
  };

  const onPieceDown = (e: React.PointerEvent, id: string, home: { x: number; y: number }) => {
    if (now() < lockRef.current || stages[id] === 'done') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toStage(e);
    dragOff.current = { dx: home.x - p.x, dy: home.y - p.y, from: stages[id] };
    setDrag({ id, x: home.x, y: home.y });
    setSel(id);
  };
  const onPieceMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toStage(e);
    setDrag({ id: drag.id, x: p.x + dragOff.current.dx, y: p.y + dragOff.current.dy });
  };
  const onPieceUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toStage(e);
    const { id } = drag;
    const from = dragOff.current.from;
    setDrag(null);
    if (e.type !== 'pointerup') return;
    if (inZ(p, BAL)) put(id, 'balance');
    else if (inZ(p, TUBE_ZONE)) {
      if (from === 'idle') { setMsg('먼저 저울로'); playSfx('error'); } else put(id, 'water');
    } else if (inZ(p, TRAY)) put(id, 'idle');
  };

  const onEyeDown = (e: React.PointerEvent) => {
    if (now() < lockRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).dataset.drag = '1';
  };
  const onEyeMove = (e: React.PointerEvent) => {
    if ((e.currentTarget as HTMLElement).dataset.drag !== '1') return;
    setEyeY(Math.max(TUBE.top, Math.min(TUBE.bottom, toStage(e).y)));
  };
  const onEyeUp = (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).dataset.drag = ''; };

  const step: 'balance' | 'water' | 'read' | 'free' = !active ? 'balance' : stages[active.id] === 'balance' ? 'water' : 'read';
  const showStep = canFinish ? 'free' : step;
  const blur = Math.min(4, Math.abs(offset) * 5);
  const massShown = active && stages[active.id] === 'balance' ? active.mass : 0;

  return (
    <div ref={rootRef} className="absolute inset-0 pointer-events-auto select-none overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#1e3a4f,#0f2233)', touchAction: 'none', color: '#fff' }}>
      <style>{`@keyframes db-pulse{0%,100%{opacity:.35}50%{opacity:1}}@keyframes db-bob{0%,100%{transform:translateX(0)}50%{transform:translateX(14px)}}`}</style>

      {/* 기록 카드 */}
      <div className="absolute" style={{ left: 40, top: 50, width: 360 }}>
        {pieces.map(p => {
          const r = recs.find(x => x.id === p.id);
          return (
            <div key={p.id} className="flex items-center gap-3 mb-2 rounded-md px-3" style={{ height: 44, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)' }}>
              <span className="font-bold" style={{ width: 22 }}>{p.label}</span>
              {r ? (<>
                <span className="rounded-full" style={{ width: 16, height: 16, background: r.color }} />
                <span className="text-sm">{r.mass.toFixed(1)} g / {r.vol.toFixed(1)} cm³</span>
                <span className="ml-auto font-bold">{r.density.toFixed(2)}</span>
              </>) : <span className="text-sm opacity-40">{'- - -'}</span>}
            </div>
          );
        })}
      </div>

      {/* 계산 패널 */}
      <div className="absolute rounded-lg px-5 py-3 text-center" style={{ left: 440, top: 50, width: 400, minHeight: 120, background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.2)' }}>
        <div className="text-lg font-bold" style={{ minHeight: 56 }}>{msg || (active ? `조각 ${active.label}` : '조각을 저울로')}</div>
        {canFinish && <div className="mt-2 text-base" style={{ color: '#ffe082' }}>{pair ? '크기가 달라도 밀도는 같다: 양에 관계없이 일정' : '밀도는 양에 관계없이 일정'}</div>}
      </div>

      {/* 저울 */}
      <div className="absolute rounded-t-2xl" style={{ left: 430, top: 700, width: 300, height: 80, background: 'linear-gradient(#cfd8dc,#90a4ae)', border: '2px solid #607d8b' }}>
        <div className="absolute rounded font-mono text-2xl text-right px-3" style={{ left: 50, top: 14, width: 200, height: 44, lineHeight: '44px', background: '#102a1a', color: '#7CFF9A' }}>{massShown.toFixed(1)} g</div>
      </div>
      <div className="absolute rounded-full" style={{ left: BAL.x0 + 10, top: BAL.floor - 2, width: BAL.x1 - BAL.x0 - 20, height: 16, background: '#b0bec5', border: '2px solid #607d8b' }} />
      <div className="absolute rounded-lg" style={{ left: BAL.x0, top: BAL.y0, width: BAL.x1 - BAL.x0, height: BAL.y1 - BAL.y0 - 30, border: '2px dashed #ffe082', opacity: showStep === 'balance' && drag ? 1 : 0.25, animation: showStep === 'balance' ? 'db-pulse 1.2s infinite' : undefined }} />

      {/* 조각 보관대 */}
      <div className="absolute rounded-lg" style={{ left: TRAY.x0, top: TRAY.y0 + 20, width: TRAY.x1 - TRAY.x0, height: 130, border: '2px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.05)' }} />

      {/* 눈금실린더 */}
      <div className="absolute" style={{ left: TUBE.x0, top: TUBE.top, width: TUBE.x1 - TUBE.x0, height: TUBE.bottom - TUBE.top, border: '3px solid rgba(220,240,255,.85)', borderTop: 'none', borderRadius: '0 0 14px 14px', background: 'rgba(180,220,255,.08)' }}>
        <div className="absolute left-0 right-0 bottom-0" style={{ height: (level - 0) * PX_PER_ML, background: 'linear-gradient(rgba(90,169,230,.75),rgba(60,130,200,.9))', transition: 'height .7s ease', borderRadius: '0 0 10px 10px' }}>
          <svg width={TUBE.x1 - TUBE.x0 - 6} height="14" style={{ position: 'absolute', top: -7, left: 0 }}>
            <path d={`M0 2 Q${(TUBE.x1 - TUBE.x0 - 6) / 2} 16 ${TUBE.x1 - TUBE.x0 - 6} 2`} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <svg className="absolute" style={{ left: 780, top: 0, filter: `blur(${blur}px)` }} width="100" height="800">
        {Array.from({ length: 11 }, (_, i) => i * 10).map(ml => (
          <g key={ml}>
            <line x1={90 - (ml % 50 === 0 ? 24 : 14)} x2="100" y1={yOf(ml) } y2={yOf(ml)} stroke="#e3f2fd" strokeWidth="2" />
            {ml % 20 === 0 && <text x="40" y={yOf(ml) + 5} fill="#e3f2fd" fontSize="15" textAnchor="end">{ml}</text>}
          </g>
        ))}
      </svg>
      <div className="absolute rounded" style={{ left: TUBE_ZONE.x0, top: TUBE_ZONE.y0, width: TUBE_ZONE.x1 - TUBE_ZONE.x0, height: TUBE_ZONE.y1 - TUBE_ZONE.y0, border: '2px dashed #ffe082', opacity: showStep === 'water' ? 1 : 0, animation: showStep === 'water' ? 'db-pulse 1.2s infinite' : undefined, pointerEvents: 'none' }} />

      {/* 눈높이 슬라이더 */}
      <div className="absolute" style={{ left: EYE_X - 3, top: TUBE.top, width: 6, height: TUBE.bottom - TUBE.top, background: 'rgba(255,255,255,.25)', borderRadius: 3 }} />
      <div className="absolute" style={{ left: 975, width: EYE_X - 975, top: eyeY - 1, height: 0, borderTop: `2px dashed ${sharp ? '#7CFF9A' : '#ffe082'}` }} />
      <div onPointerDown={onEyeDown} onPointerMove={onEyeMove} onPointerUp={onEyeUp} onPointerCancel={onEyeUp} onLostPointerCapture={onEyeUp}
        className="absolute flex items-center justify-center rounded-full" role="slider" aria-label="눈높이" aria-valuenow={Math.round(eyeY)}
        style={{ left: EYE_X - 34, top: eyeY - 34, width: 68, height: 68, cursor: 'grab', touchAction: 'none', background: sharp ? '#2e7d32' : '#37474f', border: `3px solid ${sharp ? '#7CFF9A' : '#ffe082'}`, animation: showStep === 'read' && !sharp ? 'db-pulse 1s infinite' : undefined }}>
        <svg width="40" height="28" viewBox="0 0 40 28"><path d="M2 14 Q20 -2 38 14 Q20 30 2 14Z" fill="#fff" /><circle cx="20" cy="14" r="6" fill="#263238" /></svg>
      </div>

      {/* 읽기 / 다음 */}
      <button onClick={() => now() >= lockRef.current && read()} disabled={!active || stages[active.id] !== 'water'}
        className="absolute rounded-lg font-bold text-xl" style={{ left: 1010, top: 665, width: 200, height: 56, background: active && stages[active.id] === 'water' ? '#00897b' : '#455a64', opacity: active && stages[active.id] === 'water' ? 1 : 0.5, border: '2px solid rgba(255,255,255,.6)' }}>눈금 읽기</button>
      {showNext && (
        <button onClick={finish} className="absolute rounded-lg font-bold text-xl" style={{ left: 1010, top: 735, width: 200, height: 52, background: '#f9a825', color: '#222', border: '2px solid #fff' }}>다음</button>
      )}

      {/* 비언어 안내 화살표 */}
      {showStep === 'balance' && !drag && <svg className="absolute" style={{ left: 380, top: 640, animation: 'db-bob 1s infinite' }} width="60" height="40"><path d="M2 20H44M32 6L46 20L32 34" stroke="#ffe082" strokeWidth="5" fill="none" strokeLinecap="round" /></svg>}
      {showStep === 'water' && !drag && <svg className="absolute" style={{ left: 750, top: 330, animation: 'db-bob 1s infinite' }} width="70" height="40"><path d="M2 20H54M42 6L56 20L42 34" stroke="#ffe082" strokeWidth="5" fill="none" strokeLinecap="round" /></svg>}

      {/* 조각 */}
      {pieces.map((p, i) => {
        const st = stages[p.id];
        if (st === 'done') return null;
        const home = posOf(p.id, st, i, p.volume);
        const pos = drag?.id === p.id ? drag : home;
        const s = size(p.volume);
        return (
          <div key={p.id} onPointerDown={e => onPieceDown(e, p.id, home)} onPointerMove={onPieceMove} onPointerUp={onPieceUp} onPointerCancel={onPieceUp} onLostPointerCapture={onPieceUp}
            className="absolute flex items-center justify-center"
            style={{ left: pos.x - 44, top: pos.y - 44, width: 88, height: 88, touchAction: 'none', cursor: 'grab', zIndex: drag?.id === p.id ? 20 : 5, transition: drag?.id === p.id ? 'none' : 'left .3s, top .3s' }}>
            {st === 'water' && <div className="absolute" style={{ left: 43, bottom: 44 + s / 2, width: 2, height: 500, background: '#eee' }} />}
            <div className="flex items-center justify-center font-bold text-slate-800 rounded-md" style={{ width: s, height: s, background: 'linear-gradient(135deg,#eceff1,#90a4ae)', border: `2px solid ${kbd && sel === p.id ? '#ffe082' : '#546e7a'}`, boxShadow: kbd && sel === p.id ? '0 0 0 4px rgba(255,224,130,.6)' : undefined }}>{p.label}</div>
          </div>
        );
      })}
    </div>
  );
}
