/**
 * 배경음 1트랙(HTMLAudio) + 효과음(WebAudio). 아이폰 Safari는 HTMLAudio 음량을 못 바꾸므로 효과음은 AudioContext로 낸다.
 * 음량·음원 경로는 public/data/audio-config.json(어드민 '소리' 탭). 아래 DEFAULT_AUDIO는 json을 못 읽을 때의 대비값.
 * 브라우저는 첫 사용자 입력 전 재생을 막으므로 실패는 조용히 무시하고, 첫 입력 때 unlockAudio()로 다시 시도한다.
 */
import type { Phase } from '@/game/types';

export type BgmKey = 'start' | 'play' | 'quiz';
export type SfxKey = 'success' | 'correct' | 'error' | 'pick' | 'finale';

export interface AudioConfig {
  bgmVolume: number; sfxVolume: number; minGapMs: number;
  bgm: Record<BgmKey, string>;
  sfx: Record<SfxKey, string>;
}

export const DEFAULT_AUDIO: AudioConfig = {
  bgmVolume: 0.4, sfxVolume: 0.7, minGapMs: 90,
  bgm: { start: '/assets/audio/start_ending.mp3', play: '/assets/audio/mole_game.mp3', quiz: '/assets/audio/quiz-background.mp3' },
  sfx: {
    success: '/assets/audio/success.mp3', correct: '/assets/audio/correct.mp3', error: '/assets/audio/error.mp3',
    pick: '/assets/audio/book_pickup.mp3', finale: '/assets/audio/770801_fanfare.mp3',
  },
};

/** 화면 흐름에 맞춰 배경음 전환: 타이틀·의뢰판·요약 / 퀴즈 / 실험(조사·분리) */
export function bgmFor(phase: Phase): BgmKey {
  if (phase === 'investigate' || phase === 'separate') return 'play';
  if (phase === 'quiz') return 'quiz';
  return 'start';
}

const MUTE_KEY = 'snug-matter-properties:muted';
let cfg: AudioConfig = DEFAULT_AUDIO;
let current: { key: BgmKey; src: string; el: HTMLAudioElement } | null = null;
let muted: boolean | null = null;
let hidden = false;
let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const lastPlayed = new Map<SfxKey, number>();

export function isMuted() {
  if (muted === null) {
    try { muted = typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === '1'; } catch { muted = false; }
  }
  return muted;
}
export function setMuted(m: boolean) {
  muted = m;
  try { window.localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* 저장 불가 — 이번 탭에서만 유지 */ }
  if (current) current.el.muted = m;
}

export function setAudioConfig(next: Partial<AudioConfig> | null | undefined) {
  cfg = { ...DEFAULT_AUDIO, ...next, bgm: { ...DEFAULT_AUDIO.bgm, ...next?.bgm }, sfx: { ...DEFAULT_AUDIO.sfx, ...next?.sfx } };
  if (current) {
    current.el.volume = cfg.bgmVolume;
    if (cfg.bgm[current.key] !== current.src) { const k = current.key; stopBgm(); playBgm(k); }
  }
}

function safePlay(el: HTMLAudioElement) {
  el.play()?.catch(() => { /* autoplay 차단 — 무시 */ });
}

export function playBgm(key: BgmKey) {
  if (typeof window === 'undefined') return;
  const src = cfg.bgm[key];
  if (current?.key === key && current.src === src) { if (current.el.paused && !hidden) safePlay(current.el); return; }
  current?.el.pause();
  const el = new Audio(src);
  el.loop = true;
  el.volume = cfg.bgmVolume;
  el.muted = isMuted();
  current = { key, src, el };
  if (!hidden) safePlay(el);
}

export function stopBgm() {
  current?.el.pause();
  current = null;
}

/** 탭이 숨겨지면 배경음 멈춤, 돌아오면 이어서 재생 */
export function setHidden(h: boolean) {
  hidden = h;
  if (!current) return;
  if (h) current.el.pause(); else safePlay(current.el);
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

async function loadBuffer(c: AudioContext, src: string): Promise<AudioBuffer | null> {
  const hit = buffers.get(src);
  if (hit) return hit;
  try {
    const res = await fetch(src);
    const buf = await c.decodeAudioData(await res.arrayBuffer());
    buffers.set(src, buf);
    return buf;
  } catch { return null; }
}

/** 같은 효과음은 minGapMs 안에 다시 울리지 않는다(연타로 소리가 겹쳐 터지는 것 방지) */
export function sfxAllowed(key: SfxKey, now: number) {
  const last = lastPlayed.get(key);
  if (last !== undefined && now - last < cfg.minGapMs) return false;
  lastPlayed.set(key, now);
  return true;
}

export function playSfx(key: SfxKey) {
  if (typeof window === 'undefined' || isMuted() || !sfxAllowed(key, performance.now())) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  void loadBuffer(c, cfg.sfx[key]).then(buf => {
    if (!buf || isMuted()) return;
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = cfg.sfxVolume;
    src.buffer = buf;
    src.connect(gain).connect(c.destination);
    src.start();
  });
}

export function unlockAudio() {
  if (current?.el.paused && !hidden) safePlay(current.el);
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  for (const src of Object.values(cfg.sfx)) void loadBuffer(c, src);
}
