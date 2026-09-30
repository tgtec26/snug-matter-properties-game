'use client';

import { GlassG, StageBg } from '@/components/ui';
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

function Beaker({ sim, subs, x, y, tilt, rod, drain }: { sim: Sim; subs: Substance[]; x: number; y: number; tilt: number; rod: number; drain: boolean }) {
  return (
    <svg width={BW} height={BH} viewBox={`0 0 ${BW} ${BH}`} style={{ position: 'absolute', left: x, top: y, transform: `rotate(${tilt}deg)`, transformOrigin: '96% 6%', pointerEvents: 'none', transition: 'transform .5s' }}>
      <g transform={`translate(${BW} 0) scale(-1 1)`}>
      <GlassG name="beaker-l" x={4} y={14} w={212} h={252}>
        {/* 물은 비커가 기울어도 수평을 유지하고(반대로 돌림), 따르는 동안 줄어든다 */}
        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '110px 190px', transition: 'transform .5s' }}>
          <rect x="-200" width="620" fill="#5aa9e6" fillOpacity=".55" style={{ y: drain ? 300 : 110, height: drain ? 0 : 300, transition: 'y 1.2s ease-in, height 1.2s ease-in' }} />
        {subs.map((s, i) => (
          <g key={s.id}>
            {Array.from({ length: Math.ceil(solidLeft(sim, i) * 3) }).map((_, k) => (
              <circle key={k} cx={34 + ((k * 41 + i * 17) % 150)} cy={240 - ((k * 13 + i * 7) % 22)} r="5" fill={i === 0 ? '#f4f1ea' : '#b8c4cc'} />
            ))}
            {Array.from({ length: Math.ceil(sim.crystal[i] * 3) }).map((_, k) => (
              <path key={k} d={`M${32 + ((k * 37) % 150)} ${246 - ((k * 11) % 26)} l7 -12 l7 12 l-7 12 z`} fill="#eef7ff" stroke="#9cc7e8" strokeWidth="1.5" />
            ))}
          </g>
        ))}
        </g>
      </GlassG>
      <g style={{ transform: `rotate(${rod}deg)`, transformOrigin: '110px 30px' }}>
        <rect x="104" y="-40" width="12" height="230" rx="6" fill="#dbeafe" fillOpacity=".9" stroke="#93c5fd" strokeWidth="2" />
      </g>
    </g>
    </svg>
  );
}

