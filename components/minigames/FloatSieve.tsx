'use client';

import { useEffect, useRef, useState } from 'react';
import type { SeparateProps } from '@/game/minigameTypes';
import { playSfx } from '@/game/audio';
import { inSieve, judgeSieve, makeGrains, sieveCfg, type Grain, type SieveJudge } from '@/game/minigames/floatSieve';

const PIVOT = { x: 330, y: 190 };
const LIP = { x: 130, y: -50 };            // 그릇 입구(그릇 좌표)
const TUB = { l: 340, r: 960, top: 400, bottom: 720, water: 450 };
const TRAY = { x: 1010, y: 500, w: 230, h: 220 };
const SIEVE0 = { x: 1100, y: 330 };
const LOCK_MS = 700;

type St = 'bowl' | 'fall' | 'water' | 'carried' | 'scooped';
interface G extends Grain { x: number; y: number; vx: number; vy: number; st: St; ox: number; oy: number; lx: number; ly: number; slot: number }

const build = (grains: Grain[]): G[] =>
  grains.map((gr, i) => ({ ...gr, x: 0, y: 0, vx: 0, vy: 0, st: 'bowl', ox: 0, oy: 0, slot: -1,
    lx: -10 + (i % 5) * 26, ly: 22 - Math.floor(i / 5) * 18 }));

