'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { playBgm, stopBgm, unlockAudio, setHidden, setAudioConfig, bgmFor } from '@/game/audio';

export function AudioRunner() {
  const phase = useGameStore(s => s.phase);
  const audio = useDataStore(s => s.audio);
  useEffect(() => { setAudioConfig(audio); }, [audio]);
  useEffect(() => { playBgm(bgmFor(phase)); }, [phase]);
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('visibilitychange', onVis); stopBgm();
    };
  }, []);
  return null;
}
