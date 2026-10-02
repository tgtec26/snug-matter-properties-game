'use client';

import { GlassG, StageBg } from '@/components/ui';
import { useEffect, useRef, useState } from 'react';
import type { SeparateProps } from '@/game/minigameTypes';
import { playSfx } from '@/game/audio';
import { funnelCfg, judgeFunnel, settleStep, type FunnelJudge, type FunnelReason } from '@/game/minigames/funnel';

const CX = 560, L = 480, R = 640, TOP = 170, BOT = 481; // 깔때기 몸통(그림 기준)
const SF = { x: 479, y: 88, w: 162, h: 520 };          // 분별 깔때기 그림 (bg 위)
const FY = 499;                                        // 꼭지(손잡이) 높이
const HB = 150, HT = 110;   // 아래층·위층 높이(px)
const K = 80;               // 비커에 받은 양 1.0 = 80px
const PIVOT_Y = 320;
const PMAX = 1 + HT / HB;
const LOCK_MS = 700;

type Phase = 'settle' | 'open' | 'drainA' | 'drainB' | 'pour' | 'result';

const REASON: Record<FunnelReason, string> = {
  clean: '경계면을 잘 나눴어요',
  'left-water': '아래층을 덜 받아서 위층에 섞여 남았어요',
  'boundary-in-water': '경계면 액체가 아래층 비커로 넘어갔어요',
  'boundary-left': '경계면 액체가 위층에 남았어요',
  'oil-lost': '위층 액체까지 작은 비커로 빠졌어요',
};

const fresh = () => ({
  phase: 'settle' as Phase, s: 0, stopperOpen: false, p: 0, pA: 0, pB: 0,
  holding: false, angle: 0, pourT: 0, shakePx: 0, rock: 0,
  warn: '', warnUntil: 0, lockUntil: 0, t: 0, warnOn: false, result: null as FunnelJudge | null,
});

