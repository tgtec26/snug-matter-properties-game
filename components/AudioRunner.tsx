'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/game/store';
import { playBgm, stopBgm, unlockAudio, type BgmKey } from '@/game/audio';
import type { Phase } from '@/game/types';

/** 화면 흐름에 맞춰 배경음 전환: 타이틀·의뢰판·요약 / 퀴즈 / 실험(조사·분리) */
function pickBgm(phase: Phase): BgmKey {
  if (phase === 'investigate' || phase === 'separate') return 'mole_game';
  if (phase === 'quiz') return 'quiz-background';
  return 'start_ending';
}

export function AudioRunner() {
  const phase = useGameStore(s => s.phase);
  useEffect(() => { playBgm(pickBgm(phase)); }, [phase]);
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => { window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); stopBgm(); };
  }, []);
  return null;
}
