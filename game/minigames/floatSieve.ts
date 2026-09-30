import type { Substance } from '@/game/types';

/** 소금물에 띄우기 판정 (순수 함수). */
export interface SieveCfg { huskCount: number; riceCount: number; timeLimit: number; ricePenalty: number; sieveRadius: number }

export const SIEVE_DEFAULTS: SieveCfg = {
  huskCount: 5, riceCount: 8, timeLimit: 60, ricePenalty: 1, sieveRadius: 46,
};

export function sieveCfg(c: Record<string, number> = {}): SieveCfg {
  return {
    huskCount: c.huskCount ?? SIEVE_DEFAULTS.huskCount,
    riceCount: c.riceCount ?? SIEVE_DEFAULTS.riceCount,
    timeLimit: c.timeLimit ?? SIEVE_DEFAULTS.timeLimit,
    ricePenalty: c.ricePenalty ?? SIEVE_DEFAULTS.ricePenalty,
    sieveRadius: c.sieveRadius ?? SIEVE_DEFAULTS.sieveRadius,
  };
}

export interface Grain { id: number; substanceId: string; floats: boolean; wanted: boolean }

/** 혼합물의 고체 중 뜨는 것(floatsInSaltwater)은 huskCount개, 가라앉는 것은 riceCount개. wanted = obtains에 든 것. */
export function makeGrains(mixture: Substance[], obtains: Substance[], cfg: SieveCfg): Grain[] {
  const solids = mixture.filter((s) => s.state === 'solid');
  const floater = solids.find((s) => s.floatsInSaltwater === true);
  const sinker = solids.find((s) => s.floatsInSaltwater !== true);
  const want = new Set(obtains.map((o) => o.id));
  const out: Grain[] = [];
  const add = (s: Substance | undefined, n: number, floats: boolean) => {
    if (!s) return;
    for (let i = 0; i < n; i++) out.push({ id: out.length, substanceId: s.id, floats, wanted: want.has(s.id) });
  };
  add(sinker, cfg.riceCount, false);
  add(floater, cfg.huskCount, true);
  // 섞어서 그릇에 담긴 모양
  return out.map((g, i) => ({ g, k: (i * 7919) % 97 })).sort((a, b) => a.k - b.k).map((x, i) => ({ ...x.g, id: i }));
}

export function inSieve(gx: number, gy: number, sx: number, sy: number, r: number): boolean {
  return Math.hypot(gx - sx, gy - sy) <= r;
}

export interface SieveJudge { wantedCaught: number; wantedTotal: number; otherCaught: number; purity: number; stars: 0 | 1 | 2 | 3 }

export function judgeSieve(scooped: Grain[], all: Grain[], cfg: SieveCfg): SieveJudge {
  const wantedTotal = all.filter((g) => g.wanted).length;
  const wantedCaught = scooped.filter((g) => g.wanted).length;
  const otherCaught = scooped.length - wantedCaught;
  const frac = wantedTotal === 0 ? 0 : Math.min(1, Math.max(0, wantedCaught - otherCaught * cfg.ricePenalty) / wantedTotal);
  const stars = (frac >= 1 ? 3 : frac >= 0.7 ? 2 : frac >= 0.4 ? 1 : 0) as 0 | 1 | 2 | 3;
  return { wantedCaught, wantedTotal, otherCaught, purity: frac, stars };
}