export function Funnel({ mixture, obtains, config, onDone }: SeparateProps) {
  const cfg = funnelCfg(config);
  const cfgRef = useRef(cfg);
  const doneFn = useRef(onDone);
  const doneOnce = useRef(false);
  const g = useRef(fresh());
  const [view, setView] = useState(fresh);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: string; x0: number; y0: number; a0: number } | null>(null);

  const top = obtains[0];
  const others = mixture.filter((m) => !obtains.some((o) => o.id === m.id));
  const topColor = top?.color ?? '#f0c93a';
  const botColor = others.find((o) => o.id === 'water')?.color ?? others[0]?.color ?? '#5aa9e6';
  const mixColor = `color-mix(in srgb, ${topColor} 50%, ${botColor})`;
  const botLabel = others.map((o) => o.name).join(' + ');

  const now = () => performance.now();
  const locked = () => now() < g.current.lockUntil;
  const warn = (t: string) => { g.current.warn = t; g.current.warnUntil = now() + 2500; };

  const finish = () => {
    const s = g.current;
    const r = judgeFunnel(s.pA, s.pB, cfgRef.current);
    s.result = r; s.phase = 'result'; s.lockUntil = now() + LOCK_MS;
    playSfx(r.stars >= 1 ? 'success' : 'error');
  };

  const release = () => {
    const s = g.current;
    if (!s.holding) return;
    s.holding = false;
    if (s.phase === 'drainA' && s.p > 0.05) { s.pA = s.p; s.phase = 'drainB'; playSfx('correct'); }
    else if (s.phase === 'drainB') { s.pB = s.p; s.phase = 'pour'; playSfx('correct'); }
  };

  const startHold = () => {
    const s = g.current;
    if (locked()) return;
    if (s.phase === 'settle' || s.phase === 'open') { warn('마개를 닫은 채로는 액체가 내려오지 않아요'); return; }
    if (s.phase === 'drainA' || s.phase === 'drainB') s.holding = true;
  };

  const openStopper = () => {
    const s = g.current;
    if (locked()) return;
    if (s.phase === 'settle') { warn('층이 나뉠 때까지 기다려요'); return; }
    if (s.phase === 'open') { s.stopperOpen = true; s.phase = 'drainA'; playSfx('correct'); }
  };

  const next = () => {
    if (locked() || !g.current.result || doneOnce.current) return;
    doneOnce.current = true;
    doneFn.current({ stars: g.current.result.stars, purity: g.current.result.purity });
  };
  const retry = () => { if (!locked()) g.current = { ...fresh(), lockUntil: now() + LOCK_MS }; };

  useEffect(() => { cfgRef.current = cfg; doneFn.current = onDone; });

  useEffect(() => {
    g.current.lockUntil = now() + LOCK_MS;
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) { if (e.key === ' ') e.preventDefault(); return; }
      const s = g.current;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (s.phase === 'result') next();
        else if (e.key === ' ') startHold();
        else openStopper();
      } else if (e.key === 'r' || e.key === 'R') { if (s.phase === 'result') retry(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); keys.add(e.key); }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.key); if (e.key === ' ') release(); };
    const onBlur = () => { keys.clear(); release(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let raf = 0, last = now();
    const loop = () => {
      const t = now(); const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const s = g.current; const c = cfgRef.current;
      const dir = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      if (s.phase === 'settle') {
        if (dir) s.shakePx += 900 * dt;
        s.s = settleStep(s.s, dt, s.shakePx * 0.0006, c);
        s.rock += (Math.min(1, s.shakePx / 40) - s.rock) * 0.2;
        s.shakePx = 0;
        if (s.s >= 1) { s.phase = 'open'; s.rock = 0; playSfx('correct'); }
      } else if ((s.phase === 'drainA' || s.phase === 'drainB') && s.holding) {
        s.p = Math.min(PMAX, s.p + dt / c.drainSeconds);
        if (s.p >= PMAX) release();
      } else if (s.phase === 'pour') {
        s.angle = Math.min(100, Math.max(0, s.angle + dir * 70 * dt));
        if (s.angle >= 50) { s.pourT = Math.min(1, s.pourT + dt / 1.3); if (s.pourT >= 1) finish(); }
      }
      setView({ ...s, t, warnOn: t < s.warnUntil });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toLocal = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect(); const k = 1280 / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const kind = (e.target as SVGElement).dataset?.hit;
    if (!kind || locked()) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    playSfx('pick');
    const q = toLocal(e);
    drag.current = { kind, x0: q.x, y0: q.y, a0: g.current.angle };
    if (kind === 'faucet') startHold();
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d) return;
    const q = toLocal(e); const s = g.current;
    if (d.kind === 'body') {
      if (s.phase === 'settle') { s.shakePx += Math.abs(e.movementX) + Math.abs(e.movementY); }
      else if (s.phase === 'pour') s.angle = Math.min(100, Math.max(0, d.a0 + (q.x - d.x0) * 0.4));
    } else if (d.kind === 'stopper' && d.y0 - q.y > 40) { openStopper(); drag.current = null; }
  };
  const onUp = () => { drag.current = null; release(); };

  const s = view;
  const c = cfg;

  // 액체 높이
  const botH0 = s.p < 1 ? (1 - s.p) * HB : 0;
  const topH0 = s.p <= 1 ? HT : Math.max(0, HT - (s.p - 1) * HB);
  const botH = botH0 * (1 - s.pourT), topH = topH0 * (1 - s.pourT);
  const interfY = BOT - botH;
  const bandH = c.band * HB;
  const settledFrac = s.s;

  // 비커에 받은 양: [from,to] 구간을 색 조각으로 (경계면 구간은 섞인 색)
  const segs = (from: number, to: number) => {
    const w = Math.max(0, Math.min(to, 1 - c.band) - from);
    const m = Math.max(0, Math.min(to, 1 + c.band) - Math.max(from, 1 - c.band));
    const o = Math.max(0, to - Math.max(from, 1 + c.band));
    return [{ color: botColor, h: w * K }, { color: mixColor, h: m * K }, { color: topColor, h: o * K }];
  };
  const liveA = s.phase === 'drainA' ? s.p : s.pA;
  const segA = segs(0, liveA);
  const segB = s.phase === 'drainB' ? segs(s.pA, s.p) : s.phase === 'pour' || s.phase === 'result' ? segs(s.pA, s.pB) : [];
  const segN = [{ color: botColor, h: (botH0 / HB) * K * s.pourT }, { color: topColor, h: (topH0 / HB) * K * s.pourT }];

  const phase = s.phase;
  const xA = phase === 'settle' || phase === 'open' || phase === 'drainA' ? CX : 290;
  const xB = phase === 'drainB' ? CX : 860;
  const flowing = s.holding && (phase === 'drainA' || phase === 'drainB');
  const flowColor = flowing ? (s.p < 1 - c.band ? botColor : s.p < 1 + c.band ? mixColor : topColor) : 'none';

  const hint =
    s.warnOn ? s.warn :
    phase === 'settle' ? '기다리면 층이 나뉘어요. 흔들면 다시 섞여요' :
    phase === 'open' ? '마개를 위로 끌어 열어요' :
    phase === 'drainA' ? '꼭지를 누르고 있다가, 경계면이 꼭지에 닿기 전에 놓아요' :
    phase === 'drainB' ? '경계면 액체는 작은 비커에 따로 받아요' :
    phase === 'pour' ? '깔때기를 기울여 입구로 위층을 따라요' : '';

  const bounce = { animation: 'fbounce 0.9s ease-in-out infinite' } as const;
  const pulse = { animation: 'fpulse 1s ease-in-out infinite', transformOrigin: `${CX}px ${FY}px` } as const;

  const beaker = (x: number, y: number, label: string, fills: { color: string; h: number }[], sc = 1, trans = true) => {
    let acc = 0;
    return (
      <g style={{ transform: `translate(${x}px, ${y}px) scale(${sc})`, transition: trans ? 'transform .5s ease' : 'none' }}>
        <GlassG name="beaker-l" x={-58} y={-116} w={116} h={140}>
          {fills.map((f, i) => { acc += f.h; return <rect key={i} x={-60} y={16 - acc} width={120} height={f.h + 0.5} fill={f.color} opacity={0.92} />; })}
        </GlassG>
        <text x={0} y={52} textAnchor="middle" fontSize={24} fontWeight={800} fill="#fff" stroke="#3a2412" strokeWidth={5} paintOrder="stroke">{label}</text>
      </g>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-auto select-none overflow-hidden" style={{ background: 'linear-gradient(180deg,#eaf2f8,#c6d9e6)', wordBreak: 'keep-all' }}>
      <StageBg name="kitchen" dark={0.0} />
      <style>{`@keyframes fbounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}@keyframes fpulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.25);opacity:.4}}`}</style>
      <svg ref={svgRef} viewBox="0 0 1280 800" className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
        <defs>
          <clipPath id="fbody"><rect x={L + 3} y={TOP} width={R - L - 6} height={BOT - TOP} /></clipPath>
          <linearGradient id="fband" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={topColor} /><stop offset="1" stopColor={botColor} /></linearGradient>
        </defs>

        {/* 받는 비커 (나) 는 입구 쪽에 고정 */}
        {beaker(770, 500, '(나)', segN, 1, false)}
        {beaker(xA, 745, '(가)', segA)}
        {beaker(xB, 745, '경계면', segB, 0.75)}

        <g transform={`rotate(${s.angle + Math.sin(s.t * 0.03) * s.rock * 5} ${CX} ${PIVOT_Y})`}>
          {/* 유리 깔때기(Codex 그림) + 안쪽 액체. 마개를 열면 마개 부분만 떼어 올린다 */}
          <clipPath id="fs-lower"><rect x={SF.x - 40} y={SF.y + SF.h * 0.17} width={SF.w + 80} height={SF.h} /></clipPath>
          <clipPath id="fs-upper"><rect x={SF.x - 40} y={SF.y - 10} width={SF.w + 80} height={SF.h * 0.17 + 10} /></clipPath>
          <g clipPath={s.stopperOpen ? 'url(#fs-lower)' : undefined}>
            <GlassG name="sepfunnel" x={SF.x} y={SF.y} w={SF.w} h={SF.h}>
              <rect x={L} y={BOT - botH} width={R - L} height={botH} fill={botColor} opacity={0.92} />
              <rect x={L} y={BOT - botH - topH} width={R - L} height={topH} fill={topColor} opacity={0.92} />
              {botH0 > 0 || s.p < 1 + c.band ? (
                <rect x={L} y={interfY - bandH} width={R - L} height={bandH * 2} fill="url(#fband)" opacity={0.85} />
              ) : null}
              {s.p === 0 && (
                <rect x={L} y={BOT - HB - HT} width={R - L} height={HB + HT} style={{ fill: mixColor }} opacity={(1 - settledFrac) * 0.92} />
              )}
            </GlassG>
          </g>
          {s.stopperOpen && (
            <g style={{ transform: 'translate(90px,-80px) rotate(35deg)', transformOrigin: `${CX}px ${SF.y + SF.h * 0.1}px`, transition: 'transform .3s ease' }}>
              <g clipPath="url(#fs-upper)"><image href="/assets/items/sepfunnel.webp" x={SF.x} y={SF.y} width={SF.w} height={SF.h} preserveAspectRatio="none" /></g>
            </g>
          )}
          {/* 꼭지 높이(경계면이 여기 닿기 전에 놓기) */}
          <line x1={L - 34} x2={L - 6} y1={BOT} y2={BOT} stroke="#ff6b6b" strokeWidth={5} strokeDasharray="6 4" />
          <text x={L - 40} y={BOT + 7} textAnchor="end" fontSize={22} fill="#fff" stroke="#3a2412" strokeWidth={5} paintOrder="stroke" fontWeight={800}>꼭지</text>
          {/* 층 이름표 */}
          {phase === 'open' && <>
            <text x={R + 30} y={BOT - HB - HT / 2} fontSize={24} fontWeight={800} fill="#fff" stroke="#3a2412" strokeWidth={5} paintOrder="stroke">{top?.name}</text>
            <text x={R + 30} y={BOT - HB / 2} fontSize={24} fontWeight={800} fill="#fff" stroke="#3a2412" strokeWidth={5} paintOrder="stroke">{botLabel}</text>
          </>}
          {/* 물줄기 */}
          {flowing && <rect x={CX - 4} y={SF.y + SF.h - 8} width={8} height={110} style={{ fill: flowColor }} opacity={0.92} />}
          {/* 손 대는 곳 (잡는 영역은 넉넉히) */}
          <rect data-hit="body" x={L - 30} y={SF.y + 60} width={R - L + 60} height={BOT - SF.y - 50} fill="transparent" style={{ cursor: 'grab' }} />
          <rect data-hit="stopper" x={CX - 50} y={SF.y - 10} width={100} height={SF.h * 0.17 + 10} fill="transparent" style={{ cursor: 'grab' }} />
          <circle data-hit="faucet" cx={CX} cy={FY} r={58} fill="transparent" style={{ cursor: 'pointer' }} />
        </g>

        {/* 비언어 안내 */}
        {phase === 'open' && <g style={bounce}><path d={`M${CX} ${SF.y - 60} l-24 30 h16 v26 h16 v-26 h16 z`} fill="#e07a1f" /></g>}
        {phase === 'drainA' && !s.holding && s.p === 0 && <circle cx={CX} cy={FY} r={44} fill="none" stroke="#ffb347" strokeWidth={6} style={pulse} />}
        {phase === 'drainB' && !s.holding && <circle cx={CX} cy={FY} r={44} fill="none" stroke="#ffb347" strokeWidth={6} style={pulse} />}
        {phase === 'pour' && s.angle < 30 && <path d="M720 190 q70 10 80 90 l14 -14 m-14 14 l-18 -18" fill="none" stroke="#e07a1f" strokeWidth={8} strokeLinecap="round" style={bounce} />}
        {phase === 'settle' && s.s < 1 && (
          <rect x={L} y={TOP - 30} width={(R - L) * s.s} height={8} rx={4} fill="#3d5a80" opacity={0.6} />
        )}
      </svg>

      <div className="absolute left-6 top-4 rounded-xl bg-amber-50/95 px-4 py-1 text-[26px] font-bold text-[#22303c] shadow">분별 깔때기 · 위층 {top?.name} / 아래층 {botLabel}</div>
      <div className="absolute left-6 top-[66px] max-w-[560px] rounded-xl bg-amber-50/95 px-4 py-1 text-[22px] font-bold text-[#b45309] shadow pointer-events-none">{hint}</div>

      {phase === 'result' && s.result && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(20,30,40,0.45)' }}>
          <div className="rounded-2xl bg-white px-10 py-8 text-center shadow-xl" style={{ width: 560 }}>
            <div className="text-[40px] font-bold text-[#22303c]">순도 {Math.round(s.result.purity * 100)}%</div>
            <div className="mt-2 text-[34px] tracking-widest text-[#e0a21f]">{'★'.repeat(s.result.stars)}{'☆'.repeat(3 - s.result.stars)}</div>
            <div className="mt-3 text-[24px] text-[#33414d]">{REASON[s.result.reason]}</div>
            <div className="mt-6 flex justify-center gap-4">
              <button type="button" className="rounded-xl bg-[#dfe7ee] px-8 py-3 text-[24px] font-bold text-[#22303c]" onClick={(e) => { retry(); e.currentTarget.blur(); }}>다시</button>
              <button type="button" className="rounded-xl bg-[#3d5a80] px-8 py-3 text-[24px] font-bold text-white" onClick={(e) => { next(); e.currentTarget.blur(); }}>다음</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
