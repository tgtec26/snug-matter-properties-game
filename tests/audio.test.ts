import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { DEFAULT_AUDIO, bgmFor, isMuted, setMuted, sfxAllowed, setAudioConfig, type AudioConfig } from '@/game/audio';
import type { Phase } from '@/game/types';

const cfg = JSON.parse(readFileSync('public/data/audio-config.json', 'utf8')) as AudioConfig;

describe('장면별 BGM', () => {
  const cases: [Phase, string][] = [
    ['title', 'start'], ['intro', 'start'], ['board', 'start'], ['accept', 'start'], ['choose', 'start'], ['result', 'start'], ['summary', 'start'],
    ['investigate', 'play'], ['separate', 'play'], ['quiz', 'quiz'],
  ];
  it.each(cases)('%s -> %s', (phase, key) => expect(bgmFor(phase)).toBe(key));
});

describe('음소거 저장', () => {
  beforeEach(() => { window.localStorage.clear(); });
  it('setMuted는 localStorage에 남는다', () => {
    setMuted(true);
    expect(window.localStorage.getItem('snug-matter-properties:muted')).toBe('1');
    setMuted(false);
    expect(window.localStorage.getItem('snug-matter-properties:muted')).toBe('0');
  });
  it('저장소가 막혀도 던지지 않는다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => setMuted(true)).not.toThrow();
    expect(isMuted()).toBe(true);
    spy.mockRestore();
  });
});

describe('효과음 연타 간격', () => {
  it('minGapMs 안의 같은 소리는 막고, 다른 소리나 간격 뒤는 허용', () => {
    setAudioConfig({ minGapMs: 90 });
    expect(sfxAllowed('pick', 1000)).toBe(true);
    expect(sfxAllowed('pick', 1050)).toBe(false);
    expect(sfxAllowed('correct', 1050)).toBe(true);
    expect(sfxAllowed('pick', 1100)).toBe(true);
  });
});

describe('audio-config.json', () => {
  it('기본값과 같은 키 구성이고 모든 음원 파일이 있다', () => {
    expect(Object.keys(cfg.bgm).sort()).toEqual(Object.keys(DEFAULT_AUDIO.bgm).sort());
    expect(Object.keys(cfg.sfx).sort()).toEqual(Object.keys(DEFAULT_AUDIO.sfx).sort());
    for (const p of [...Object.values(cfg.bgm), ...Object.values(cfg.sfx)]) expect(existsSync(`public${p}`), p).toBe(true);
  });
  it('음량은 0~1', () => {
    for (const v of [cfg.bgmVolume, cfg.sfxVolume]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
});
