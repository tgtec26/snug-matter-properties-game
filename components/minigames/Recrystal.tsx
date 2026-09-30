'use client';

import { StageBg } from '@/components/ui';
import { useEffect, useRef, useState } from 'react';
import type { SeparateProps } from '@/game/minigameTypes';
import type { Substance } from '@/game/types';
import { playSfx } from '@/game/audio';
import { solubilityAt } from '@/game/rules';
import {
  allDissolved, capAt, defaultCfg, filterResult, initSim, pointG, recrystalStars, solidLeft, step,
  type Sim,
} from '@/game/minigames/recrystal';

type Phase = 'heat' | 'cooling' | 'cooled' | 'pour' | 'result';
type Rect = { x: number; y: number; w: number; h: number };
const B0 = { x: 150, y: 350 };            // 가열대 위 비커
const BW = 220, BH = 270;
const ICE: Rect = { x: 440, y: 470, w: 290, h: 240 };
const IN_ICE = { x: 475, y: 415 };
const FUN: Rect = { x: 890, y: 380, w: 240, h: 170 };
const COLORS = ['#f59e0b', '#38bdf8'];
const inRect = (px: number, py: number, r: Rect, m = 40) => px > r.x - m && px < r.x + r.w + m && py > r.y - m && py < r.y + r.h + m;
const stagePt = (e: React.PointerEvent) => {
  const r = (e.currentTarget.closest('[data-stage]') as HTMLElement).getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 1280, y: ((e.clientY - r.top) / r.height) * 800 };
};

