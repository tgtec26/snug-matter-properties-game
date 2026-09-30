import { create } from 'zustand';
import type { Method, Phase } from '@/game/types';
import { useDataStore } from '@/game/dataStore';
import { evaluateChoice, isUnlocked, missionStars, needsInvestigation, runComplete } from '@/game/rules';
import { addKnown, loadDex } from '@/game/dex';

const RUN_KEY = 'matter-run-v1';

export interface MissionRecord { gameStars: number[]; wrong: number; quizOk: boolean | null; stars: number; methods: Method[] }

interface RunState {
  phase: Phase; missionId: string | null; stepIndex: number;
  completed: string[]; records: Record<string, MissionRecord>;
  startedAt: number | null; elapsedMs: number; newKnown: string[];
}
interface GameState extends RunState {
  /** 방금 얻은 물질 (result 화면) */
  obtained: string[];
  start: () => void; next: () => void; acceptMission: (id: string) => void;
  finishInvestigation: (stars: number) => void;
  chooseMethod: (m: Method) => { ok: boolean; reasonKey?: string };
  completeMinigame: (stars: number) => void; finishQuiz: (firstTryCorrect: boolean) => void;
  restartRun: () => void; reset: () => void; hydrate: () => void;
}

const fresh = (): RunState => ({ phase: 'title', missionId: null, stepIndex: 0, completed: [], records: {}, startedAt: null, elapsedMs: 0, newKnown: [] });
const mission = (id: string | null) => useDataStore.getState().missions.find(m => m.id === id);
const rec = (s: GameState, id: string): MissionRecord => s.records[id] ?? { gameStars: [], wrong: 0, quizOk: null, stars: 0, methods: [] };

export const useGameStore = create<GameState>()((set, get) => ({
  ...fresh(), obtained: [],

  start: () => { if (get().phase !== 'title') return; set({ ...fresh(), phase: 'intro', startedAt: Date.now() }); },

  next: () => {
    const s = get();
    if (s.phase === 'intro') {
      // 첫 판(철을 모름)이면 튜토리얼 의뢰로 바로 진입
      if (!loadDex().known.includes('iron')) get().acceptMission('m0'); else set({ phase: 'board' });
    } else if (s.phase === 'accept') {
      const m = mission(s.missionId); if (!m) return;
      if (needsInvestigation(m, loadDex().known)) set({ phase: 'investigate' });
      else set({ phase: m.steps.length ? 'choose' : 'quiz', stepIndex: 0 });
    } else if (s.phase === 'result') {
      const m = mission(s.missionId); if (!m) return;
      const i = s.stepIndex + 1;
      set(i < m.steps.length ? { phase: 'choose', stepIndex: i } : { phase: 'quiz', stepIndex: i });
    }
  },

  acceptMission: (id) => {
    const s = get(); const { missions } = useDataStore.getState();
    const m = missions.find(x => x.id === id);
    if (!m || (s.phase !== 'board' && s.phase !== 'intro') || s.completed.includes(id) || !isUnlocked(m, s.completed, missions)) return;
    set({ phase: 'accept', missionId: id, stepIndex: 0 });
  },

  finishInvestigation: (stars) => {
    const s = get(); const m = mission(s.missionId);
    if (s.phase !== 'investigate' || !m?.investigate) return;
    const fresh = addKnown(m.investigate.targets, 'measure');
    const r = rec(s, m.id);
    set({
      records: { ...s.records, [m.id]: { ...r, gameStars: [...r.gameStars, stars] } },
      newKnown: [...s.newKnown, ...fresh.filter(x => !s.newKnown.includes(x))],
      phase: m.steps.length ? 'choose' : 'quiz', stepIndex: 0,
    });
  },

  chooseMethod: (method) => {
    const s = get(); const m = mission(s.missionId); const { substances } = useDataStore.getState();
    if (s.phase !== 'choose' || !m) return { ok: false };
    const r = evaluateChoice(m, s.stepIndex, method, substances);
    if (r.ok) { set({ phase: 'separate' }); return { ok: true }; }
    const cur = rec(s, m.id);
    set({ records: { ...s.records, [m.id]: { ...cur, wrong: cur.wrong + 1 } } });
    return { ok: false, reasonKey: r.reasonKey };
  },

  completeMinigame: (stars) => {
    const s = get(); const m = mission(s.missionId);
    if (s.phase !== 'separate' || !m) return;
    const step = m.steps[s.stepIndex];
    const fresh = addKnown(step.obtains, step.method);
    const r = rec(s, m.id);
    set({
      phase: 'result', obtained: step.obtains,
      records: { ...s.records, [m.id]: { ...r, gameStars: [...r.gameStars, stars], methods: [...r.methods, step.method] } },
      newKnown: [...s.newKnown, ...fresh.filter(x => !s.newKnown.includes(x))],
    });
  },

  finishQuiz: (firstTryCorrect) => {
    const s = get(); const { missions } = useDataStore.getState(); const m = mission(s.missionId);
    if (s.phase !== 'quiz' || !m) return;
    const r = rec(s, m.id);
    const record = { ...r, quizOk: firstTryCorrect, stars: missionStars(r.gameStars, r.wrong, firstTryCorrect) };
    // 튜토리얼은 한 판 완료 조건이 아니므로 completed에도 넣어 의뢰판에서 다시 열리지 않게 한다
    const completed = [...s.completed, m.id];
    const done = runComplete(completed, missions);
    set({
      records: { ...s.records, [m.id]: record }, completed,
      phase: done ? 'summary' : 'board', missionId: null, stepIndex: 0,
      elapsedMs: done && s.startedAt ? Date.now() - s.startedAt : s.elapsedMs,
    });
  },

  restartRun: () => set({ ...fresh(), phase: 'board', startedAt: Date.now(), obtained: [] }),
  reset: () => set({ ...fresh(), obtained: [] }),

  hydrate: () => {
    try {
      const v = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as Partial<RunState> | null;
      if (!v || !v.phase || v.phase === 'title' || v.phase === 'summary') return;
      // 미니게임·결과 도중이면 갈림길로 돌아가 안전하게 다시 시작
      const phase = v.phase === 'separate' || v.phase === 'result' ? 'choose' : v.phase;
      set({ ...fresh(), ...v, phase });
    } catch { /* 저장 없음 */ }
  },
}));

if (typeof window !== 'undefined') {
  useGameStore.subscribe((s) => {
    const { phase, missionId, stepIndex, completed, records, startedAt, elapsedMs, newKnown } = s;
    try { localStorage.setItem(RUN_KEY, JSON.stringify({ phase, missionId, stepIndex, completed, records, startedAt, elapsedMs, newKnown })); } catch { /* 저장 불가 */ }
  });
  if (process.env.NODE_ENV !== 'production') Object.assign(window, { __store: useGameStore });
}
