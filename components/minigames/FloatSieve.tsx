'use client';

import { useEffect, useRef, useState } from 'react';
import type { SeparateProps } from '@/game/minigameTypes';
import { playSfx } from '@/game/audio';
import { inSieve, judgeSieve, makeGrains, sieveCfg, type Grain, type SieveJudge } from '@/game/minigames/floatSieve';

// 무대 1280×800. 배경 bg/farmtable.webp 의 탁자 위에 그릇·유리 통·접시·체를 놓는다.
const BOWL = { x: 100, y: 273, w: 300, h: 227 };       // 그릇 그림 (빈 그릇)
const PIVOT = { x: 340, y: 450 };                      // 그릇을 기울일 때의 축(오른쪽 아래 모서리)
const LIP = { x: 39, y: -113 };                        // 그릇 입구(축 기준)
const BOWL_FLOOR = { x: -93, y: -59 };                 // 그릇 바닥 가운데(축 기준)
const TUB = { l: 430, r: 870, top: 380, bottom: 590, water: 450 };
const TRAY = { x: 950, y: 460 };                       // 접시 위 놓는 판정
const PLATE = { x: 920, y: 427, w: 320, h: 205 };
const SIEVE0 = { x: 1130, y: 380 };
const SIEVE_IMG = { fx: 0.30, fy: 0.64, ar: 498 / 520 }; // 체 그림에서 망 중심 위치
const LOCK_MS = 700;

type St = 'bowl' | 'fall' | 'water' | 'carried' | 'scooped';
interface G extends Grain { x: number; y: number; vx: number; vy: number; st: St; ox: number; oy: number; lx: number; ly: number; slot: number }

const build = (grains: Grain[]): G[] =>
  grains.map((gr, i) => ({ ...gr, x: 0, y: 0, vx: 0, vy: 0, st: 'bowl', ox: 0, oy: 0, slot: -1,
    lx: BOWL_FLOOR.x - 62 + (i % 6) * 25, ly: BOWL_FLOOR.y - 10 + Math.floor(i / 6) * 15 + ((i * 7) % 5) }));