export function FloatSieve({ mixture, obtains, config, onDone }: SeparateProps) {
  const cfg = sieveCfg(config);
  const cfgRef = useRef(cfg);
  const doneFn = useRef(onDone);
  const doneOnce = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: string; x0: number; a0: number; dx: number; dy: number } | null>(null);

  const [initial] = useState<Grain[]>(() => makeGrains(mixture, obtains, cfg));
  const mk = () => ({
    grains: build(initial), queue: initial.map((_, i) => i), angle: 0, rel: 0, started: false, elapsed: 0,
    sieve: { ...SIEVE0 }, result: null as SieveJudge | null, lockUntil: 0, scooped: 0,
  });
  const g = useRef(mk());
  const [view, setView] = useState(() => ({ ...mk(), t: 0, carrying: 0, timeLeft: cfg.timeLimit }));

  const colorOf = (id: string) => mixture.find((m) => m.id === id)?.color ?? '#d9b45a';
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
        if (s.queue.length) s.angle = Math.min(100, Math.max(0, s.angle + dx * 70 * dt));
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
            gr.vx = 60 + Math.random() * 50; gr.vy = 0; gr.st = 'fall';
            s.started = true;
          }
        }
        if (s.started) s.elapsed += dt;
        const sv = s.sieve;
        for (const x of s.grains) {
          if (x.st === 'fall') {
            x.vy += 900 * dt; x.x += x.vx * dt; x.y += x.vy * dt;
            if (x.y > TUB.top) x.x = Math.min(TUB.r - 16, Math.max(TUB.l + 16, x.x));
            if (x.y >= TUB.water) { x.st = 'water'; x.vy = 0; }
          } else if (x.st === 'water') {
            x.x = Math.min(TUB.r - 16, Math.max(TUB.l + 16, x.x + x.vx * dt + (x.floats ? Math.sin(t / 500 + x.id) * 10 * dt : 0)));
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
    const kind = (e.target as SVGElement).dataset?.hit;
    if (!kind || locked() || g.current.result) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const q = toLocal(e); const s = g.current;
    drag.current = { kind, x0: q.x, a0: s.angle, dx: s.sieve.x - q.x, dy: s.sieve.y - q.y };
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d) return;
    const q = toLocal(e); const s = g.current;
    if (d.kind === 'bowl' && s.queue.length) s.angle = Math.min(100, Math.max(0, d.a0 + (q.x - d.x0) * 0.4));
    else if (d.kind === 'sieve') {
      s.sieve.x = Math.min(1240, Math.max(40, q.x + d.dx));
      s.sieve.y = Math.min(760, Math.max(40, q.y + d.dy));
    }
  };
  const onUp = () => { if (drag.current?.kind === 'sieve') dropCarried(); drag.current = null; };

  const s = view;
  const inTray = s.sieve.x > TRAY.x - 30 && s.sieve.y > TRAY.y - 30;
  const bounce = { animation: 'sbounce 0.9s ease-in-out infinite' } as const;
  const hint = !s.started ? '그릇을 기울여 통에 부어요' : s.carrying ? '쟁반 위에서 놓아요' : '떠오른 것을 체로 걷어요';
  const sec = Math.ceil(s.timeLeft);

  const grainEl = (x: G) => (
    <ellipse key={x.id} cx={x.x} cy={x.y} rx={11} ry={6.5} transform={`rotate(${(x.id * 37) % 180} ${x.x} ${x.y})`}
      fill={colorOf(x.substanceId)} fillOpacity={x.floats ? 0.75 : 1} stroke={x.floats ? '#a08a55' : '#7a5a1f'} strokeWidth={2}
      strokeDasharray={x.floats ? '3 2' : undefined} />
  );
  const bowlGrains = s.grains.filter((x) => x.st === 'bowl');
  const worldGrains = s.grains.filter((x) => x.st === 'fall' || x.st === 'water' || x.st === 'carried');
  const scooped = s.grains.filter((x) => x.st === 'scooped');

  return (
    <div className="absolute inset-0 pointer-events-auto select-none overflow-hidden" style={{ background: 'linear-gradient(180deg,#f2eddc,#d9cfae)', wordBreak: 'keep-all' }}>
      <style>{`@keyframes sbounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}@keyframes spulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <svg ref={svgRef} viewBox="0 0 1280 800" className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
        {/* 소금물 통 */}
        <rect x={TUB.l} y={TUB.water} width={TUB.r - TUB.l} height={TUB.bottom - TUB.water} fill={liquid?.color ?? '#7fbfd8'} opacity={0.6} />
        <path d={`M${TUB.l} ${TUB.top} V${TUB.bottom} H${TUB.r} V${TUB.top}`} fill="none" stroke="#5b6b78" strokeWidth={6} strokeLinejoin="round" />
        <text x={(TUB.l + TUB.r) / 2} y={TUB.bottom + 44} textAnchor="middle" fontSize={26} fontWeight={700} fill="#33414d">{liquid?.name ?? '소금물'}</text>

        {/* 쟁반 */}
        <rect x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx={14} fill="rgba(255,255,255,0.45)" stroke={s.carrying ? '#e07a1f' : '#8a7a55'} strokeWidth={5} strokeDasharray="12 8"
          style={s.carrying ? { animation: 'spulse 0.8s ease-in-out infinite' } : undefined} />
        <text x={TRAY.x + TRAY.w / 2} y={TRAY.y + TRAY.h + 34} textAnchor="middle" fontSize={24} fontWeight={700} fill="#33414d">걷어 낸 것</text>
        {scooped.map((x) => {
          const c = x.slot % 6, r = Math.floor(x.slot / 6);
          return grainEl({ ...x, x: TRAY.x + 30 + c * 34, y: TRAY.y + 40 + r * 26 });
        })}

        {/* 그릇 */}
        <g transform={`rotate(${s.angle} ${PIVOT.x} ${PIVOT.y}) translate(${PIVOT.x} ${PIVOT.y})`}>
          <path d="M-60 -50 Q-60 50 40 50 Q140 50 140 -50" fill="#d8c9a3" stroke="#8a7a55" strokeWidth={6} strokeLinejoin="round" />
          {bowlGrains.map((x) => grainEl({ ...x, x: x.lx, y: x.ly }))}
          <path d="M-60 -50 Q-60 50 40 50 Q140 50 140 -50" fill="none" stroke="#8a7a55" strokeWidth={6} />
          <rect data-hit="bowl" x={-90} y={-90} width={260} height={180} fill="transparent" style={{ cursor: 'grab' }} />
        </g>
        {!s.started && s.angle < 20 && <path d="M470 150 q80 -10 100 70 l-16 -12 m16 12 l14 -18" fill="none" stroke="#e07a1f" strokeWidth={8} strokeLinecap="round" style={bounce} />}

        {worldGrains.map(grainEl)}

        {/* 체 */}
        <g transform={`translate(${s.sieve.x} ${s.sieve.y})`}>
          <line x1={30} y1={-30} x2={110} y2={-90} stroke="#7a4a1f" strokeWidth={10} strokeLinecap="round" />
          <circle r={cfg.sieveRadius} fill="rgba(255,255,255,0.25)" stroke="#7a4a1f" strokeWidth={7} />
          <path d={`M${-cfg.sieveRadius} 0 H${cfg.sieveRadius} M0 ${-cfg.sieveRadius} V${cfg.sieveRadius}`} stroke="#7a4a1f" strokeWidth={2} opacity={0.5} />
          <circle data-hit="sieve" r={cfg.sieveRadius + 26} fill="transparent" style={{ cursor: 'grab' }} />
        </g>
        {s.started && !s.carrying && !inTray && s.elapsed < 8 && (
          <path d="M1000 380 h-70 l14 -14 m-14 14 l14 14" fill="none" stroke="#e07a1f" strokeWidth={8} strokeLinecap="round" style={bounce} />
        )}
      </svg>

      <div className="absolute left-6 top-4 text-[26px] font-bold text-[#22303c]">소금물에 띄우기 · {wantedName} 걷기</div>
      {s.started && (
        <div className="absolute right-24 top-5 flex items-center gap-3 text-[24px] font-bold text-[#22303c]">
          <div className="h-3 w-48 overflow-hidden rounded-full bg-black/15"><div className="h-full bg-[#3d5a80]" style={{ width: `${(s.timeLeft / cfg.timeLimit) * 100}%` }} /></div>
          {sec}
        </div>
      )}
      {s.started && !s.result && (
        <button type="button" className="absolute bottom-4 right-6 rounded-xl bg-[#3d5a80] px-6 py-2 text-[22px] font-bold text-white"
          onClick={(e) => { if (!locked()) finish(); e.currentTarget.blur(); }}>다 걷었어요</button>
      )}
      <div className="absolute left-6 top-[62px] max-w-[560px] text-[22px] font-bold text-[#22303c] pointer-events-none">{hint}</div>

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