function Graph({ sim, subs, cfg }: { sim: Sim; subs: Substance[]; cfg: ReturnType<typeof defaultCfg> }) {
  const W = 540, H = 300, L = 56, Bt = 38, T = 14, R = 14, ymax = 180;
  const X = (t: number) => L + (t / 80) * (W - L - R);
  const Y = (g: number) => H - Bt - (Math.min(g, ymax) / ymax) * (H - Bt - T);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute rounded-xl" style={{ left: 700, top: 80, background: 'rgba(14,28,42,.92)' }}>
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
    : phase === 'heat' ? B0 : phase === 'cooling' || phase === 'cooled' ? IN_ICE : { x: FUN.x - 81, y: FUN.y - 40 };
  const tilt = phase === 'pour' || phase === 'result' ? 72 : 0;

  return (
    <div data-stage className="absolute inset-0 pointer-events-auto select-none overflow-hidden text-white"
      style={{ background: 'linear-gradient(160deg,#1c2b45,#101a2e)', touchAction: 'none' }}>
      <StageBg name="labheat" dark={0.5} />
      <style>{`@keyframes rcnudge{0%,100%{translate:-10px 0}50%{translate:10px 0}}@keyframes rcstream{to{stroke-dashoffset:-16}}@keyframes rcpulse{0%,100%{opacity:.4}50%{opacity:1}}@keyframes rcflame{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.25)}}`}</style>

      <div className="absolute inset-0 pointer-events-none transition-opacity duration-500" style={{ opacity: phase === 'pour' || phase === 'result' ? 0 : 1 }}><Graph sim={sim} subs={subs} cfg={cfg} /></div>

      {/* 온도 게이지 */}
      <div className="absolute" style={{ left: 60, top: 350, width: 40, height: 270 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,28,42,.9)', border: '3px solid rgba(255,255,255,.5)', borderRadius: 20 }} />
        <div style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: `${Math.max(2, (sim.temp / cfg.maxTemp) * 100)}%`, maxHeight: 258, background: 'linear-gradient(#ef4444,#f59e0b)', borderRadius: 14 }} />
        <div className="absolute w-[100px] text-center text-2xl font-bold" style={{ left: -30, top: -42 }}>{Math.round(sim.temp)} ℃</div>
      </div>

      {/* 가열 (길게 누르기) */}
      <div
        style={{ position: 'absolute', left: 120, top: 630, width: 300, height: 130, touchAction: 'none', cursor: phase === 'heat' ? 'pointer' : 'default' }}
        onPointerDown={e => { if (phase === 'heat' && !locked()) { e.currentTarget.setPointerCapture(e.pointerId); setHeat(true); } }}
        onPointerUp={() => setHeat(false)} onPointerCancel={() => setHeat(false)} onLostPointerCapture={() => setHeat(false)}
      >
        <svg width="300" height="130" viewBox="0 0 300 130" style={{ overflow: 'visible' }}>
          {phase === 'heat' && <ellipse cx="150" cy="-18" rx="90" ry="12" fill="#ff8a3c" style={{ animation: 'rcflame .4s infinite', opacity: heatUI ? 0.95 : 0.3 }} />}
          <image href="/assets/items/hotplate.webp" x="20" y="-62" width="260" height="163" pointerEvents="none" />
        </svg>
      </div>
      {phase === 'heat' && !heated && <Arrow x={280} y={660} rot={0} />}

      {/* 유리 막대 (누르면 젓기) */}
      {phase === 'heat' && (
        <div
          style={{ position: 'absolute', left: 390, top: 340, width: 110, height: 280, touchAction: 'manipulation', cursor: 'pointer' }}
          onClick={() => { if (locked()) return; stirLevel.current = Math.min(1, stirLevel.current + 0.5); setRod(12); setTimeout(() => setRod(-12), 120); setTimeout(() => setRod(0), 240); }}
        >
          <svg width="110" height="280" viewBox="0 0 110 280">
            <rect x="46" y="20" width="18" height="250" rx="9" fill="#dbeafe" stroke="#93c5fd" strokeWidth="3" />
            <path d="M20 150 Q55 110 90 150" fill="none" stroke="#fde047" strokeWidth="4" strokeLinecap="round" opacity={solidLeft(sim, 0) + solidLeft(sim, 1) > 0.01 && heated ? 0.9 : 0} />
          </svg>
        {heated && solidLeft(sim, 0) + solidLeft(sim, 1) > 0.01 && <div className="absolute left-1/2 -translate-x-1/2 -top-9 whitespace-nowrap rounded-lg bg-black/70 px-3 py-0.5 text-[20px] font-bold text-amber-200">눌러서 젓기</div>}
        </div>
      )}

      {/* 얼음 비커 */}
      <div style={{ position: 'absolute', left: ICE.x, top: ICE.y, width: ICE.w, height: ICE.h }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/items/icebucket.webp" alt="" draggable={false} style={{ position: 'absolute', left: 0, top: 0, width: ICE.w, pointerEvents: 'none' }} />
        <div className="absolute w-full text-center text-2xl font-black" style={{ bottom: -40, color: '#fff', textShadow: '0 0 6px #000, 0 2px 4px #000' }}>얼음물</div>
      </div>
      {phase === 'heat' && dissolvedAll && !drag && <Arrow x={330 + 60} y={520} rot={10} />}
      {phase === 'heat' && drag && <div style={{ position: 'absolute', left: ICE.x - 10, top: ICE.y - 10, width: ICE.w + 20, height: ICE.h + 20, border: '4px dashed #fde047', borderRadius: 24, animation: 'rcpulse .8s infinite' }} />}

      {/* 거름 장치 */}
      <div style={{ position: 'absolute', left: FUN.x, top: FUN.y, width: FUN.w, height: FUN.h }}>
        <svg width={FUN.w} height={FUN.h + 200} viewBox={`0 0 ${FUN.w} ${FUN.h + 200}`}>
          <GlassG name="filterfunnel" x={20} y={0} w={200} h={270}>
            <polygon points="34,8 206,8 122,110" fill="#fff6dc" />
            {phase === 'result' && Array.from({ length: Math.ceil(fr.crystalG * 2.5) }).map((_, k) => (
              <path key={k} d={`M${86 + ((k * 23) % 60)} ${30 + ((k * 7) % 30)} l6 -10 l6 10 l-6 10 z`} fill={fr.otherOnPaperG > 0.3 && k % 5 === 0 ? '#b8c4cc' : '#eef7ff'} stroke="#9cc7e8" strokeWidth="1.5" />
            ))}
          </GlassG>
          <GlassG name="beaker-s" x={40} y={226} w={160} h={150}>
            {(phase === 'pour' || phase === 'result') && <rect x="40" y={phase === 'result' ? 296 : 350} width="170" height={phase === 'result' ? 80 : 26} fill="#5aa9e6" fillOpacity=".7" style={{ transition: 'all 1.2s' }} />}
          </GlassG>
        </svg>
        {phase === 'result' && <div className="absolute w-full text-center text-lg font-bold" style={{ top: FUN.h + 215 }}>{leaves[0]?.name} 용액</div>}
      </div>
      {phase === 'cooled' && !drag && <Arrow x={760} y={520} rot={-15} />}
      {phase === 'cooled' && drag && <div style={{ position: 'absolute', left: FUN.x - 10, top: FUN.y - 10, width: FUN.w + 20, height: FUN.h + 20, border: '4px dashed #fde047', borderRadius: 24, animation: 'rcpulse .8s infinite' }} />}

      {/* 비커 */}
      <Beaker sim={sim} subs={subs} x={bpos.x} y={bpos.y} tilt={tilt} rod={phase === 'heat' ? rod : 0} drain={phase === 'pour' || phase === 'result'} />
      {phase === 'pour' && (
        <svg width="1280" height="800" className="absolute inset-0 pointer-events-none" style={{ zIndex: 12 }}>
          <path d={`M${FUN.x + 130} ${FUN.y - 22} Q${FUN.x + 133} ${FUN.y + 10} ${FUN.x + 122} ${FUN.y + 62}`} fill="none" stroke="#7fbfe8" strokeWidth="11" strokeLinecap="round" opacity=".9" strokeDasharray="10 6" style={{ animation: 'rcstream .35s linear infinite' }} />
        </svg>
      )}
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
