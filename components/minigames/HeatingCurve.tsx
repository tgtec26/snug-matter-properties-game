'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InvestigateProps } from '@/game/minigameTypes';
import { playSfx } from '@/game/audio';
import { CURVE_DEFAULTS, curveTemp, judgeTap, reachTime, starsFromError } from '@/game/minigames/heatingCurve';

const AMOUNTS = [50, 100];
const GX = 600, GY = 130, GW = 600, GH = 420; // 그래프 영역
const SHELF = { x: 130, y: 610 }, PAD = { x: 330, y: 610 }; // 가열대
const HOLD = 5; // 평평해진 뒤 자동 종료까지(초)

interface Rec { temp: number; error: number; late: boolean }

export function HeatingCurve({ targets, config, onDone }: InvestigateProps) {
  const cfg = useMemo(() => ({
    ...CURVE_DEFAULTS,
    baseRate: config.baseRate ?? CURVE_DEFAULTS.baseRate,
    grace: config.grace ?? CURVE_DEFAULTS.grace,
  }), [config]);
  const tol = useMemo(() => ({ s3: config.s3 ?? 2, s2: config.s2 ?? 5, s1: config.s1 ?? 12 }), [config]);
  const steps = useMemo(() => targets.flatMap((s) => AMOUNTS.map((a) => ({ s, a }))), [targets]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'place' | 'heat' | 'result'>('place');
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [t, setT] = useState(0);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [finished, setFinished] = useState(false);
  const locked = useRef(true);
  const doneRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const t0 = useRef(0);

  const { s: sub, a: amount } = steps[Math.min(idx, steps.length - 1)];
  const bp = sub.boilingPoint ?? 100;
  const tr = reachTime(bp, amount, cfg);
  const tMax = reachTime(Math.max(...steps.map((x) => x.s.boilingPoint ?? 100)), AMOUNTS[1], cfg) + HOLD;
  const yMax = Math.max(...steps.map((x) => x.s.boilingPoint ?? 100)) + 20;
  const px = (tt: number) => GX + (tt / tMax) * GW;
  const py = (T: number) => GY + GH - (T / yMax) * GH;

  useEffect(() => { const id = setTimeout(() => { locked.current = false; }, 700); return () => clearTimeout(id); }, []);

  const tap = useCallback((at: number) => {
    const r = judgeTap(at, bp, amount, cfg);
    setT(at);
    setRecs((p) => [...p, r]);
    setPhase('result');
    locked.current = true; setTimeout(() => { locked.current = false; }, 700);
    playSfx(starsFromError(r.error, tol) >= 2 ? 'correct' : 'error');
  }, [bp, amount, cfg, tol]);

  // 가열: 실시간 그래프
  useEffect(() => {
    if (phase !== 'heat') return;
    t0.current = performance.now();
    let raf = 0;
    const loop = () => {
      const el = (performance.now() - t0.current) / 1000;
      if (el >= tr + HOLD) { tap(tr + HOLD); return; }
      setT(el);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, tr, tap]);

  const nowTap = useCallback(() => {
    if (locked.current || phase !== 'heat') return;
    tap((performance.now() - t0.current) / 1000);
  }, [phase, tap]);

  const next = useCallback(() => {
    if (locked.current || phase !== 'result') return;
    if (idx + 1 < steps.length) {
      setIdx(idx + 1); setPhase('place'); setT(0);
      locked.current = true; setTimeout(() => { locked.current = false; }, 700);
    } else setFinished(true);
  }, [phase, idx, steps.length]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const avg = recs.reduce((a, r) => a + r.error, 0) / recs.length;
    onDone({ stars: starsFromError(avg, tol) });
  }, [recs, onDone, tol]);

  const place = useCallback(() => {
    if (locked.current || phase !== 'place') return;
    setDrag(null); setPhase('heat'); playSfx('correct');
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault();
      if (finished) { if (!locked.current) finish(); return; }
      if (phase === 'place') place();
      else if (phase === 'heat') nowTap();
      else next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, finished, place, nowTap, next, finish]);

  useEffect(() => {
    if (!finished) return;
    locked.current = true; const id = setTimeout(() => { locked.current = false; }, 700);
    return () => clearTimeout(id);
  }, [finished]);

  const toLocal = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1280, y: ((e.clientY - r.top) / r.height) * 800 };
  };
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'place' || locked.current) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag(toLocal(e));
  };
  const onMove = (e: React.PointerEvent) => { if (drag) setDrag(toLocal(e)); };
  const onUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toLocal(e);
    if (Math.hypot(p.x - PAD.x, p.y - PAD.y) < 110) place(); else setDrag(null);
  };

  // 그래프 점
  const pts: string[] = [];
  if (phase !== 'place') for (let i = 0; i <= 120; i++) { const tt = (t * i) / 120; pts.push(`${px(tt)},${py(curveTemp(tt, bp, amount, cfg))}`); }
  const rec = recs[idx];
  const onPad = phase !== 'place';
  const bx = drag ? drag.x : onPad ? PAD.x : SHELF.x;
  const by = drag ? drag.y : onPad ? PAD.y : SHELF.y;
  const liquidH = 30 + amount * 0.9;
  const stars = finished ? starsFromError(recs.reduce((a, r) => a + r.error, 0) / recs.length, tol) : 0;

  return (
    <div className="absolute inset-0 pointer-events-auto overflow-hidden select-none"
      style={{ background: 'linear-gradient(160deg,#16243a,#0d1524)', wordBreak: 'keep-all' }}>
      <svg ref={svgRef} viewBox="0 0 1280 800" width="1280" height="800" className="absolute inset-0" style={{ touchAction: 'none' }}>
        <text x="60" y="80" fill="#e8f1ff" fontSize="36" fontWeight="700">{sub.name} {amount} mL</text>
        {/* 그래프 */}
        <rect x={GX} y={GY} width={GW} height={GH} rx="10" fill="#0a1220" stroke="#3a4f73" strokeWidth="2" />
        {[0, 20, 40, 60, 80, 100].filter((v) => v <= yMax).map((v) => (
          <g key={v}><line x1={GX} x2={GX + GW} y1={py(v)} y2={py(v)} stroke="#22344f" /><text x={GX - 10} y={py(v) + 6} fill="#8fa6c8" fontSize="18" textAnchor="end">{v}</text></g>
        ))}
        <text x={GX - 10} y={GY - 12} fill="#8fa6c8" fontSize="18" textAnchor="end">온도(℃)</text>
        <text x={GX + GW} y={GY + GH + 30} fill="#8fa6c8" fontSize="18" textAnchor="end">시간</text>
        {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke="#ffb454" strokeWidth="4" strokeLinejoin="round" />}
        {phase === 'heat' && <circle cx={px(t)} cy={py(curveTemp(t, bp, amount, cfg))} r="8" fill="#ffd27a" />}
        {phase === 'result' && rec && (
          <g>
            <line x1={GX} x2={px(t)} y1={py(rec.temp)} y2={py(rec.temp)} stroke="#7cf0a8" strokeDasharray="8 6" strokeWidth="3" />
            <circle cx={px(t)} cy={py(rec.temp)} r="10" fill="#7cf0a8" />
            <text x={GX + 12} y={py(rec.temp) - 10} fill="#7cf0a8" fontSize="26" fontWeight="700">{Math.round(rec.temp)} ℃</text>
          </g>
        )}
        {/* 가열대 */}
        <rect x={PAD.x - 110} y={PAD.y + 90} width="220" height="30" rx="8" fill="#55627a" />
        <rect x={PAD.x - 90} y={PAD.y + 60} width="180" height="34" rx="6" fill="#3a4558" />
        {phase === 'place' && (
          <circle cx={PAD.x} cy={PAD.y + 20} r="100" fill="none" stroke="#ffd27a" strokeWidth="4" strokeDasharray="10 10">
            <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}
        {phase === 'heat' && [-40, 0, 40].map((dx, i) => (
          <path key={dx} d={`M${PAD.x + dx} ${PAD.y + 58} q-10 -22 0 -36 q14 14 0 36z`} fill="#ff9a3c">
            <animate attributeName="opacity" values="1;0.4;1" dur={`${0.5 + i * 0.15}s`} repeatCount="indefinite" />
          </path>
        ))}
        {phase === 'place' && !drag && (
          <path d={`M${SHELF.x + 70} ${SHELF.y - 10} L${PAD.x - 100} ${PAD.y - 10}`} stroke="#ffd27a" strokeWidth="5" strokeDasharray="4 12" strokeLinecap="round">
            <animate attributeName="stroke-dashoffset" values="0;-32" dur="0.8s" repeatCount="indefinite" />
          </path>
        )}
        {/* 비커 (드래그 대상) */}
        <g transform={`translate(${bx} ${by})`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}
          style={{ cursor: phase === 'place' ? 'grab' : 'default', touchAction: 'none' }}>
          <rect x="-90" y="-100" width="180" height="200" fill="transparent" />
          <rect x="-56" y="-70" width="112" height="140" rx="10" fill="#ffffff10" stroke="#cfe3ff" strokeWidth="4" />
          <rect x="-52" y={66 - liquidH} width="104" height={liquidH} rx="6" fill={sub.color} opacity="0.85" />
          {phase === 'heat' && t >= tr && [-20, 0, 22].map((dx) => (
            <circle key={dx} cx={dx} cy="30" r="6" fill="#ffffffaa"><animate attributeName="cy" values="50;-30" dur="0.7s" repeatCount="indefinite" /></circle>
          ))}
          <image href={`/assets/items/${sub.id}.webp`} x="-30" y="-20" width="60" height="60" onError={(e) => ((e.currentTarget as SVGImageElement).style.display = 'none')} />
        </g>
      </svg>

      {phase === 'heat' && (
        <button onClick={nowTap} className="absolute rounded-2xl font-bold text-white"
          style={{ left: 760, top: 640, width: 260, height: 100, fontSize: 40, background: '#e8543c', boxShadow: '0 8px 0 #9c2f1d', touchAction: 'none' }}>
          지금!
        </button>
      )}
      {phase === 'result' && !finished && (
        <div className="absolute left-0 right-0 flex items-center justify-center gap-6" style={{ top: 640, height: 100 }}>
          <span className="text-white" style={{ fontSize: 26 }}>
            {rec.late ? '너무 늦었어요' : rec.error > tol.s2 ? '아직 오르는 중이었어요' : '평평한 곳이에요'}
            {' — '}{Math.round(rec.temp)} ℃
            {idx % 2 === 1 && ` · 양이 달라도 ${sub.name}의 끓는점은 같다`}
          </span>
          <button onClick={next} className="rounded-xl font-bold text-white px-8" style={{ height: 70, fontSize: 28, background: '#2f7be0' }}>다음</button>
        </div>
      )}
      {finished && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0d1524e6' }}>
          <div className="text-center text-white">
            <div style={{ fontSize: 34, marginBottom: 12 }}>
              {targets.map((s) => `${s.name} ${s.boilingPoint} ℃`).join(' · ')}
            </div>
            <div style={{ fontSize: 60, letterSpacing: 8, color: '#ffd27a' }}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
            <button onClick={finish} className="rounded-xl font-bold px-10 mt-6" style={{ height: 76, fontSize: 30, background: '#2f7be0' }}>다음</button>
          </div>
        </div>
      )}
    </div>
  );
}
