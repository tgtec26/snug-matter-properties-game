import type { Method, Mission, Substance } from '@/game/types';

/** 게임 규칙의 단일 출처. 씬·오버레이에서 직접 판정하지 않는다. (스펙 4-3) */
export interface SepResult { ok: boolean; reasonKey?: string; target: string[]; remaining: string[] }

const fail = (reasonKey: string, ids: string[]): SepResult => ({ ok: false, reasonKey, target: [], remaining: ids });

const solAt = (s: Substance, t: number) => {
  const pts = s.solubility ?? [];
  if (!pts.length) return 0;
  if (t <= pts[0].t) return pts[0].g;
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) { const a = pts[i - 1], b = pts[i]; return a.g + ((b.g - a.g) * (t - a.t)) / (b.t - a.t); }
  }
  return pts[pts.length - 1].g;
};
/** 용해도 곡선 값 (물 100 g 기준, 점 사이 직선 보간) */
export const solubilityAt = solAt;
/** 20 ℃→60 ℃ 용해도 증가량 = 온도에 따른 용해도 차 */
export const solubilityGain = (s: Substance) => solAt(s, 60) - solAt(s, 20);

export function canSeparate(ids: string[], method: Method, subs: Substance[]): SepResult {
  const list = ids.map(id => subs.find(s => s.id === id)).filter((s): s is Substance => !!s);
  const liquids = list.filter(s => s.state === 'liquid');
  const solids = list.filter(s => s.state === 'solid');
  const oils = liquids.filter(s => s.misciblesWithWater === false);
  const hasLayer = oils.length > 0 && liquids.length > oils.length;
  const rest = (t: Substance[]) => ids.filter(id => !t.some(x => x.id === id));
  const ok = (t: Substance[]): SepResult => ({ ok: true, target: t.map(x => x.id), remaining: rest(t) });

  if (method === 'density') {
    if (hasLayer) return ok(oils); // 분별 깔때기: 위층(밀도 작은 액체)
    const insoluble = solids.filter(s => s.dissolvesInWater === false && s.floatsInSaltwater !== undefined);
    if (insoluble.length >= 2) {
      const floaters = insoluble.filter(s => s.floatsInSaltwater);
      if (!liquids.length) return fail('solid-needs-medium', ids);
      if (floaters.length && floaters.length < insoluble.length) return ok(floaters);
      return fail('solid-needs-medium', ids);
    }
    if (solids.length >= 2 && !liquids.length) return fail('solid-needs-medium', ids);
    if (liquids.length >= 2) return fail('miscible', ids);
    if (solids.length && !liquids.length) return fail('no-layer-solid', ids);
    return fail('density-none', ids);
  }
  if (method === 'solubility') {
    const dissolving = solids.filter(s => s.dissolvesInWater && s.solubility);
    if (dissolving.length >= 2) {
      const sorted = [...dissolving].sort((a, b) => solubilityGain(b) - solubilityGain(a));
      if (solubilityGain(sorted[0]) < 3 * Math.max(1, solubilityGain(sorted[1]))) return fail('solubility-similar', ids);
      return ok([sorted[0]]);
    }
    if (!solids.length) return fail('solubility-liquid', ids);
    return fail('solubility-single', ids);
  }
  // boiling
  if (hasLayer) return fail('boiling-layer', ids);
  if (!liquids.length) return fail('boiling-solid', ids);
  const withBp = liquids.filter(s => s.boilingPoint !== null);
  if (withBp.length < 2) return fail('boiling-single', ids);
  const lowest = [...withBp].sort((a, b) => a.boilingPoint! - b.boilingPoint!)[0];
  return ok([lowest]);
}

export const REQUIRED_IDS = (ms: Mission[]) => ms.filter(m => m.kind === 'required').map(m => m.id);

/** 필수 의뢰 3개를 마치면 최종 의뢰가 열린다. */
export function isUnlocked(m: Mission, completed: string[], ms: Mission[]): boolean {
  if (m.kind !== 'final') return true;
  return REQUIRED_IDS(ms).every(id => completed.includes(id));
}

/** 한 판 완료 = 필수 의뢰 전부 + 최종 의뢰 */
export function runComplete(completed: string[], ms: Mission[]): boolean {
  return ms.filter(m => m.kind === 'required' || m.kind === 'final').every(m => completed.includes(m.id));
}

/** 도감(known)에 대상이 모두 있으면 조사 미니게임을 건너뛴다. */
export function needsInvestigation(m: Mission, known: string[]): boolean {
  return !!m.investigate && !m.investigate.targets.every(t => known.includes(t));
}

/** 단계 n에서 방법 선택 판정. 규칙상 가능해도 정해진 순서가 아니면 'not-now'. */
export function evaluateChoice(m: Mission, stepIndex: number, method: Method, subs: Substance[]): SepResult {
  const step = m.steps[stepIndex];
  const mixture = remainingBefore(m, stepIndex);
  const r = canSeparate(mixture, method, subs);
  if (!r.ok) return r;
  if (method !== step.method || r.target[0] !== step.obtains[0]) return { ...r, ok: false, reasonKey: 'not-now' };
  return r;
}

/** 단계 n 시작 시점의 혼합물 성분 */
export function remainingBefore(m: Mission, stepIndex: number): string[] {
  let cur = [...m.components];
  for (let i = 0; i < stepIndex; i++) cur = cur.filter(id => !m.steps[i].obtains.includes(id));
  return cur;
}

/** 의뢰 별 (0~3): 미니게임 별 평균 반올림 − 잘못 고른 적 있으면 1 + 퀴즈 첫 시도 정답 1, 0~3으로 제한 */
export function missionStars(gameStars: number[], wrongTries: number, quizOk: boolean): number {
  const avg = gameStars.length ? gameStars.reduce((a, b) => a + b, 0) / gameStars.length : 2;
  const v = Math.round(avg) - (wrongTries > 0 ? 1 : 0) + (quizOk ? 1 : 0);
  return Math.max(0, Math.min(3, v));
}
