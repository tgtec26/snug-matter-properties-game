import type { Substance } from '@/game/types';
import { solubilityAt } from '@/game/rules';

export interface RecrystalCfg {
  waterG: number; heatRate: number; coolRate: number; maxTemp: number; iceTemp: number;
  /** 가만히 둘 때 / 젓기 세기 1일 때 녹는 속도 (g/초) */
  dissolveRate: number; stirRate: number;
  /** 씻지 않은 결정에 묻어 있는 다른 물질 용액의 양(g) */
  filmG: number;
}
export const defaultCfg = (c: Record<string, number> = {}): RecrystalCfg => ({
  waterG: c.waterG ?? 10, heatRate: c.heatRate ?? 10, coolRate: c.coolRate ?? 15,
  maxTemp: c.maxTemp ?? 80, iceTemp: c.iceTemp ?? 5,
  dissolveRate: c.dissolveRate ?? 0.6, stirRate: c.stirRate ?? 3, filmG: c.filmG ?? 0.4,
});

/** 물 waterG 에 그 온도에서 최대로 녹는 양 (곡선은 물 100 g 기준) */
export const capAt = (s: Substance, t: number, waterG: number) => (solubilityAt(s, t) * waterG) / 100;

export interface Sim {
  temp: number;
  /** 성분별 (mixture 순서) 넣은 양 / 녹은 양 / 용액에서 석출한 양 */
  totals: number[]; dissolved: number[]; crystal: number[];
}
export const initSim = (totals: number[], temp = 20): Sim => ({
  temp, totals, dissolved: totals.map(() => 0), crystal: totals.map(() => 0),
});

export interface Input { heating: boolean; cooling: boolean; /** 젓기 세기 0~1 */ stir: number }

export function step(sim: Sim, dt: number, inp: Input, subs: Substance[], cfg: RecrystalCfg): Sim {
  let temp = sim.temp;
  if (inp.heating && !inp.cooling) temp = Math.min(cfg.maxTemp, temp + cfg.heatRate * dt);
  if (inp.cooling) temp = Math.max(cfg.iceTemp, temp - cfg.coolRate * dt);
  const dissolved = [...sim.dissolved], crystal = [...sim.crystal];
  subs.forEach((s, i) => {
    const cap = capAt(s, temp, cfg.waterG);
    const solid = sim.totals[i] - dissolved[i];
    if (dissolved[i] > cap) { // 곡선을 넘은 만큼 석출
      crystal[i] += dissolved[i] - cap;
      dissolved[i] = cap;
    } else if (solid > 1e-9 && !inp.cooling) { // 식는 동안엔 더 녹지 않는다
      dissolved[i] += Math.min(cap - dissolved[i], solid, (cfg.dissolveRate + cfg.stirRate * inp.stir) * dt);
    }
  });
  return { ...sim, temp, dissolved, crystal };
}

/** 그래프 점: 용액 100 g(물)당 녹지 않은 채 남은 양 = (넣은 양 − 석출량) × 100/물 g */
export const pointG = (sim: Sim, i: number, cfg: RecrystalCfg) => ((sim.totals[i] - sim.crystal[i]) * 100) / cfg.waterG;
export const solidLeft = (sim: Sim, i: number) => Math.max(0, sim.totals[i] - sim.dissolved[i]);
export const allDissolved = (sim: Sim) => sim.totals.every((_, i) => solidLeft(sim, i) < 0.005);
/** 냉각으로 석출한 양이 생겼는가 */
export const cooledEnough = (sim: Sim, cfg: RecrystalCfg) => sim.temp <= cfg.iceTemp + 0.01;

export interface FilterResult { crystalG: number; otherOnPaperG: number; purity: number; filtrateOtherG: number }

/** 거름: 거름종이에는 모든 고체가 남는다. 다른 물질은 안 녹은 채 남은 것 + 씻지 않은 묻은 용액. */
export function filterResult(sim: Sim, targetIdx: number, wash: number, cfg: RecrystalCfg): FilterResult {
  const crystalG = solidLeft(sim, targetIdx);
  let other = 0, dissolvedOther = 0;
  sim.totals.forEach((_, i) => { if (i !== targetIdx) { other += solidLeft(sim, i); dissolvedOther += sim.dissolved[i]; } });
  const film = Math.min(cfg.filmG, dissolvedOther) * (1 - Math.min(1, wash));
  const onPaper = other + film;
  return {
    crystalG, otherOnPaperG: onPaper, filtrateOtherG: dissolvedOther - film,
    purity: crystalG + onPaper > 0 ? crystalG / (crystalG + onPaper) : 0,
  };
}

export function recrystalStars(r: FilterResult): 0 | 1 | 2 | 3 {
  if (r.crystalG <= 0.05) return 0;
  if (r.purity >= 0.98) return 3;
  if (r.purity >= 0.9) return 2;
  return 1;
}