function Arrow({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <svg width="110" height="44" viewBox="0 0 110 44" style={{ position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg)`, animation: 'rcnudge 1s ease-in-out infinite', pointerEvents: 'none' }}>
      <path d="M4 22 H80" stroke="#fde047" strokeWidth="6" strokeLinecap="round" />
      <path d="M74 6 L104 22 L74 38 Z" fill="#fde047" />
    </svg>
  );
}

function Beaker({ sim, subs, x, y, tilt, rod }: { sim: Sim; subs: Substance[]; x: number; y: number; tilt: number; rod: number }) {
  return (
    <svg width={BW} height={BH} viewBox={`0 0 ${BW} ${BH}`} style={{ position: 'absolute', left: x, top: y, transform: `rotate(${tilt}deg)`, transformOrigin: '50% 90%', pointerEvents: 'none', transition: 'transform .5s' }}>
      <rect x="10" y="30" width="200" height="232" rx="12" fill="#cfe9f7" fillOpacity=".2" stroke="#e6f4fb" strokeWidth="5" />
      <rect x="14" y="110" width="192" height="148" rx="8" fill="#5aa9e6" fillOpacity=".5" />
      {subs.map((s, i) => (
        <g key={s.id}>
          {Array.from({ length: Math.ceil(solidLeft(sim, i) * 3) }).map((_, k) => (
            <circle key={k} cx={30 + ((k * 41 + i * 17) % 150)} cy={240 - ((k * 13 + i * 7) % 22)} r="5" fill={i === 0 ? '#f4f1ea' : '#b8c4cc'} />
          ))}
          {Array.from({ length: Math.ceil(sim.crystal[i] * 3) }).map((_, k) => (
            <path key={k} d={`M${28 + ((k * 37) % 150)} ${246 - ((k * 11) % 26)} l7 -12 l7 12 l-7 12 z`} fill="#eef7ff" stroke="#9cc7e8" strokeWidth="1.5" />
          ))}
        </g>
      ))}
      <g style={{ transform: `rotate(${rod}deg)`, transformOrigin: '110px 30px' }}>
        <rect x="104" y="-40" width="12" height="230" rx="6" fill="#dbeafe" fillOpacity=".9" stroke="#93c5fd" strokeWidth="2" />
      </g>
    </svg>
  );
}

function Graph({ sim, subs, cfg }: { sim: Sim; subs: Substance[]; cfg: ReturnType<typeof defaultCfg> }) {
  const W = 540, H = 300, L = 56, Bt = 38, T = 14, R = 14, ymax = 180;
  const X = (t: number) => L + (t / 80) * (W - L - R);
  const Y = (g: number) => H - Bt - (Math.min(g, ymax) / ymax) * (H - Bt - T);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute rounded-xl" style={{ left: 700, top: 80, background: '#ffffff12' }}>
      {[0, 20, 40, 60, 80].map(t => (<g key={t}><line x1={X(t)} x2={X(t)} y1={T} y2={H - Bt} stroke="#ffffff22" /><text x={X(t)} y={H - Bt + 20} textAnchor="middle" fill="#cbd5e1" fontSize="15">{t}</text></g>))}
      {[0, 50, 100, 150].map(g => (<g key={g}><line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="#ffffff22" /><text x={L - 8} y={Y(g) + 5} textAnchor="end" fill="#cbd5e1" fontSize="15">{g}</text></g>))}
      <text x={W / 2} y={H - 6} textAnchor="middle" fill="#e2e8f0" fontSize="15">온도 (℃)</text>
      <text x={8} y={T + 12} fill="#e2e8f0" fontSize="13">g / 물 100 g</text>
      <line x1={X(sim.temp)} x2={X(sim.temp)} y1={T} y2={H - Bt} stroke="#fff" strokeOpacity=".5" strokeDasharray="5 4" />
      {subs.map((s, i) => {
        const d = Array.from({ length: 41 }, (_, k) => `${k ? 'L' : 'M'}${X(k * 2)} ${Y(solubilityAt(s, k * 2))}`).join(' ');
        const py = pointG(sim, i, cfg);
        const under = py <= (capAt(s, sim.temp, cfg.waterG) * 100) / cfg.waterG + 0.01;
        return (
          <g key={s.id}>
            <path d={d} fill="none" stroke={COLORS[i]} strokeWidth="4" />
            <text x={X(80) - 4} y={Y(solubilityAt(s, 80)) - 10} textAnchor="end" fill={COLORS[i]} fontSize="16" fontWeight="700">{s.name}</text>
            <circle cx={X(sim.temp)} cy={Y(py)} r="9" fill={under ? COLORS[i] : '#0f172a'} stroke={under ? '#fff' : '#ef4444'} strokeWidth="4" />
          </g>
        );
      })}
    </svg>
  );
}

export function Recrystal({ mixture, obtains, leaves, config, onDone }: SeparateProps) {
  const cfg = defaultCfg(config);
  const subs = mixture;
  const ti = Math.max(0, subs.findIndex(s => s.id === obtains[0]?.id));
  const totals = subs.map((_, i) => (i === ti ? (config.targetG ?? 10) : (config.otherG ?? 2)));
  const [sim, setSim] = useState<Sim>(() => initSim(totals));
  const [phase, setPhase] = useState<Phase>('heat');
  const [drag, setDrag] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [rod, setRod] = useState(0);
  const [wash, setWash] = useState(0);
  const [heated, setHeated] = useState(false);
  const [readyFor, setReadyFor] = useState(-1);
  const [run, setRun] = useState(0);
  const [heatUI, setHeatUI] = useState(false);

  const simRef = useRef(sim);
  const heatHeld = useRef(false);
  const stirLevel = useRef(0);
  const announced = useRef(false);
  const lockUntil = useRef(0);
  const doneRef = useRef(false);
  const rodLast = useRef<{ x: number; y: number } | null>(null);
  const cfgRef = useRef(cfg);
  const subsRef = useRef(subs);

  useEffect(() => { lockUntil.current = performance.now() + 700; }, []);

  // 시뮬레이션 루프
  useEffect(() => {
    let raf = 0, last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (phase === 'heat' || phase === 'cooling') {
        stirLevel.current = Math.max(0, stirLevel.current - 1.5 * dt);
        const heating = phase === 'heat' && heatHeld.current;
        simRef.current = step(simRef.current, dt, { heating, cooling: phase === 'cooling', stir: Math.min(1, stirLevel.current) }, subsRef.current, cfgRef.current);
        setSim(simRef.current);
        if (heating) setHeated(true);
        if (phase === 'heat' && !announced.current && allDissolved(simRef.current)) { announced.current = true; playSfx('correct'); }
        if (phase === 'cooling' && simRef.current.temp <= cfgRef.current.iceTemp + 0.01) { setPhase('cooled'); playSfx('correct'); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'pour') return;
    const id = setTimeout(() => { lockUntil.current = performance.now() + 700; setPhase('result'); }, 1400);
    return () => clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'result') return;
    const id = setTimeout(() => setReadyFor(run), 700);
    return () => clearTimeout(id);
  }, [phase, run]);

  const setHeat = (v: boolean) => { heatHeld.current = v; setHeatUI(v); };
  const locked = () => performance.now() < lockUntil.current;
  const dissolvedAll = allDissolved(sim);
  const fr = filterResult(sim, ti, wash / 3, cfg);

  const toIce = () => { if (phase === 'heat' && !locked()) { setHeat(false); setPhase('cooling'); } };
  const toFilter = () => { if (phase === 'cooled' && !locked()) setPhase('pour'); };
  const doWash = () => { if (phase === 'result' && wash < 3) { setWash(wash + 1); playSfx('correct'); } };
  const retry = () => {
    if (locked()) return;
    simRef.current = initSim(totals); setSim(simRef.current);
    announced.current = false; stirLevel.current = 0; setHeated(false);
    setWash(0); setPhase('heat'); setReadyFor(-1); setRun(r => r + 1);
    lockUntil.current = performance.now() + 700;
  };
  const finish = () => {
    if (locked() || doneRef.current) return;
    doneRef.current = true;
    const stars = recrystalStars(fr);
    playSfx(stars > 0 ? 'success' : 'error');
    onDone({ stars, purity: fr.purity });
  };
  const showNext = phase === 'result' && readyFor === run;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (phase === 'heat' && !locked()) setHeat(true);
        else if (phase === 'result' && showNext) finish();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'heat') toIce(); else if (phase === 'cooled') toFilter(); else if (showNext) finish();
      } else if ((e.key === 's' || e.key === 'S') && phase === 'heat' && !locked()) stirLevel.current = Math.min(1, stirLevel.current + 0.5);
      else if ((e.key === 'w' || e.key === 'W')) doWash();
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ') setHeat(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  const draggable = (phase === 'heat' || phase === 'cooled');
  const onBeakerDown = (e: React.PointerEvent) => {
    if (!draggable || locked()) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setHeat(false);
    const p = stagePt(e);
    const o = phase === 'heat' ? B0 : IN_ICE;
    setDrag({ x: p.x, y: p.y, dx: o.x - p.x, dy: o.y - p.y });
  };
  const onBeakerMove = (e: React.PointerEvent) => { if (drag) { const p = stagePt(e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const onBeakerUp = (drop: boolean) => (e: React.PointerEvent) => {
    if (!drag) return;
    const p = stagePt(e);
    setDrag(null);
    if (!drop) return;
    if (phase === 'heat' && inRect(p.x, p.y, ICE)) toIce();
    else if (phase === 'cooled' && inRect(p.x, p.y, FUN)) toFilter();
  };

  const bpos = drag ? { x: drag.x + drag.dx, y: drag.y + drag.dy }
    : phase === 'heat' ? B0 : phase === 'cooling' || phase === 'cooled' ? IN_ICE : { x: FUN.x + 20, y: FUN.y - 190 };
  const tilt = phase === 'pour' || phase === 'result' ? 70 : 0;

  return (
    <div data-stage className="absolute inset-0 pointer-events-auto select-none overflow-hidden text-white"
      style={{ background: 'linear-gradient(160deg,#1c2b45,#101a2e)', touchAction: 'none' }}>
      <StageBg name="labheat" dark={0.5} />
      <style>{`@keyframes rcnudge{0%,100%{translate:-10px 0}50%{translate:10px 0}}@keyframes rcpulse{0%,100%{opacity:.4}50%{opacity:1}}@keyframes rcflame{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.25)}}`}</style>

      <Graph sim={sim} subs={subs} cfg={cfg} />

      {/* 온도 게이지 */}
      <div className="absolute" style={{ left: 60, top: 350, width: 40, height: 270 }}>
        <div style={{ position: 'absolute', inset: 0, background: '#ffffff18', border: '3px solid #ffffff66', borderRadius: 20 }} />
        <div style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: `${Math.max(2, (sim.temp / cfg.maxTemp) * 100)}%`, maxHeight: 258, background: 'linear-gradient(#ef4444,#f59e0b)', borderRadius: 14 }} />
        <div className="absolute w-[100px] text-center text-2xl font-bold" style={{ left: -30, top: -42 }}>{Math.round(sim.temp)} ℃</div>
      </div>

      {/* 가열 (길게 누르기) */}
      <div
        style={{ position: 'absolute', left: 120, top: 630, width: 300, height: 130, touchAction: 'none', cursor: phase === 'heat' ? 'pointer' : 'default' }}
        onPointerDown={e => { if (phase === 'heat' && !locked()) { e.currentTarget.setPointerCapture(e.pointerId); setHeat(true); } }}
        onPointerUp={() => setHeat(false)} onPointerCancel={() => setHeat(false)} onLostPointerCapture={() => setHeat(false)}
      >
        <svg width="300" height="130" viewBox="0 0 300 130">
          <rect x="40" y="10" width="220" height="14" rx="4" fill="#94a3b8" />
          <rect x="60" y="24" width="8" height="70" fill="#94a3b8" /><rect x="232" y="24" width="8" height="70" fill="#94a3b8" />
          <rect x="90" y="70" width="120" height="50" rx="12" fill="#475569" stroke="#cbd5e1" strokeWidth="3" />
          <rect x="140" y="56" width="20" height="16" fill="#cbd5e1" />
          {phase === 'heat' && (
            <path d="M150 12 q-26 20 -6 40 q6 -10 6 -14 q0 10 10 14 q20 -18 -10 -40z" fill="#f97316" stroke="#fde047" strokeWidth="3"
              style={{ transformOrigin: '150px 52px', animation: 'rcflame .3s infinite', opacity: heatUI ? 1 : 0.35 }} />
          )}
        </svg>
      </div>
      {phase === 'heat' && !heated && <Arrow x={280} y={660} rot={0} />}

      {/* 유리 막대 (문지르기) */}
      {phase === 'heat' && (
        <div
          style={{ position: 'absolute', left: 390, top: 340, width: 110, height: 280, touchAction: 'none', cursor: 'grab' }}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); rodLast.current = stagePt(e); }}
          onPointerMove={e => {
            if (!rodLast.current) return;
            const p = stagePt(e);
            const d = Math.hypot(p.x - rodLast.current.x, p.y - rodLast.current.y);
            stirLevel.current = Math.min(1, stirLevel.current + d / 500);
            setRod(Math.max(-14, Math.min(14, (p.x - rodLast.current.x) * 2 + (Math.random() - 0.5) * 6)));
            rodLast.current = p;
          }}
          onPointerUp={() => { rodLast.current = null; setRod(0); }} onPointerCancel={() => { rodLast.current = null; setRod(0); }} onLostPointerCapture={() => { rodLast.current = null; setRod(0); }}
        >
          <svg width="110" height="280" viewBox="0 0 110 280">
            <rect x="46" y="20" width="18" height="250" rx="9" fill="#dbeafe" stroke="#93c5fd" strokeWidth="3" />
            <path d="M20 150 Q55 110 90 150" fill="none" stroke="#fde047" strokeWidth="4" strokeLinecap="round" opacity={solidLeft(sim, 0) + solidLeft(sim, 1) > 0.01 && heated ? 0.9 : 0} />
          </svg>
        </div>
      )}

      {/* 얼음 비커 */}
      <div style={{ position: 'absolute', left: ICE.x, top: ICE.y, width: ICE.w, height: ICE.h }}>
        <svg width={ICE.w} height={ICE.h} viewBox="0 0 290 240">
          <rect x="6" y="6" width="278" height="230" rx="16" fill="#7dd3fc" fillOpacity=".25" stroke="#bae6fd" strokeWidth="5" />
          {[[30, 30], [100, 24], [180, 34], [235, 26], [60, 90], [200, 100]].map(([cx, cy], i) => (
            <rect key={i} x={cx} y={cy} width="44" height="38" rx="6" fill="#e0f2fe" fillOpacity=".8" stroke="#7dd3fc" strokeWidth="2" transform={`rotate(${i * 13} ${cx + 22} ${cy + 19})`} />
          ))}
        </svg>
        <div className="absolute bottom-2 w-full text-center text-lg font-bold">얼음물</div>
      </div>
      {phase === 'heat' && dissolvedAll && !drag && <Arrow x={330 + 60} y={520} rot={10} />}
      {phase === 'heat' && drag && <div style={{ position: 'absolute', left: ICE.x - 10, top: ICE.y - 10, width: ICE.w + 20, height: ICE.h + 20, border: '4px dashed #fde047', borderRadius: 24, animation: 'rcpulse .8s infinite' }} />}

      {/* 거름 장치 */}
      <div style={{ position: 'absolute', left: FUN.x, top: FUN.y, width: FUN.w, height: FUN.h }}>
        <svg width={FUN.w} height={FUN.h + 200} viewBox={`0 0 ${FUN.w} ${FUN.h + 200}`}>
          <path d="M10 20 L230 20 L140 120 L140 170 L100 170 L100 120 Z" fill="#cfe9f7" fillOpacity=".25" stroke="#e6f4fb" strokeWidth="5" />
          <path d="M40 24 L200 24 L120 104 Z" fill="#fffbe8" stroke="#d6c9a0" strokeWidth="3" />
          {phase === 'result' && Array.from({ length: Math.ceil(fr.crystalG * 2.5) }).map((_, k) => (
            <path key={k} d={`M${70 + ((k * 23) % 80)} ${44 + ((k * 7) % 22)} l6 -10 l6 10 l-6 10 z`} fill={fr.otherOnPaperG > 0.3 && k % 5 === 0 ? '#b8c4cc' : '#eef7ff'} stroke="#9cc7e8" strokeWidth="1.5" />
          ))}
          <rect x="30" y="230" width="180" height="150" rx="14" fill="#cfe9f7" fillOpacity=".2" stroke="#e6f4fb" strokeWidth="5" />
          {(phase === 'pour' || phase === 'result') && <rect x="34" y={phase === 'result' ? 290 : 350} width="172" height={phase === 'result' ? 86 : 26} rx="8" fill="#5aa9e6" fillOpacity=".55" style={{ transition: 'all 1.2s' }} />}
        </svg>
        {phase === 'result' && <div className="absolute w-full text-center text-lg font-bold" style={{ top: FUN.h + 215 }}>{leaves[0]?.name} 용액</div>}
      </div>
      {phase === 'cooled' && !drag && <Arrow x={760} y={520} rot={-15} />}
      {phase === 'cooled' && drag && <div style={{ position: 'absolute', left: FUN.x - 10, top: FUN.y - 10, width: FUN.w + 20, height: FUN.h + 20, border: '4px dashed #fde047', borderRadius: 24, animation: 'rcpulse .8s infinite' }} />}

      {/* 비커 */}
      <Beaker sim={sim} subs={subs} x={bpos.x} y={bpos.y} tilt={tilt} rod={phase === 'heat' ? rod : 0} />
      {draggable && (
        <div style={{ position: 'absolute', left: bpos.x, top: bpos.y, width: BW, height: BH, touchAction: 'none', cursor: 'grab', zIndex: 10 }}
          onPointerDown={onBeakerDown} onPointerMove={onBeakerMove} onPointerUp={onBeakerUp(true)} onPointerCancel={onBeakerUp(false)} onLostPointerCapture={() => setDrag(null)} />
      )}
      {phase === 'heat' && dissolvedAll && <div className="absolute rounded-lg bg-emerald-600 px-4 py-1 text-xl font-bold" style={{ left: B0.x + 40, top: B0.y - 46 }}>모두 녹음</div>}
      {phase === 'cooling' && <div className="absolute rounded-lg bg-sky-700 px-4 py-1 text-xl font-bold" style={{ left: IN_ICE.x + 60, top: IN_ICE.y - 40 }}>석출</div>}

      {/* 증류수로 씻기 + 결과 */}
      {phase === 'result' && (
        <>
          <button className="absolute rounded-xl border-2 border-sky-300 bg-sky-500/30 px-5 py-3 text-xl font-bold"
            style={{ left: 1150, top: 400, animation: wash === 0 ? 'rcpulse .9s infinite' : undefined }}
            onClick={e => { e.currentTarget.blur(); doWash(); }}>증류수 {wash}/3</button>
        </>
      )}
      {phase === 'result' && (
        <div className="absolute rounded-xl bg-black/50 px-6 py-3 text-2xl font-bold" style={{ left: 40, top: 60, width: 620 }}>
          거름종이 위 {obtains[0]?.name} {fr.crystalG.toFixed(1)} g · 순도 {Math.round(fr.purity * 100)} %
        </div>
      )}
      {showNext && (
        <div className="absolute left-8 bottom-14 flex gap-4">
          <button className="rounded-xl bg-slate-600 px-6 py-4 text-2xl font-bold" onClick={e => { e.currentTarget.blur(); retry(); }}>다시 하기</button>
          <button className="rounded-xl bg-emerald-500 px-8 py-4 text-2xl font-bold" onClick={e => { e.currentTarget.blur(); finish(); }}>다음</button>
        </div>
      )}
      <div className="absolute bottom-3 left-8 text-base text-slate-400">Space 가열 · S 젓기 · Enter 옮기기 · W 씻기</div>
    </div>
  );
}
