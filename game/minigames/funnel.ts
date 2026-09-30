/** 분별 깔때기 판정 (순수 함수). p = 꼭지로 내려보낸 양 / 아래층 전체 양 (경계면이 꼭지에 닿을 때 p = 1). */
export interface FunnelCfg { settleSeconds: number; drainSeconds: number; band: number; tolerance: number; errScale: number }

export const FUNNEL_DEFAULTS: FunnelCfg = {
  settleSeconds: 8,   // 흔들지 않을 때 층이 나뉘는 데 걸리는 시간
  drainSeconds: 4,    // 아래층 전체가 꼭지로 빠지는 시간
  band: 0.18,         // 경계면 액체가 차지하는 반 폭 (아래층 양 대비)
  tolerance: 0.08,    // 놓는 위치 허용 폭
  errScale: 0.8,      // 이만큼 어긋나면 순도 0
};

export function funnelCfg(c: Record<string, number> = {}): FunnelCfg {
  return {
    settleSeconds: c.settleSeconds ?? FUNNEL_DEFAULTS.settleSeconds,
    drainSeconds: c.drainSeconds ?? FUNNEL_DEFAULTS.drainSeconds,
    band: c.band ?? FUNNEL_DEFAULTS.band,
    tolerance: c.tolerance ?? FUNNEL_DEFAULTS.tolerance,
    errScale: c.errScale ?? FUNNEL_DEFAULTS.errScale,
  };
}

/** 층 분리 진행도(0~1). shake는 이번 프레임의 흔든 정도(0~1 환산), 흔들면 되돌아간다. */
export function settleStep(s: number, dt: number, shake: number, cfg: FunnelCfg): number {
  return Math.min(1, Math.max(0, s + dt / cfg.settleSeconds - shake));
}

export type FunnelReason = 'clean' | 'left-water' | 'boundary-in-water' | 'boundary-left' | 'oil-lost';

export interface FunnelJudge { purity: number; stars: 0 | 1 | 2 | 3; reason: FunnelReason }

/** pA = 비커 (가) 쪽 꼭지를 놓은 위치, pB = 경계면 작은 비커 쪽을 놓은 위치. */
export function judgeFunnel(pA: number, pB: number, cfg: FunnelCfg): FunnelJudge {
  const idealA = 1 - cfg.band;
  const idealB = 1 + cfg.band;
  const eA = Math.max(0, Math.abs(pA - idealA) - cfg.tolerance - 1e-9);
  const eB = Math.max(0, Math.abs(pB - idealB) - cfg.tolerance - 1e-9);
  const purity = Math.min(1, Math.max(0, 1 - (eA + eB) / cfg.errScale));
  const stars = (purity >= 0.95 ? 3 : purity >= 0.75 ? 2 : purity >= 0.4 ? 1 : 0) as 0 | 1 | 2 | 3;
  let reason: FunnelReason = 'clean';
  if (eA >= eB && eA > 0) reason = pA < idealA ? 'left-water' : 'boundary-in-water';
  else if (eB > 0) reason = pB < idealB ? 'boundary-left' : 'oil-lost';
  return { purity, stars, reason };
}
