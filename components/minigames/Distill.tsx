'use client';
import { GlassG, StageBg } from '@/components/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SeparateProps } from '@/game/minigameTypes';
import { playSfx } from '@/game/audio';
import {
  DISTILL_DEFAULTS, bumps, done, initDistill, isBoiling, purityOf, starsFromPurity, stepDistill,
  type DistillState,
} from '@/game/minigames/distill';

const FLASK = { x: 230, y: 360 };
const DIAL = { x: 230, y: 706 };
const RACK = { x: 760, y: 600, gap: 100 };
const ICE = { x: 1150, y: 470 };
const LABELS = ['가', '나', '다', '라', '마', '바'];
const G = { x: 520, y: 50, w: 720, h: 260 };
const TOOL_HOME = { rod: { x: 620, y: 420 }, paper: { x: 620, y: 500 } };

type Phase = 'run' | 'bump' | 'end';
type Tool = 'rod' | 'paper';

export function Distill({ obtains, saltRemains, config, onDone }: SeparateProps) {
  const cfg = useMemo(() => ({
    ...DISTILL_DEFAULTS,
    maxRate: config.maxRate ?? DISTILL_DEFAULTS.maxRate,
    distillRate: config.distillRate ?? DISTILL_DEFAULTS.distillRate,
    heatUp: config.heatUp ?? DISTILL_DEFAULTS.heatUp,
  }), [config]);
  const bps = useMemo(() => obtains.map((o) => o.boilingPoint ?? 100), [obtains]);
  const n = obtains.length;
  const nTubes = 2 * n;
  const th = { s3: config.s3 ?? 0.85, s2: config.s2 ?? 0.65, s1: config.s1 ?? 0.4 };

  const sim = useRef<DistillState>(initDistill(n, cfg));
  const hist = useRef<{ t: number; T: number }[]>([{ t: 0, T: cfg.startTemp }]);
  const clock = useRef(0);
  const power = useRef(0);
  const chip = useRef(false);
  const phase = useRef<Phase>('run');
  const locked = useRef(true);
  const doneRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [v, setV] = useState(() => ({ s: initDistill(n, cfg), power: 0, chip: false, phase: 'run' as Phase, clock: 0, hist: [{ t: 0, T: cfg.startTemp }] }));
  const [drag, setDrag] = useState<{ kind: 'chip' | 'dial' | Tool; x: number; y: number } | null>(null);
  const [tools, setTools] = useState<Record<Tool, boolean>>({ rod: false, paper: false });

  const lock = (ms = 700) => { locked.current = true; setTimeout(() => { locked.current = false; }, ms); };
  useEffect(() => { lock(); }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const restart = useCallback(() => {
    sim.current = initDistill(n, cfg); hist.current = [{ t: 0, T: cfg.startTemp }]; clock.current = 0;
    power.current = 0; chip.current = false; phase.current = 'run'; setTools({ rod: false, paper: false });
  }, [n, cfg]);

  // 시뮬레이션 루프
  useEffect(() => {
    let raf = 0, last = performance.now(), sampled = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (phase.current === 'run') {
        const before = done(sim.current);
        if (!before && power.current > 0) {
          sim.current = stepDistill(sim.current, bps, power.current, dt, cfg);
          clock.current += dt;
          sampled += dt;
          if (sampled >= 0.2) { sampled = 0; hist.current.push({ t: clock.current, T: sim.current.temp }); }
          if (bumps(chip.current, sim.current, bps)) {
            phase.current = 'bump'; playSfx('error'); setTimeout(restart, 1800);
          } else if (done(sim.current)) {
            phase.current = 'end'; lock(); playSfx('success');
          }
        } else if (before) { phase.current = 'end'; }
      }
      setV({ s: sim.current, power: power.current, chip: chip.current, phase: phase.current, clock: clock.current, hist: hist.current.slice() });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bps, cfg, restart]);

  const s = v.s;
  const purity = purityOf(s, cfg);
  const stars = starsFromPurity(purity, th);

  const selectTube = useCallback((i: number) => {
    if (phase.current !== 'run') return;
    sim.current = { ...sim.current, tube: Math.max(0, Math.min(nTubes - 1, i)) };
    playSfx('correct');
  }, [nTubes]);
  const ice = useCallback(() => { if (phase.current === 'run') { sim.current = { ...sim.current, coolant: 0 }; playSfx('correct'); } }, []);
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const dip = useCallback((k: Tool) => {
    const id = k === 'rod' ? 'ethanol' : 'water';
    if (obtains.some((o) => o.id === id)) { setTools((t) => ({ ...t, [k]: true })); playSfx('correct'); }
  }, [obtains]);
  const finish = useCallback(() => {
    if (doneRef.current || locked.current) return;
    doneRef.current = true;
    onDone({ stars, purity });
  }, [onDone, stars, purity]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key;
      if (phase.current === 'end') {
        if (k === ' ' || k === 'Enter') { e.preventDefault(); finish(); }
        else if (k === 'r') dip('rod'); else if (k === 'p') dip('paper');
        return;
      }
      if (phase.current !== 'run') return;
      if (k === ' ' || k === 'Enter' || k === 'ArrowRight') { e.preventDefault(); selectTube(sim.current.tube + 1); }
      else if (k === 'ArrowLeft') selectTube(sim.current.tube - 1);
      else if (k === 'ArrowUp') { e.preventDefault(); power.current = Math.min(1, power.current + 0.1); }
      else if (k === 'ArrowDown') { e.preventDefault(); power.current = Math.max(0, power.current - 0.1); }
      else if (k === 'i') ice();
      else if (k === 'c') { chip.current = true; playSfx('correct'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectTube, ice, dip, finish]);

  const loc = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1280, y: ((e.clientY - r.top) / r.height) * 800 };
  };
  const dialSet = (p: { x: number; y: number }) => {
    const a = (Math.atan2(p.x - DIAL.x, -(p.y - DIAL.y)) * 180) / Math.PI;
    power.current = a < -135 ? 0 : a > 135 ? 1 : (a + 135) / 270;
  };
  const down = (kind: 'chip' | 'dial' | Tool, e: React.PointerEvent) => {
    if (locked.current) return;
    if ((kind === 'chip' && (chip.current || phase.current !== 'run')) || (kind === 'dial' && phase.current !== 'run')) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = loc(e); setDrag({ kind, ...p });
    if (kind === 'dial') dialSet(p);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = loc(e); setDrag({ ...drag, ...p });
    if (drag.kind === 'dial') dialSet(p);
  };
  const up = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = loc(e);
    if (drag.kind === 'chip' && Math.hypot(p.x - FLASK.x, p.y - FLASK.y) < 130) { chip.current = true; playSfx('correct'); }
    if (drag.kind === 'rod' || drag.kind === 'paper') {
      const j = obtains.findIndex((o) => o.id === (drag.kind === 'rod' ? 'ethanol' : 'water'));
      if (j >= 0 && Math.hypot(p.x - (RACK.x + (2 * j + 1) * RACK.gap), p.y - RACK.y) < 90) dip(drag.kind);
    }
    setDrag(null);
  };

  const boiling = isBoiling(s, bps);
  const activeI = s.remaining.findIndex((v) => v > 0);
  const flaskFrac = s.remaining.reduce((a, v) => a + v, 0) / (n * cfg.volume);
  const flaskColor = activeI >= 0 ? obtains[activeI].color : '#ffffff';
  const warm = Math.min(1, s.coolant / (cfg.warmAt * 1.2));
  const bathColor = `rgb(${Math.round(127 + 90 * warm)},${Math.round(208 - 14 * warm)},${Math.round(255 - 130 * warm)})`;
  const tMax = Math.max(60, v.clock * 1.15);
  const yMax = Math.max(...bps) + 30;
  const gx = (t: number) => G.x + (t / tMax) * G.w;
  const gy = (T: number) => G.y + G.h - (T / yMax) * G.h;
  const powerAng = -135 + v.power * 270;
  const rad = (powerAng * Math.PI) / 180;
  const chipPos = drag?.kind === 'chip' ? drag : v.chip ? null : { x: 90, y: 250 };
  const toolPos = (k: Tool) => (drag?.kind === k ? drag : TOOL_HOME[k]);
  const ended = v.phase === 'end';
  const ethTube = obtains.findIndex((o) => o.id === 'ethanol');
  const watTube = obtains.findIndex((o) => o.id === 'water');
  const msg = v.phase === 'bump' ? '끓임쪽이 없어서 끓어 넘쳤어요. 다시 해요'
    : tools.rod && tools.paper ? '에탄올 냄새가 나고 종이가 붉게 변했어요'
    : tools.rod ? '에탄올 냄새가 나요' : tools.paper ? '푸른 종이가 붉게 변했어요'
    : ended ? `순도 ${Math.round(purity * 100)} %` : '';

  return (
    <div className="absolute inset-0 pointer-events-auto overflow-hidden select-none"
      style={{ background: 'linear-gradient(160deg,#1b2a44,#0e1626)', wordBreak: 'keep-all' }}>
      <StageBg name="labheat" dark={0.5} />
      <style>{`@keyframes dist-blink{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <svg ref={svgRef} viewBox="0 0 1280 800" width="1280" height="800" className="absolute inset-0"
        style={{ touchAction: 'none' }} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
        {/* 그래프 */}
        <rect {...G} rx="10" fill="#0a1220" stroke="#3a4f73" strokeWidth="2" />
        {[0, 20, 40, 60, 80, 100, 120].filter((v) => v <= yMax).map((v) => (
          <g key={v}><line x1={G.x} x2={G.x + G.w} y1={gy(v)} y2={gy(v)} stroke="#22344f" /><text x={G.x - 10} y={gy(v) + 6} fill="#8fa6c8" fontSize="18" textAnchor="end">{v}</text></g>
        ))}
        <text x={G.x - 10} y={G.y - 12} fill="#8fa6c8" fontSize="18" textAnchor="end">온도(℃)</text>
        <polyline points={v.hist.map((h) => `${gx(h.t)},${gy(h.T)}`).join(' ')} fill="none" stroke="#ffb454" strokeWidth="4" strokeLinejoin="round" />
        <circle cx={gx(v.clock)} cy={gy(s.temp)} r="7" fill="#ffd27a" />
        <text x={G.x + G.w - 10} y={G.y + 32} fill="#ffd27a" fontSize="28" fontWeight="700" textAnchor="end">{Math.round(s.temp)} ℃</text>

        {/* 가열판(Codex 그림) + 가열 불빛 */}
        {v.power > 0 && <ellipse cx={FLASK.x} cy={FLASK.y + 150} rx={70 + v.power * 30} ry={12 + v.power * 6} fill="#ff8a3c" opacity={0.35 + v.power * 0.5} />}
        <image href="/assets/items/hotplate.webp" x={FLASK.x - 130} y={FLASK.y + 106} width={260} height={163} />
        {/* 가지 달린 삼각 플라스크(Codex 그림) + 안쪽 액체 */}
        <GlassG name="flask-arm" x={FLASK.x - 133} y={FLASK.y - 180} w={267} h={330}>
          <rect x={FLASK.x - 140} y={FLASK.y + 127 - 165 * flaskFrac} width={280} height={165 * flaskFrac + 2} fill={flaskColor} opacity="0.8" />
          {ended && saltRemains && [[-50, 112], [-20, 108], [10, 114], [40, 110], [-5, 100], [25, 102]].map(([dx, dy], i) => (
            <rect key={i} x={FLASK.x + dx} y={FLASK.y + dy} width="16" height="16" fill="#ffffff" transform={`rotate(${i * 17} ${FLASK.x + dx + 8} ${FLASK.y + dy + 8})`}>
              <animate attributeName="opacity" values="0;1" dur={`${0.4 + i * 0.15}s`} fill="freeze" />
            </rect>
          ))}
        </GlassG>
        {ended && saltRemains && <text x={FLASK.x} y={FLASK.y + 205} fill="#fff" stroke="#3a2412" strokeWidth="5" paintOrder="stroke" fontSize="22" fontWeight="800" textAnchor="middle">정제 소금</text>}
        {boiling && [-25, 5, 30].map((dx) => (
          <circle key={dx} cx={FLASK.x + dx} cy={FLASK.y + 100} r="7" fill="#ffffffaa"><animate attributeName="cy" values={`${FLASK.y + 120};${FLASK.y + 20}`} dur="0.7s" repeatCount="indefinite" /></circle>
        ))}
        {/* 끓임쪽 넣을 자리 */}
        {!v.chip && v.phase === 'run' && (
          <circle cx={FLASK.x} cy={FLASK.y + 20} r="120" fill="none" stroke="#ffd27a" strokeWidth="4" strokeDasharray="10 10">
            <animate attributeName="stroke-opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}
        {v.chip && <image href="/assets/items/boiling-chips.webp" x={FLASK.x - 18} y={FLASK.y + 104} width={36} height={28} />}
        {chipPos && (
          <g transform={`translate(${chipPos.x} ${chipPos.y})`} onPointerDown={(e) => down('chip', e)} style={{ cursor: 'grab', touchAction: 'none' }}>
            <circle r="60" fill="transparent" />
            <image href="/assets/items/boiling-chips.webp" x="-34" y="-26" width="68" height="52" />
            {!drag && <path d="M0 -70 L0 -40 M-12 -52 L0 -38 L12 -52" stroke="#ffd27a" strokeWidth="5" fill="none" strokeLinecap="round"><animate attributeName="transform" values="translate(0 0);translate(0 14);translate(0 0)" dur="1s" repeatCount="indefinite" /></path>}
            <text y="56" fill="#fff" stroke="#3a2412" strokeWidth="5" paintOrder="stroke" fontSize="22" fontWeight="800" textAnchor="middle">끓임쪽</text>
          </g>
        )}

        {/* 가열 세기 다이얼 */}
        <g onPointerDown={(e) => down('dial', e)} style={{ cursor: 'grab', touchAction: 'none' }}>
          <circle cx={DIAL.x} cy={DIAL.y} r="82" fill="#2a374f" stroke="#55708f" strokeWidth="4" />
          <circle cx={DIAL.x} cy={DIAL.y} r="56" fill="#3d4f70" />
          <line x1={DIAL.x} y1={DIAL.y} x2={DIAL.x + Math.sin(rad) * 52} y2={DIAL.y - Math.cos(rad) * 52} stroke="#ff9a3c" strokeWidth="8" strokeLinecap="round" />
          {v.power === 0 && !drag && v.phase === 'run' && (
            <path d={`M${DIAL.x - 60} ${DIAL.y - 96} q60 -30 120 0`} stroke="#ffd27a" strokeWidth="5" fill="none" strokeDasharray="4 10" strokeLinecap="round">
              <animate attributeName="stroke-dashoffset" values="0;-28" dur="0.8s" repeatCount="indefinite" />
            </path>
          )}
          <text x={DIAL.x + 96} y={DIAL.y + 10} fill="#fff" stroke="#3a2412" strokeWidth="5" paintOrder="stroke" fontSize="26" fontWeight="800">가열 세기</text>
        </g>

        {/* 냉각기 관: 플라스크 가지 끝에서 시험관 위로 */}
        <path d={`M${FLASK.x + 128} ${FLASK.y - 114} L${FLASK.x + 200} ${FLASK.y - 114} L${RACK.x + s.tube * RACK.gap} ${RACK.y - 110}`} fill="none" stroke="#2a3a52" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
        <path d={`M${FLASK.x + 128} ${FLASK.y - 114} L${FLASK.x + 200} ${FLASK.y - 114} L${RACK.x + s.tube * RACK.gap} ${RACK.y - 110}`} fill="none" stroke="#e6f4ff" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
        {boiling && <circle cx={RACK.x + s.tube * RACK.gap} cy={RACK.y - 100} r="7" fill={flaskColor}><animate attributeName="cy" values={`${RACK.y - 108};${RACK.y - 40}`} dur="0.5s" repeatCount="indefinite" /></circle>}

        {/* 얼음물: 시험관을 담가 기체를 식혀 액체로 만든다 */}
        <rect x={RACK.x - 70} y={RACK.y - 10} width={nTubes * RACK.gap + 40} height="170" rx="22" fill={bathColor} opacity="0.62" stroke="#dff1ff" strokeWidth="4" />
        {Array.from({ length: nTubes * 2 }, (_, i) => (
          <image key={i} href="/assets/items/ice.webp" x={RACK.x - 56 + i * (RACK.gap / 2) - 18} y={RACK.y + 96 + ((i * 37) % 30)} width={40} height={40} opacity={0.9 - warm * 0.5} transform={`rotate(${(i * 43) % 60 - 30} ${RACK.x - 56 + i * (RACK.gap / 2)} ${RACK.y + 116})`} />
        ))}
        <text x={RACK.x - 84} y={RACK.y + 62} fill="#fff" stroke="#3a2412" strokeWidth="5" paintOrder="stroke" fontSize="28" fontWeight="800" textAnchor="end">얼음물</text>
        <text x={RACK.x - 84} y={RACK.y + 96} fill="#fff" stroke="#3a2412" strokeWidth="5" paintOrder="stroke" fontSize="20" fontWeight="800" textAnchor="end">기체를 식혀 액체로</text>
        {Array.from({ length: nTubes }, (_, i) => {
          const x = RACK.x + i * RACK.gap;
          const tot = s.collected[i].reduce((a, v) => a + v, 0);
          const frac = Math.min(1, tot / cfg.volume);
          const dom = s.collected[i].indexOf(Math.max(...s.collected[i]));
          const sel = s.tube === i;
          return (
            <g key={i} onPointerDown={() => !locked.current && selectTube(i)} style={{ cursor: 'pointer', touchAction: 'none' }}>
              <rect x={x - 44} y={RACK.y - 150} width="88" height="320" fill="transparent" />
              {sel && <rect x={x - 32} y={RACK.y - 66} width="64" height="230" rx="30" fill="#ffd27a" opacity="0.28" />}
              <GlassG name="tube1" x={x - 22} y={RACK.y - 60} w={44} h={205}>
                {tot > 0 && <rect x={x - 30} y={RACK.y + 132 - 140 * frac} width="60" height={140 * frac + 2} fill={obtains[dom].color} opacity="0.92" />}
              </GlassG>
              <text x={x} y={RACK.y + 190} fill="#fff" stroke="#3a2412" strokeWidth="5" paintOrder="stroke" fontSize="26" fontWeight="800" textAnchor="middle">({LABELS[i]})</text>
              {sel && <path d={`M${x - 14} ${RACK.y - 84} L${x} ${RACK.y - 64} L${x + 14} ${RACK.y - 84}z`} fill="#ffd27a"><animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite" /></path>}
            </g>
          );
        })}
        {/* 얼음 보충: 얼음물이 미지근해지면(붉게 변하면) 눌러 식힌다 */}
        <g onPointerDown={() => !locked.current && ice()} style={{ cursor: 'pointer', touchAction: 'none' }}>
          <circle cx={ICE.x} cy={ICE.y} r="80" fill="transparent" />
          <image href="/assets/items/icebucket.webp" x={ICE.x - 62} y={ICE.y - 50} width={124} height={98} style={warm > 0.66 ? { animation: 'dist-blink .6s infinite' } : undefined} />
          <text x={ICE.x} y={ICE.y + 76} fill="#fff" stroke="#3a2412" strokeWidth="5" paintOrder="stroke" fontSize="24" fontWeight="800" textAnchor="middle">얼음 넣기</text>
          {warm > 0.66 && <text x={ICE.x} y={ICE.y - 66} fill="#ffd27a" stroke="#3a2412" strokeWidth="5" paintOrder="stroke" fontSize="22" fontWeight="800" textAnchor="middle">물이 미지근해요!</text>}
        </g>

        {/* 확인 도구 */}
        {ended && ethTube >= 0 && !tools.rod && (
          <g transform={`translate(${toolPos('rod').x} ${toolPos('rod').y})`} onPointerDown={(e) => down('rod', e)} style={{ cursor: 'grab', touchAction: 'none' }}>
            <circle r="50" fill="transparent" /><rect x="-60" y="-5" width="120" height="10" rx="5" fill="#d9ecf7" /><text y="34" fill="#dfe8f5" fontSize="20" textAnchor="middle">유리 막대</text>
          </g>
        )}
        {ended && watTube >= 0 && (
          <g transform={`translate(${toolPos('paper').x} ${toolPos('paper').y})`} onPointerDown={(e) => down('paper', e)} style={{ cursor: 'grab', touchAction: 'none' }}>
            <circle r="50" fill="transparent" />
            {!tools.paper && <rect x="-24" y="-30" width="48" height="60" rx="3" fill="#3f6fe0" />}
            {tools.paper && <rect x="-24" y="-30" width="48" height="60" rx="3" fill="#e04a4a" />}
            <text y="52" fill="#dfe8f5" fontSize="20" textAnchor="middle">염화 코발트 종이</text>
          </g>
        )}
        {ended && ethTube >= 0 && tools.rod && (
          <g><rect x={RACK.x + (2 * ethTube + 1) * RACK.gap - 90} y={RACK.y - 250} width="180" height="50" rx="14" fill="#fff" /><text x={RACK.x + (2 * ethTube + 1) * RACK.gap} y={RACK.y - 218} fontSize="22" textAnchor="middle" fill="#234">에탄올 냄새</text></g>
        )}
      </svg>

      <div className="absolute left-0 right-0 text-center text-white" style={{ top: 730, fontSize: 26 }}>{msg}</div>
      {ended && (
        <button onClick={finish} className="absolute rounded-xl font-bold text-white px-10"
          style={{ left: 980, top: 690, height: 76, fontSize: 30, background: '#2f7be0' }}>다음</button>
      )}
    </div>
  );
}
