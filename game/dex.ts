const KEY = 'matter-dex-v1';

/** 판을 넘어 누적되는 도감. known = 조사·분리로 알게 된 물질, stamps = 얻은 방법 도장. 저장 실패해도 게임은 계속 */
export interface Dex { known: string[]; stamps: Record<string, string> }

export function loadDex(): Dex {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Dex>;
    return { known: Array.isArray(v.known) ? v.known : [], stamps: v.stamps && typeof v.stamps === 'object' ? v.stamps : {} };
  } catch {
    return { known: [], stamps: {} };
  }
}

/** 새로 알게 된 물질 id 목록을 돌려준다 */
export function addKnown(ids: string[], stamp?: string): string[] {
  const d = loadDex();
  const fresh = ids.filter(id => !d.known.includes(id));
  d.known = [...d.known, ...fresh];
  if (stamp) ids.forEach(id => { d.stamps[id] = stamp; });
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* 저장 불가 — 무시 */ }
  return fresh;
}
