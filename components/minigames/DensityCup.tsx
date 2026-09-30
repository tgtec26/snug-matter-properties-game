'use client';

import { useEffect, useRef, useState } from 'react';
import type { InvestigateProps } from '@/game/minigameTypes';
import { playSfx } from '@/game/audio';
import { calcStars, flowRate, labelCorrect, layerOrder, mixDelta, settle } from '@/game/minigames/densityCup';

const CUP = { x: 540, y: 320, w: 200, h: 340 };
const PIVOT = [{ x: 500, y: 300 }, { x: 780, y: 300 }];
const wallX = [CUP.x + 10, CUP.x + CUP.w - 10];
const TAG_HOME = [{ x: 1000, y: 380 }, { x: 1000, y: 480 }];
const now = () => performance.now();
const TAG_W = 150, TAG_H = 56;

export function DensityCup({ targets, config, onDone }: InvestigateProps) {
  const cap = config.fill ?? 0.4;
  const gentle = config.gentleRate ?? 0.25;
  const settleSpeed = config.settleSpeed ?? 0.2;
  const mixTol = config.mixTol ?? 0.3;
  const order = layerOrder(targets); // 위 → 아래

  const sim = useRef({ tilt: [0, 0], amt: [0, 0], mix: 0, peak: 0 });
  const [s, setS] = useState(() => ({ tilt: [0, 0], amt: [0, 0], mix: 0, peak: 0 }));
  const drag = useRef<{ i: number; y0: number; t0: number } | null>(null);
  const keys = useRef([false, false]);
  const lock = useRef(0);
  const doneRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [wrong, setWrong] = useState(0);
  const [tagDrag, setTagDrag] = useState<{ i: number; x: number; y: number } | null>(null);
  const [selTag, setSelTag] = useState(0);
  const [selLayer, setSelLayer] = useState(0);
  const [msg, setMsg] = useState('');
  const [touched, setTouched] = useState(false);
  const [kbd, setKbd] = useState(false);
  const tagOff = useRef({ dx: 0, dy: 0 });

  useEffect(() => { lock.current = now() + 700; }, []);

  // 시뮬레이션 루프
  useEffect(() => {
    let raf = 0, last = now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      let fast = false;
      for (let i = 0; i < 2; i++) {
        if (drag.current?.i === i) { /* tilt는 포인터가 정함 */ }
        else if (keys.current[i]) s.tilt[i] = Math.min(90, s.tilt[i] + 40 * dt);
        else s.tilt[i] = Math.max(0, s.tilt[i] - 200 * dt);
        const rate = flowRate(s.tilt[i]);
        const poured = Math.min(rate * dt, cap - s.amt[i]);
        if (poured > 0) {
          s.amt[i] += poured;
          if (s.amt[1 - i] > 0 && mixDelta(rate, dt, gentle) > 0) { s.mix = Math.min(1, s.mix + mixDelta(rate, dt, gentle, 4)); fast = true; }
        }
      }
      if (!fast) s.mix = settle(s.mix, dt, settleSpeed);
      s.peak = Math.max(s.peak, s.mix);
      setS({ tilt: [...s.tilt], amt: [...s.amt], mix: s.mix, peak: s.peak });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cap, gentle, settleSpeed]);

  const full = s.amt[0] >= cap - 0.001 && s.amt[1] >= cap - 0.001;
  const phase: 'pour' | 'label' | 'done' = Object.keys(placed).length >= 2 ? 'done' : full && s.mix < 0.15 ? 'label' : 'pour';
  const stars = calcStars(wrong, s.peak, mixTol);

  // 층 좌표 (위=0). 아래부터 쌓는다.
  const layerRect = (idx: number) => {
    let bottom = CUP.y + CUP.h;
    for (let k = order.length - 1; k >= 0; k--) {
      const t = targets.indexOf(order[k]);
      const h = s.amt[t] * CUP.h;
      if (k === idx) return { x0: CUP.x, x1: CUP.x + CUP.w, y0: bottom - h, y1: bottom, h };
      bottom -= h;
    }
    return { x0: 0, x1: 0, y0: 0, y1: 0, h: 0 };
  };
  const surfaceY = CUP.y + CUP.h - (s.amt[0] + s.amt[1]) * CUP.h;

  const toStage = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * 1280) / r.width, y: ((e.clientY - r.top) * 800) / r.height };
  };
  const unlocked = () => now() >= lock.current;

  const attach = (ti: number, li: number) => {
    const ok = labelCorrect(targets[ti].id, li, order);
    if (ok) {
      playSfx('correct');
      const next = { ...placed, [targets[ti].id]: li };
      setPlaced(next);
      setMsg('');
      if (Object.keys(next).length >= 2) setMsg(`${order[0].name}: ${order[1].name}보다 밀도가 작다`);
      else setSelTag(targets.findIndex(t => next[t.id] === undefined));
    } else { playSfx('error'); setWrong(w => w + 1); setMsg('밀도가 작은 것이 위로 떠요'); }
  };

  const finish = () => {
    if (doneRef.current || !unlocked() || phase !== 'done') return;
    doneRef.current = true;
    playSfx('success');
    onDone({ stars });
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!unlocked()) return;
      const k = e.key;
      const isArrow = k.startsWith('Arrow');
      if (isArrow) e.preventDefault();
      if (phase === 'pour') {
        if (k === 'ArrowLeft') { keys.current[0] = true; setTouched(true); setKbd(true); }
        if (k === 'ArrowRight') { keys.current[1] = true; setTouched(true); setKbd(true); }
      } else if (phase === 'label') {
        const open = targets.map((t, i) => i).filter(i => placed[targets[i].id] === undefined);
        if (k === 'ArrowLeft' || k === 'ArrowRight') { setKbd(true); const j = open.indexOf(selTag); setSelTag(open[(j + 1) % open.length] ?? open[0]); }
        if (k === 'ArrowUp') { setKbd(true); setSelLayer(0); }
        if (k === 'ArrowDown') { setKbd(true); setSelLayer(1); }
        if ((k === 'Enter' || k === ' ') && !e.repeat && open.includes(selTag)) { e.preventDefault(); attach(selTag, selLayer); }
      } else if ((k === 'Enter' || k === ' ') && !e.repeat) { e.preventDefault(); finish(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current[0] = false;
      if (e.key === 'ArrowRight') keys.current[1] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  const bottleDown = (e: React.PointerEvent, i: number) => {
    if (!unlocked() || phase !== 'pour') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { i, y0: toStage(e).y, t0: sim.current.tilt[i] };
    setTouched(true);
  };
  const bottleMove = (e: React.PointerEvent, i: number) => {
    const d = drag.current;
    if (!d || d.i !== i) return;
    sim.current.tilt[i] = Math.max(0, Math.min(90, d.t0 + (toStage(e).y - d.y0) * 0.6));
  };
  const bottleUp = (i: number) => { if (drag.current?.i === i) drag.current = null; };

  const tagPos = (i: number) => {
    const li = placed[targets[i].id];
    if (li !== undefined) { const r = layerRect(li); return { x: CUP.x + CUP.w + 60 + TAG_W / 2, y: (r.y0 + r.y1) / 2 }; }
    return TAG_HOME[i];
  };
  const tagDown = (e: React.PointerEvent, i: number) => {
    if (!unlocked() || phase !== 'label' || placed[targets[i].id] !== undefined) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toStage(e), h = tagPos(i);
    tagOff.current = { dx: h.x - p.x, dy: h.y - p.y };
    setTagDrag({ i, x: h.x, y: h.y });
    setSelTag(i);
  };
  const tagMove = (e: React.PointerEvent) => {
    if (!tagDrag) return;
    const p = toStage(e);
    setTagDrag({ i: tagDrag.i, x: p.x + tagOff.current.dx, y: p.y + tagOff.current.dy });
  };
  const tagUp = (e: React.PointerEvent) => {
    if (!tagDrag) return;
    const p = toStage(e), i = tagDrag.i;
    setTagDrag(null);
    if (e.type !== 'pointerup') return;
    for (let li = 0; li < 2; li++) {
      const r = layerRect(li);
      if (p.x >= r.x0 - 40 && p.x <= r.x1 + 40 && p.y >= r.y0 && p.y <= r.y1) { attach(i, li); return; }
    }
  };

  const nextStyle = { left: 1010, top: 700, width: 200, height: 56 } as const;
  const bottleColor = (i: number) => targets[i].color;

  return (
    <div ref={rootRef} className="absolute inset-0 pointer-events-auto select-none overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#3b2f4f,#1c1830)', touchAction: 'none', color: '#fff' }}>
      <style>{`@keyframes dc-pulse{0%,100%{opacity:.3}50%{opacity:1}}@keyframes dc-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(16px)}}`}</style>

      <div className="absolute w-full text-center text-xl font-bold" style={{ top: 40, minHeight: 32, color: '#ffe082' }}>{msg}</div>

      {/* 탁자 */}
      <div className="absolute" style={{ left: 200, top: 660, width: 880, height: 14, background: '#5d4037', borderRadius: 6 }} />

      {/* 컵 */}
      <div className="absolute" style={{ left: CUP.x, top: CUP.y - 20, width: CUP.w, height: CUP.h + 20, borderLeft: '4px solid rgba(220,240,255,.85)', borderRight: '4px solid rgba(220,240,255,.85)', borderBottom: '4px solid rgba(220,240,255,.85)', borderRadius: '0 0 18px 18px', background: 'rgba(200,230,255,.07)' }} />
      <svg className="absolute" style={{ left: 0, top: 0, pointerEvents: 'none' }} width="1280" height="800">
        <g style={{ filter: `blur(${s.mix * 5}px)` }}>
          {order.map((sub, k) => { const r = layerRect(k); return r.h > 0 && <rect key={sub.id} x={CUP.x + 4} y={r.y0} width={CUP.w - 8} height={r.h} fill={sub.color} opacity=".85" />; })}
        </g>
        {s.amt[0] + s.amt[1] > 0 && <rect x={CUP.x + 4} y={surfaceY} width={CUP.w - 8} height={CUP.y + CUP.h - surfaceY} fill="#f3ecd0" opacity={s.mix * 0.8} />}
        {/* 흐르는 줄기 (벽면을 타고) */}
        {[0, 1].map(i => flowRate(s.tilt[i]) > 0 && s.amt[i] < cap && (
          <path key={i} d={`M${PIVOT[i].x} ${PIVOT[i].y} Q${wallX[i]} ${PIVOT[i].y} ${wallX[i]} ${CUP.y + 30} L${wallX[i]} ${surfaceY}`} fill="none" stroke={bottleColor(i)} strokeWidth={4 + flowRate(s.tilt[i]) * 14} opacity=".9" strokeLinecap="round" />
        ))}
        {phase === 'label' && [0, 1].map(li => { const r = layerRect(li); return <rect key={li} x={r.x0 + 2} y={r.y0 + 2} width={r.x1 - r.x0 - 4} height={r.h - 4} fill="none" stroke={kbd && selLayer === li ? '#7CFF9A' : '#ffe082'} strokeWidth="3" strokeDasharray="10 8" style={{ animation: 'dc-pulse 1.2s infinite' }} />; })}
      </svg>

      {/* 병 (입구를 축으로 기울임) */}
      {[0, 1].map(i => {
        const left = i === 0;
        return (
          <div key={i} className="absolute" style={{ left: PIVOT[i].x, top: PIVOT[i].y, width: 0, height: 0, transform: `rotate(${left ? s.tilt[i] : -s.tilt[i]}deg)`, transformOrigin: '0 0' }}>
            <div onPointerDown={e => bottleDown(e, i)} onPointerMove={e => bottleMove(e, i)} onPointerUp={() => bottleUp(i)} onPointerCancel={() => bottleUp(i)} onLostPointerCapture={() => bottleUp(i)}
              style={{ position: 'absolute', left: -70, top: -10, width: 140, height: 230, cursor: 'grab', touchAction: 'none' }}>
              <div style={{ position: 'absolute', left: 55, top: 10, width: 30, height: 34, background: 'rgba(230,240,255,.5)', border: '3px solid #cfd8dc', borderBottom: 'none' }} />
              <div style={{ position: 'absolute', left: 15, top: 44, width: 110, height: 170, border: '3px solid #cfd8dc', borderRadius: '24px 24px 12px 12px', background: 'rgba(230,240,255,.15)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${(1 - s.amt[i] / cap) * 90}%`, background: bottleColor(i), opacity: 0.85 }} />
              </div>
            </div>
          </div>
        );
      })}
      {phase === 'pour' && !touched && (
        <svg className="absolute" style={{ left: PIVOT[0].x - 160, top: 330, animation: 'dc-bob 1s infinite' }} width="50" height="70"><path d="M25 4V56M10 42L25 58L40 42" stroke="#ffe082" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}

      {/* 이름표 */}
      {phase !== 'pour' && targets.map((t, i) => {
        const pos = tagDrag?.i === i ? tagDrag : tagPos(i);
        const isPlaced = placed[t.id] !== undefined;
        return (
          <div key={t.id} onPointerDown={e => tagDown(e, i)} onPointerMove={tagMove} onPointerUp={tagUp} onPointerCancel={tagUp} onLostPointerCapture={tagUp}
            className="absolute flex items-center justify-center rounded-lg font-bold text-2xl"
            style={{ left: pos.x - TAG_W / 2, top: pos.y - TAG_H / 2, width: TAG_W, height: TAG_H, background: '#fff8e1', color: '#3e2723', border: `3px solid ${kbd && selTag === i && !isPlaced ? '#7CFF9A' : t.color}`, cursor: isPlaced ? 'default' : 'grab', touchAction: 'none', zIndex: tagDrag?.i === i ? 20 : 5, transition: tagDrag?.i === i ? 'none' : 'left .3s, top .3s' }}>
            {t.name}
          </div>
        );
      })}
      {phase === 'label' && !tagDrag && (
        <svg className="absolute" style={{ left: 860, top: 420, animation: 'dc-pulse 1s infinite' }} width="120" height="40"><path d="M116 20H8M22 6L6 20L22 34" stroke="#ffe082" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}

      {phase === 'done' && (
        <button onClick={finish} className="absolute rounded-lg font-bold text-xl" style={{ ...nextStyle, background: '#f9a825', color: '#222', border: '2px solid #fff' }}>다음</button>
      )}
    </div>
  );
}