export function FloatSieve({ mixture, obtains, config, onDone }: SeparateProps) {
  const cfg = sieveCfg(config);
  const cfgRef = useRef(cfg);
  const doneFn = useRef(onDone);
  const doneOnce = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: string; x0: number; y0: number; a0: number; dx: number; dy: number } | null>(null);

  const [initial] = useState<Grain[]>(() => makeGrains(mixture, obtains, cfg));
  const mk = () => ({
    grains: build(initial), queue: initial.map((_, i) => i), angle: 0, rel: 0, started: false, elapsed: 0,
    sieve: { ...SIEVE0 }, result: null as SieveJudge | null, lockUntil: 0, scooped: 0, homing: false,
  });
  const g = useRef(mk());
  const [view, setView] = useState(() => ({ ...mk(), t: 0, carrying: 0, timeLeft: cfg.timeLimit }));

  const wantedName = obtains[0]?.name ?? '쭉정이';
  const otherName = mixture.find((m) => m.state === 'solid' && !obtains.some((o) => o.id === m.id))?.name ?? '볍씨';
  const liquid = mixture.find((m) => m.state === 'liquid');

  const now = () => performance.now();
  const locked = () => now() < g.current.lockUntil;

  const finish = () => {
    const s = g.current;
    if (s.result) return;
    const scooped = s.grains.filter((x) => x.st === 'scooped');
    s.result = judgeSieve(scooped, initial, cfgRef.current);
    s.lockUntil = now() + LOCK_MS;
    playSfx(s.result.stars >= 1 ? 'success' : 'error');
  };

  const dropCarried = () => {
    const s = g.current;
    const carried = s.grains.filter((x) => x.st === 'carried');
    if (!carried.length) return false;
    const over = s.sieve.x > TRAY.x - 30 && s.sieve.y > TRAY.y - 30;
    carried.forEach((x) => {
      if (over) { x.st = 'scooped'; x.slot = s.scooped++; playSfx('correct'); }
      else { x.st = 'fall'; x.vx = 0; x.vy = 0; }
    });
    if (over) s.homing = true; // 체는 제자리로 돌아간다
    if (over && s.grains.filter((x) => x.wanted).every((x) => x.st === 'scooped')) finish();
    return true;
  };

  const next = () => {
    if (locked() || !g.current.result || doneOnce.current) return;
    doneOnce.current = true;
    doneFn.current({ stars: g.current.result.stars, purity: g.current.result.purity });
  };
  const retry = () => { if (!locked()) { g.current = { ...mk(), lockUntil: now() + LOCK_MS }; } };

  useEffect(() => { cfgRef.current = cfg; doneFn.current = onDone; });

  useEffect(() => {
    g.current.lockUntil = now() + LOCK_MS;
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); return; }
      const s = g.current;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (locked()) return;
        if (s.result) next();
        else if (!dropCarried() && s.started && e.key === 'Enter') finish();
      } else if (e.key === 'r' || e.key === 'R') { if (s.result) retry(); }
      else if (e.key.startsWith('Arrow')) { e.preventDefault(); keys.add(e.key); }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.key); };
    const onBlur = () => { keys.clear(); drag.current = null; dropCarried(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let raf = 0, last = now();
    const loop = () => {
      const t = now(); const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const s = g.current;
      if (!s.result) {
        const dx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
        const dy = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
        if (s.queue.length) s.angle = Math.min(75, Math.max(0, s.angle + dx * 70 * dt));
        else {
          s.angle = Math.max(0, s.angle - 80 * dt);
          s.sieve.x = Math.min(1240, Math.max(40, s.sieve.x + dx * 380 * dt));
          s.sieve.y = Math.min(760, Math.max(40, s.sieve.y + dy * 380 * dt));
        }
        // 그릇에서 낟알이 쏟아짐
        if (s.queue.length && s.angle >= 35) {
          s.rel += dt * (3 + (s.angle - 35) / 12);
          while (s.rel >= 1 && s.queue.length) {
            s.rel -= 1;
            const gr = s.grains[s.queue.shift()!];
            const a = (s.angle * Math.PI) / 180;
            gr.x = PIVOT.x + LIP.x * Math.cos(a) - LIP.y * Math.sin(a);
            gr.y = PIVOT.y + LIP.x * Math.sin(a) + LIP.y * Math.cos(a);
            gr.vx = 90 + Math.random() * 110; gr.vy = 0; gr.st = 'fall'; gr.ox = TUB.l + 40 + Math.random() * (TUB.r - TUB.l - 80);
            s.started = true;
          }
        }
        if (s.homing) {
          s.sieve.x += (SIEVE0.x - s.sieve.x) * Math.min(1, 6 * dt); s.sieve.y += (SIEVE0.y - s.sieve.y) * Math.min(1, 6 * dt);
          if (Math.hypot(SIEVE0.x - s.sieve.x, SIEVE0.y - s.sieve.y) < 3) s.homing = false;
        }
        if (s.started) s.elapsed += dt;
        const sv = s.sieve;
        for (const x of s.grains) {
          if (x.st === 'fall') {
            x.vy += 900 * dt; x.x += x.vx * dt; x.y += x.vy * dt;
            if (x.y > TUB.top) x.x = Math.min(TUB.r - 16, Math.max(TUB.l + 16, x.x));
            if (x.y >= TUB.water) { x.st = 'water'; x.vy = 0; }
          } else if (x.st === 'water') {
            x.x = Math.min(TUB.r - 16, Math.max(TUB.l + 16, x.x + x.vx * dt + (x.ox - x.x) * 1.2 * dt + (x.floats ? Math.sin(t / 500 + x.id) * 10 * dt : 0)));
            x.vx *= 0.96;
            const ty = x.floats ? TUB.water + 12 + (x.id % 3) * 9 : TUB.bottom - 14 - (x.id % 4) * 9;
            const step = (x.floats ? 90 : 150) * dt;
            x.y += Math.max(-step, Math.min(step, ty - x.y));
            if (inSieve(x.x, x.y, sv.x, sv.y, cfgRef.current.sieveRadius) && s.started) {
              x.st = 'carried'; x.ox = x.x - sv.x; x.oy = x.y - sv.y;
            }
          } else if (x.st === 'carried') {
            x.ox *= 1 - 3 * dt; x.oy *= 1 - 3 * dt;
            x.x = sv.x + x.ox; x.y = sv.y + x.oy;
          }
        }
        if (s.started && s.elapsed >= cfgRef.current.timeLimit) finish();
      }
      setView({
        ...s, grains: s.grains.map((x) => ({ ...x })), sieve: { ...s.sieve }, t,
        carrying: s.grains.filter((x) => x.st === 'carried').length,
        timeLeft: Math.max(0, cfgRef.current.timeLimit - s.elapsed),
      });
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
    const kind = (e.target as SVGElement).dataset?.hit ?? (g.current.queue.length ? 'bowl' : undefined);
    if (!kind || locked() || g.current.result) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const q = toLocal(e); const s = g.current;
    s.homing = false;
    drag.current = { kind, x0: q.x, y0: q.y, a0: s.angle, dx: s.sieve.x - q.x, dy: s.sieve.y - q.y };
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d) return;
    const q = toLocal(e); const s = g.current;
    if (d.kind === 'bowl' && s.queue.length) s.angle = Math.min(75, Math.max(0, d.a0 + (Math.abs(q.x - d.x0) + Math.max(0, q.y - d.y0) * 0.3) * 0.4));
    else if (d.kind === 'sieve') {
      s.sieve.x = Math.min(1240, Math.max(40, q.x + d.dx));
      s.sieve.y = Math.min(760, Math.max(40, q.y + d.dy));
    }
  };
  const onUp = () => { if (drag.current?.kind === 'sieve') dropCarried(); drag.current = null; };

  const s = view;
  const inTray = s.sieve.x > TRAY.x - 30 && s.sieve.y > TRAY.y - 30;
  const bounce = { animation: 'sbounce 0.9s ease-in-out infinite' } as const;
  const hint = !s.started ? '그릇을 끌어 기울여 통에 부어요' : s.carrying ? '접시 위에서 놓아요' : '떠오른 것을 체로 걷어요';
  const sec = Math.ceil(s.timeLeft);
  const sieveW = (cfg.sieveRadius + 12) / 0.3;

  const grainEl = (x: G) => {
    const w = 54, h = x.floats ? 17.5 : 22;
    return (
      <image key={x.id} href={`/assets/items/${x.floats ? 'husk' : 'rice'}${(x.id % 4) + 1}.webp`} x={x.x - w / 2} y={x.y - h / 2} width={w} height={h}
        transform={`rotate(${(x.id * 47) % 360} ${x.x} ${x.y})`} pointerEvents="none" />
    );
  };
  const bowlGrains = s.grains.filter((x) => x.st === 'bowl');
  const worldGrains = s.grains.filter((x) => x.st === 'fall' || x.st === 'water' || x.st === 'carried');
  const scooped = s.grains.filter((x) => x.st === 'scooped');

  return (
    <div className="absolute inset-0 pointer-events-auto select-none overflow-hidden" style={{ background: 'linear-gradient(180deg,#f2eddc,#d9cfae)', wordBreak: 'keep-all' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/bg/farmtable.webp" alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" onError={e => { e.currentTarget.style.display = 'none'; }} />
      <style>{`@keyframes sbounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}@keyframes spulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <svg ref={svgRef} viewBox="0 0 1280 800" className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
        <defs>
          <linearGradient id="fs-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={liquid?.color ?? '#7fbfd8'} stopOpacity=".78" /><stop offset="1" stopColor="#4d8fb0" stopOpacity=".9" /></linearGradient>
          <linearGradient id="fs-glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".12" stopColor="#fff" stopOpacity=".06" /><stop offset=".85" stopColor="#fff" stopOpacity=".04" /><stop offset="1" stopColor="#fff" stopOpacity=".3" /></linearGradient>
          <radialGradient id="fs-shadow"><stop offset="0" stopColor="#000" stopOpacity=".38" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        </defs>

        {/* 그림자 */}
        <ellipse cx={(TUB.l + TUB.r) / 2 + 20} cy={TUB.bottom + 22} rx={250} ry={30} fill="url(#fs-shadow)" />
        <ellipse cx={PIVOT.x - 60} cy={PIVOT.y + 6} rx={150} ry={20} fill="url(#fs-shadow)" />

        {/* 유리 통 (뒤쪽 테두리 → 소금물 → 낟알 → 앞쪽 유리) */}
        <ellipse cx={(TUB.l + TUB.r) / 2} cy={TUB.top} rx={(TUB.r - TUB.l) / 2} ry={34} fill="#dff1f7" fillOpacity={0.35} stroke="#cfe6ee" strokeWidth={5} />
        <path d={`M${TUB.l} ${TUB.water} V${TUB.bottom} A${(TUB.r - TUB.l) / 2} 34 0 0 0 ${TUB.r} ${TUB.bottom} V${TUB.water} Z`} fill="url(#fs-water)" />
        <ellipse cx={(TUB.l + TUB.r) / 2} cy={TUB.water} rx={(TUB.r - TUB.l) / 2} ry={30} fill={liquid?.color ?? '#7fbfd8'} fillOpacity={0.55} stroke="#eaf7fb" strokeOpacity={0.8} strokeWidth={2} />
        <ellipse cx={(TUB.l + TUB.r) / 2 - 60} cy={TUB.water - 4} rx={110} ry={9} fill="#fff" fillOpacity={0.22} />

        {worldGrains.filter((x) => x.st !== 'carried').map(grainEl)}

        <path d={`M${TUB.l} ${TUB.top} V${TUB.bottom} A${(TUB.r - TUB.l) / 2} 34 0 0 0 ${TUB.r} ${TUB.bottom} V${TUB.top} A${(TUB.r - TUB.l) / 2} 34 0 0 1 ${TUB.l} ${TUB.top} Z`} fill="url(#fs-glass)" stroke="#d6ecf3" strokeWidth={5} strokeLinejoin="round" />
        <path d={`M${TUB.l + 22} ${TUB.top + 40} V${TUB.bottom - 20}`} stroke="#fff" strokeOpacity={0.6} strokeWidth={7} strokeLinecap="round" />
        <g>
          <rect x={(TUB.l + TUB.r) / 2 - 62} y={(TUB.water + TUB.bottom) / 2 - 17} width={124} height={34} rx={10} fill="#fff8e6" stroke="#8a6a3a" strokeWidth={3} />
          <text x={(TUB.l + TUB.r) / 2} y={(TUB.water + TUB.bottom) / 2 + 8} textAnchor="middle" fontSize={24} fontWeight={800} fill="#4a3417">{liquid?.name ?? '소금물'}</text>
        </g>

        {/* 접시 */}
        <ellipse cx={PLATE.x + PLATE.w / 2 + 10} cy={PLATE.y + PLATE.h - 20} rx={PLATE.w / 2} ry={26} fill="url(#fs-shadow)" />
        <image href="/assets/items/plate.webp" x={PLATE.x} y={PLATE.y} width={PLATE.w} height={PLATE.h} style={s.carrying ? { filter: 'drop-shadow(0 0 14px #ffb347)', animation: 'spulse 0.8s ease-in-out infinite' } : undefined} />
        {scooped.map((x) => {
          const c = x.slot % 6, r = Math.floor(x.slot / 6);
          return grainEl({ ...x, x: PLATE.x + 90 + c * 26 + (r % 2) * 12, y: PLATE.y + 88 + r * 20 });
        })}

        {/* 그릇: 안이 비어 있고 낟알만 바닥에 놓여 있다. 어디를 끌어도 기울어진다 */}
        <g transform={`rotate(${s.angle} ${PIVOT.x} ${PIVOT.y})`}>
          <image href="/assets/items/bowl.webp" x={BOWL.x} y={BOWL.y} width={BOWL.w} height={BOWL.h} />
          {bowlGrains.map((x) => grainEl({ ...x, x: PIVOT.x + x.lx, y: PIVOT.y + x.ly }))}
        </g>
        {!s.started && s.angle < 20 && (
          <g style={bounce} pointerEvents="none">
            <path d="M420 280 q70 -50 130 20" fill="none" stroke="#e07a1f" strokeWidth={9} strokeLinecap="round" />
            <path d="M540 292 l14 24 l-26 -4" fill="none" stroke="#e07a1f" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}

        {/* 체: 촘촘한 망. 그림 속 망 중심이 잡는 원의 중심 */}
        <ellipse cx={s.sieve.x + 8} cy={s.sieve.y + 92} rx={cfg.sieveRadius + 18} ry={13} fill="url(#fs-shadow)" />
        <image href="/assets/items/sieve.webp" x={s.sieve.x - SIEVE_IMG.fx * sieveW} y={s.sieve.y - SIEVE_IMG.fy * sieveW * SIEVE_IMG.ar} width={sieveW} height={sieveW * SIEVE_IMG.ar} pointerEvents="none" />
        {worldGrains.filter((x) => x.st === 'carried').map(grainEl)}
        <circle data-hit="sieve" cx={s.sieve.x} cy={s.sieve.y} r={cfg.sieveRadius + 26} fill="transparent" style={{ cursor: 'grab' }} />
        {s.started && !s.carrying && !inTray && s.elapsed < 8 && (
          <path d="M1010 400 h-70 l14 -14 m-14 14 l14 14" fill="none" stroke="#e07a1f" strokeWidth={8} strokeLinecap="round" style={bounce} pointerEvents="none" />
        )}
      </svg>

      <div className="absolute left-6 top-4 rounded-xl bg-amber-50/95 px-4 py-1 text-[26px] font-bold text-[#22303c] shadow">소금물에 띄우기 · {wantedName} 걷기</div>
      {s.started && (
        <div className="absolute right-[280px] top-5 flex items-center gap-3 text-[24px] font-bold text-[#22303c]">
          <div className="h-3 w-48 overflow-hidden rounded-full bg-black/15"><div className="h-full bg-[#3d5a80]" style={{ width: `${(s.timeLeft / cfg.timeLimit) * 100}%` }} /></div>
          {sec}
        </div>
      )}
      {s.started && !s.result && (
        <button type="button" className="absolute bottom-4 left-6 rounded-xl bg-[#3d5a80] px-6 py-2 text-[22px] font-bold text-white"
          onClick={(e) => { if (!locked()) finish(); e.currentTarget.blur(); }}>다 걷었어요</button>
      )}
      <div className="absolute left-6 top-[66px] max-w-[560px] rounded-xl bg-amber-50/95 px-4 py-1 text-[22px] font-bold text-[#8a4a10] shadow pointer-events-none">{hint}</div>

      {s.result && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(20,30,40,0.45)' }}>
          <div className="rounded-2xl bg-white px-10 py-8 text-center shadow-xl" style={{ width: 560 }}>
            <div className="text-[34px] font-bold text-[#22303c]">{wantedName} {s.result.wantedCaught}/{s.result.wantedTotal}개 · {otherName} {s.result.otherCaught}개 섞임</div>
            <div className="mt-2 text-[34px] tracking-widest text-[#e0a21f]">{'★'.repeat(s.result.stars)}{'☆'.repeat(3 - s.result.stars)}</div>
            <div className="mt-3 text-[24px] text-[#33414d]">
              {s.result.otherCaught > 0 ? `${otherName}가 함께 걷혔어요` : s.result.wantedCaught < s.result.wantedTotal ? `${wantedName}가 더 남았어요` : `${wantedName}만 잘 걷었어요`}
            </div>
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
