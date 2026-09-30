import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { useDataStore } from '@/game/dataStore';
import { useGameStore } from '@/game/store';
import type { DialogConfig, Mission, QuizQuestion, Substance } from '@/game/types';

const load = <T,>(f: string) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8')) as T;
const g = () => useGameStore.getState();

beforeEach(() => {
  localStorage.clear();
  useDataStore.setState({
    substances: load<Substance[]>('substances'), missions: load<Mission[]>('missions'), dialog: load<DialogConfig>('dialog-config'),
    quiz: load<QuizQuestion[]>('quiz-pool'), minigame: {}, loaded: true, error: null,
  });
  g().reset();
});

describe('store 전이', () => {
  it('첫 판: 시작 → 인트로 → 튜토리얼 의뢰(수락)', () => {
    g().start(); expect(g().phase).toBe('intro');
    g().next(); expect(g().phase).toBe('accept'); expect(g().missionId).toBe('m0');
    g().next(); expect(g().phase).toBe('investigate');
    g().finishInvestigation(3); expect(g().phase).toBe('quiz');
    g().finishQuiz(true); expect(g().phase).toBe('board');
    expect(g().completed).toEqual(['m0']);
  });
  it('의뢰 1: 잘못된 방법은 감점·재선택, 옳은 방법은 분리 → 결과 → 퀴즈', () => {
    g().start(); g().next(); g().next(); g().finishInvestigation(3); g().finishQuiz(true);
    g().acceptMission('m1'); g().next(); g().finishInvestigation(2);
    expect(g().phase).toBe('choose');
    expect(g().chooseMethod('boiling')).toMatchObject({ ok: false, reasonKey: 'boiling-layer' });
    expect(g().phase).toBe('choose'); expect(g().records.m1.wrong).toBe(1);
    expect(g().chooseMethod('density').ok).toBe(true); expect(g().phase).toBe('separate');
    g().completeMinigame(3); expect(g().phase).toBe('result'); expect(g().obtained).toEqual(['cooking-oil']);
    g().next(); expect(g().phase).toBe('quiz');
  });
  it('최종 의뢰는 필수 3개 전에는 수락되지 않고, 완료하면 요약', () => {
    g().start(); g().next(); g().next(); g().finishInvestigation(3); g().finishQuiz(true);
    g().acceptMission('m4'); expect(g().phase).toBe('board');
    const run = (id: string, steps: number, inv: boolean) => {
      g().acceptMission(id); g().next(); if (inv) g().finishInvestigation(3);
      const m = useDataStore.getState().missions.find(x => x.id === id)!;
      for (let i = 0; i < steps; i++) { expect(g().chooseMethod(m.steps[i].method).ok).toBe(true); g().completeMinigame(3); g().next(); }
      g().finishQuiz(true);
    };
    run('m1', 1, true); run('m2', 1, true); run('m3', 1, true);
    run('m4', 2, true);
    expect(g().phase).toBe('summary');
  });
  it('저장·복원', () => {
    g().start(); g().next();
    const snap = localStorage.getItem('matter-run-v1');
    expect(snap).toBeTruthy();
    g().reset(); localStorage.setItem('matter-run-v1', snap!); g().hydrate();
    expect(g().phase).toBe('accept'); expect(g().missionId).toBe('m0');
  });
});
