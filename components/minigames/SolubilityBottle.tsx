'use client';

import { useEffect, useRef, useState } from 'react';
import type { InvestigateProps } from '@/game/minigameTypes';
import type { Substance } from '@/game/types';
import { playSfx } from '@/game/audio';
import { solubilityAt } from '@/game/rules';
import {
  SCOOP_G,
  addScoop, biggestGain, capacity, newBottle, solubilityStars, stir, warm,
  type Bottle, type Record2,
} from '@/game/minigames/solubilityBottle';

const HOME = { x: 400, y: 250, w: 180, h: 300 };
const BEAKER = { x: 800, y: 280, w: 260, h: 290 };
const IN_BEAKER = { x: 840, y: 250 };
const SPOON_HOME = { x: 110, y: 300 };
const STIR_DIST = 220;
const COLORS = ['#f59e0b', '#38bdf8'];
const inRect = (px: number, py: number, r: { x: number; y: number; w: number; h: number }, m = 30) =>
  px > r.x - m && px < r.x + r.w + m && py > r.y - m && py < r.y + r.h + m;

type Drag = { kind: 'spoon' | 'bottle'; x: number; y: number; dx: number; dy: number };

function Icon({ s, size }: { s: Substance; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/assets/items/${s.id}.webp`} alt="" width={size} height={size}
      onError={e => { e.currentTarget.style.display = 'none'; }}
      style={{ position: 'absolute', inset: 0, width: size, height: size, objectFit: 'contain', pointerEvents: 'none' }} />
  );
}

function BottleView({ b, s, stirring, x, y }: { b: Bottle; s: Substance; stirring: boolean; x: number; y: number }) {
  const settledH = Math.min(90, b.settled * 45);
  const specks = Math.round(b.pending / SCOOP_G);
  return (
    <svg width={HOME.w} height={HOME.h} viewBox="0 0 180 300" style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      <rect x="20" y="70" width="140" height="220" rx="18" fill="#cfe9f7" fillOpacity=".25" stroke="#e6f4fb" strokeWidth="4" />
      <rect x="55" y="30" width="70" height="44" rx="6" fill="#cfe9f7" fillOpacity=".25" stroke="#e6f4fb" strokeWidth="4" />
      <rect x="24" y="130" width="132" height="156" rx="14" fill="#5aa9e6" fillOpacity={0.55} />
      <rect x="26" y={284 - settledH} width="128" height={settledH} rx="8" fill={s.color} />
      {Array.from({ length: specks }).map((_, i) => (
        <circle key={i} cx={50 + ((i * 37) % 80)} cy={140 + ((i * 23) % 60)} r="4" fill={s.color} />
      ))}
      <g style={{ transformOrigin: '90px 270px', animation: stirring ? 'sbspin .35s linear infinite' : undefined }}>
        <rect x="70" y="266" width="40" height="8" rx="4" fill="#fff" stroke="#556" />
      </g>
    </svg>
  );
}

function Pad({ x, y, onRub, active, hint }: { x: number; y: number; onRub: () => void; active: boolean; hint: boolean }) {
  const acc = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [fill, setFill] = useState(0);
  const pt = (e: React.PointerEvent) => {
    const r = (e.currentTarget.closest('[data-stage]') as HTMLElement).getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1280, y: ((e.clientY - r.top) / r.height) * 800 };
  };
  const end = () => { last.current = null; };
  return (
    <div
      style={{ position: 'absolute', left: x, top: y, width: 220, height: 90, touchAction: 'none', cursor: 'grab' }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); last.current = pt(e); }}
      onPointerMove={e => {
        if (!last.current) return;
        const p = pt(e);
        acc.current += Math.hypot(p.x - last.current.x, p.y - last.current.y);
        last.current = p;
        setFill(Math.min(1, acc.current / STIR_DIST));
        if (acc.current >= STIR_DIST) { acc.current = 0; setFill(0); onRub(); }
      }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
    >
      <svg width="220" height="90" viewBox="0 0 220 90">
        <rect x="6" y="30" width="208" height="54" rx="12" fill="#3b4256" stroke={active ? '#fde047' : '#8792ad'} strokeWidth="3" />
        <ellipse cx="110" cy="30" rx="70" ry="10" fill="#565f7a" />
        <rect x="24" y="66" width="172" height="8" rx="4" fill="#222735" />
        <rect x="24" y="66" width={172 * fill} height="8" rx="4" fill="#fde047" />
        {hint && (
          <g style={{ animation: 'sbnudge 1s ease-in-out infinite' }}>
            <path d="M70 46 Q110 8 150 46" fill="none" stroke="#fde047" strokeWidth="4" strokeLinecap="round" />
            <path d="M144 34 L152 48 L137 47 Z" fill="#fde047" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function SolubilityBottle({ targets, config, onDone }: InvestigateProps) {
  const subs = targets.filter(t => t.solubility);
  const [idx, setIdx] = useState(0);
  const [bottle, setBottle] = useState<Bottle>(newBottle);
  const [recs, setRecs] = useState<Record2[]>(() => subs.map(() => ({})));
  const [waste, setWaste] = useState(0);
  const [phase, setPhase] = useState<'work' | 'graph'>('work');
  const [dipped, setDipped] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [stirring, setStirring] = useState(false);
  const [scooped, setScooped] = useState(0);
  
  const s = subs[idx];
  const t0 = useRef(0);
  const lockUntil = useRef(0);
  const seconds = useRef(0);
  const doneRef = useRef(false);
  const stirTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { t0.current = performance.now(); lockUntil.current = t0.current + 700; }, []);

  const rec = recs[idx] ?? {};
  const subDone = rec.r20 !== undefined && rec.r60 !== undefined;
  const readyKey = `${idx}-${phase}`;
  const [readyFor, setReadyFor] = useState('');
  const showNext = (subDone || phase === 'graph') && readyFor === readyKey;

  useEffect(() => {
    if (!subDone && phase !== 'graph') return;
    lockUntil.current = performance.now() + 700;
    const id = setTimeout(() => setReadyFor(readyKey), 700);
    return () => clearTimeout(id);
  }, [subDone, phase, readyKey]);

  const busy = () => performance.now() < lockUntil.current || phase !== 'work' || rec.r60 !== undefined;

  const apply = (res: { bottle: Bottle; saturated: boolean }) => {
    setBottle(res.bottle);
    const temp = res.bottle.temp;
    const key = temp === 20 ? 'r20' : 'r60';
    if (res.saturated && rec[key] === undefined) {
      playSfx('correct');
      setRecs(rs => rs.map((r, i) => (i === idx ? { ...r, [key]: capacity(s, temp) } : r)));
    }
  };

  const scoop = () => {
    if (busy()) return;
    const r = addScoop(bottle);
    if (r.wasted) { setWaste(w => w + 1); playSfx('error'); }
    setBottle(r.bottle); setScooped(n => n + 1);
  };

  const stirOnce = () => {
    if (busy()) return;
    setStirring(true);
    if (stirTimer.current) clearTimeout(stirTimer.current);
    stirTimer.current = setTimeout(() => setStirring(false), 600);
    apply(stir(bottle, s));
  };

  const dip = () => {
    if (busy() || rec.r20 === undefined || dipped) return;
    setDipped(true);
    apply(warm(bottle, s));
  };

  const next = () => {
    if (performance.now() < lockUntil.current) return;
    if (phase === 'graph') {
      if (doneRef.current) return;
      doneRef.current = true;
      playSfx('success');
      onDone({ stars: solubilityStars(seconds.current, waste, config.parSec) });
      return;
    }
    if (rec.r60 === undefined) return;
    if (idx < subs.length - 1) {
      setIdx(idx + 1); setBottle(newBottle()); setDipped(false); setScooped(0);
    } else {
      seconds.current = (performance.now() - t0.current) / 1000;
      setPhase('graph');
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); if (phase === 'graph' || rec.r60 !== undefined) next(); else scoop(); }
      else if (k === 'Enter') { e.preventDefault(); if (phase === 'graph' || rec.r60 !== undefined) next(); else dip(); }
      else if (k === 's' || k === 'S') stirOnce();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const stagePt = (e: React.PointerEvent) => {
    const r = (e.currentTarget.closest('[data-stage]') as HTMLElement).getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1280, y: ((e.clientY - r.top) / r.height) * 800 };
  };
  const startDrag = (kind: Drag['kind'], ox: number, oy: number) => (e: React.PointerEvent) => {
    if (performance.now() < lockUntil.current || phase !== 'work') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = stagePt(e);
    setDrag({ kind, x: p.x, y: p.y, dx: ox - p.x, dy: oy - p.y });
  };
  const moveDrag = (e: React.PointerEvent) => { if (drag) { const p = stagePt(e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const endDrag = (drop: boolean) => (e: React.PointerEvent) => {
    if (!drag) return;
    const p = stagePt(e);
    if (drop) {
      if (drag.kind === 'spoon' && inRect(p.x, p.y, dipped ? { ...BEAKER, x: IN_BEAKER.x - 20 } : HOME)) scoop();
      if (drag.kind === 'bottle' && inRect(p.x, p.y, BEAKER, 60)) dip();
    }
    setDrag(null);
  };

  if (!s) return null;
  const home = drag?.kind === 'bottle' ? { x: drag.x + drag.dx, y: drag.y + drag.dy } : dipped ? IN_BEAKER : { x: HOME.x, y: HOME.y };
  const spoonPos = drag?.kind === 'spoon' ? { x: drag.x + drag.dx, y: drag.y + drag.dy } : SPOON_HOME;
  const canDip = rec.r20 !== undefined && !dipped;
  const total = bottle.dissolved + bottle.pending + bottle.settled;

  return (
    <div data-stage className="absolute inset-0 pointer-events-auto select-none overflow-hidden text-white"
      style={{ background: 'linear-gradient(160deg,#1c2b45,#101a2e)', touchAction: 'none' }}>
      <style>{`@keyframes sbspin{to{transform:rotate(360deg)}}@keyframes sbnudge{0%,100%{transform:translateX(-10px)}50%{transform:translateX(10px)}}@keyframes sbpulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>

      {phase === 'work' && (
        <>
          <div className="absolute left-8 top-6 text-3xl font-bold">{s.name} <span className="text-lg text-slate-300">{idx + 1}/{subs.length}</span></div>
          <div className="absolute left-8 top-[72px] flex gap-3">
            {([20, 60] as const).map(t => {
              const v = rec[t === 20 ? 'r20' : 'r60'];
              return (
                <div key={t} className="rounded-lg px-4 py-2 text-lg font-semibold"
                  style={{ background: v === undefined ? '#ffffff14' : '#16a34a', border: '2px solid #ffffff33' }}>
                  {t} ℃ · {v === undefined ? '?' : `${v.toFixed(1)} g`}
                </div>
              );
            })}
          </div>

          {/* 가루 통 + 약숟가락 */}
          <div className="absolute" style={{ left: 100, top: 470, width: 130, height: 120 }}>
            <div style={{ position: 'absolute', inset: 0, background: '#ffffff18', border: '3px solid #ffffff66', borderRadius: '10px 10px 24px 24px' }} />
            <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8, height: 60, background: s.color, borderRadius: '6px 6px 18px 18px' }} />
            <Icon s={s} size={130} />
            <div className="absolute -bottom-9 w-full text-center text-lg font-semibold">{s.name}</div>
          </div>
          <div
            style={{ position: 'absolute', left: spoonPos.x, top: spoonPos.y, width: 170, height: 130, touchAction: 'none', cursor: 'grab', zIndex: 20 }}
            onPointerDown={startDrag('spoon', SPOON_HOME.x, SPOON_HOME.y)} onPointerMove={moveDrag}
            onPointerUp={endDrag(true)} onPointerCancel={endDrag(false)} onLostPointerCapture={() => setDrag(null)}
          >
            <svg width="170" height="130" viewBox="0 0 170 130">
              <rect x="70" y="60" width="90" height="10" rx="5" fill="#cbd5e1" transform="rotate(-25 70 60)" />
              <ellipse cx="50" cy="80" rx="34" ry="20" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" />
              <ellipse cx="50" cy="74" rx="26" ry="10" fill={s.color} />
            </svg>
            {scooped === 0 && !drag && (
              <svg width="120" height="40" viewBox="0 0 120 40" style={{ position: 'absolute', left: 140, top: 40, animation: 'sbnudge 1s ease-in-out infinite' }}>
                <path d="M4 20 H90" stroke="#fde047" strokeWidth="6" strokeLinecap="round" />
                <path d="M84 6 L110 20 L84 34 Z" fill="#fde047" />
              </svg>
            )}
          </div>

          {/* 병 놓는 자리 강조 */}
          {drag?.kind === 'spoon' && (
            <div style={{ position: 'absolute', left: (dipped ? IN_BEAKER.x : HOME.x) - 10, top: HOME.y - 10, width: HOME.w + 20, height: HOME.h + 20, border: '4px dashed #fde047', borderRadius: 24, animation: 'sbpulse .8s infinite' }} />
          )}

          {/* 60 ℃ 물 비커 */}
          <div style={{ position: 'absolute', left: BEAKER.x, top: BEAKER.y, width: BEAKER.w, height: BEAKER.h }}>
            <svg width={BEAKER.w} height={BEAKER.h} viewBox="0 0 260 290">
              <rect x="10" y="60" width="240" height="220" rx="14" fill="#f97316" fillOpacity=".32" stroke="#ffd7b0" strokeWidth="5" />
              <rect x="14" y="90" width="232" height="186" rx="10" fill="#fb923c" fillOpacity=".5" />
              {[60, 120, 190].map((cx, i) => (
                <path key={i} d={`M${cx} 50 q-10 -16 0 -30 q10 -14 0 -28`} fill="none" stroke="#ffffff88" strokeWidth="4" strokeLinecap="round" style={{ animation: `sbpulse ${1.2 + i * 0.3}s infinite` }} />
              ))}
            </svg>
            <div className="absolute bottom-3 w-full text-center text-2xl font-bold">60 ℃</div>
          </div>
          {canDip && !drag && (
            <svg width="120" height="50" viewBox="0 0 120 50" style={{ position: 'absolute', left: 620, top: 400, animation: 'sbnudge 1s ease-in-out infinite' }}>
              <path d="M4 25 H90" stroke="#fde047" strokeWidth="6" strokeLinecap="round" />
              <path d="M84 10 L112 25 L84 40 Z" fill="#fde047" />
            </svg>
          )}
          {canDip && drag?.kind === 'bottle' && (
            <div style={{ position: 'absolute', left: BEAKER.x - 10, top: BEAKER.y - 10, width: BEAKER.w + 20, height: BEAKER.h + 20, border: '4px dashed #fde047', borderRadius: 24, animation: 'sbpulse .8s infinite' }} />
          )}

          {/* 병 */}
          <BottleView b={bottle} s={s} stirring={stirring} x={home.x} y={home.y} />
          <div
            style={{ position: 'absolute', left: home.x, top: home.y, width: HOME.w, height: HOME.h, touchAction: 'none', cursor: canDip ? 'grab' : 'default', zIndex: 15 }}
            onPointerDown={canDip ? startDrag('bottle', HOME.x, HOME.y) : undefined} onPointerMove={moveDrag}
            onPointerUp={endDrag(true)} onPointerCancel={endDrag(false)} onLostPointerCapture={() => setDrag(null)}
          />
          <div className="absolute text-center text-xl font-semibold" style={{ left: HOME.x, top: HOME.y + HOME.h + 100, width: HOME.w + 40 }}>
            <span className="text-slate-300">넣은 양</span> {total.toFixed(1)} g · <span className="text-slate-300">녹은 양</span> {bottle.dissolved.toFixed(1)} g
          </div>

          {/* 자석 젓개 판 (병 아래, 비커 아래) */}
          <Pad x={HOME.x - 20} y={HOME.y + HOME.h + 6} onRub={stirOnce} active={stirring} hint={bottle.pending > 0} />
          <Pad x={BEAKER.x + 20} y={BEAKER.y + BEAKER.h + 6} onRub={stirOnce} active={stirring} hint={dipped && bottle.pending > 0} />

          <div className="absolute bottom-3 left-8 text-base text-slate-400">Space 넣기 · S 젓기 · Enter 담그기</div>
        </>
      )}

      {phase === 'graph' && <Graph subs={subs} recs={recs} />}

      {showNext && (
        <button className="absolute right-8 bottom-8 rounded-xl bg-emerald-500 px-8 py-4 text-2xl font-bold text-white shadow-lg"
          onClick={e => { e.currentTarget.blur(); next(); }}>
          {phase === 'graph' ? '다음' : idx < subs.length - 1 ? '다음 물질' : '결과 보기'}
        </button>
      )}
    </div>
  );
}

function Graph({ subs, recs }: { subs: Substance[]; recs: Record2[] }) {
  const W = 760, H = 460, L = 80, B = 50, T = 20, R = 20;
  const ymax = 180;
  const X = (t: number) => L + (t / 80) * (W - L - R);
  const Y = (g: number) => H - B - (g / ymax) * (H - B - T);
  const winner = biggestGain(subs.map((sb, i) => ({ name: sb.name, r20: recs[i].r20 ?? 0, r60: recs[i].r60 ?? 0 })));
  return (
    <div className="absolute inset-0 flex flex-col items-center pt-8">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="rounded-xl" style={{ background: '#ffffff10' }}>
        {[0, 20, 40, 60, 80].map(t => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={T} y2={H - B} stroke="#ffffff22" />
            <text x={X(t)} y={H - B + 24} textAnchor="middle" fill="#cbd5e1" fontSize="18">{t}</text>
          </g>
        ))}
        {[0, 50, 100, 150].map(g => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="#ffffff22" />
            <text x={L - 10} y={Y(g) + 6} textAnchor="end" fill="#cbd5e1" fontSize="18">{g}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 8} textAnchor="middle" fill="#e2e8f0" fontSize="18">온도 (℃)</text>
        <text x={14} y={T + 10} fill="#e2e8f0" fontSize="16">용해도 (g/물 100 g)</text>
        {subs.map((sb, i) => {
          const pts = Array.from({ length: 41 }, (_, k) => k * 2);
          const d = pts.map((t, k) => `${k ? 'L' : 'M'}${X(t)} ${Y(solubilityAt(sb, t))}`).join(' ');
          return (
            <g key={sb.id}>
              <path d={d} fill="none" stroke={COLORS[i]} strokeWidth="4" />
              <text x={X(80) - 6} y={Y(solubilityAt(sb, 80)) - 12} textAnchor="end" fill={COLORS[i]} fontSize="20" fontWeight="700">{sb.name}</text>
              {([20, 60] as const).map(t => {
                const v = recs[i][t === 20 ? 'r20' : 'r60'] ?? 0;
                return <circle key={t} cx={X(t)} cy={Y(v * 10)} r="9" fill={COLORS[i]} stroke="#fff" strokeWidth="3" />;
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-6 text-3xl font-bold" style={{ wordBreak: 'keep-all' }}>온도에 따른 용해도 차가 큰 것 = {winner}</div>
    </div>
  );
}
