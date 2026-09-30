/**
 * 배경음 1트랙 + 효과음. 음원은 snug-thermoregulation-game에서 재활용 (public/assets/audio).
 * 브라우저는 첫 사용자 입력 전 재생을 막으므로 실패는 조용히 무시하고, 첫 입력 때 unlockAudio()로 다시 시도한다.
 */
export type BgmKey = 'start_ending' | 'quiz-background' | 'mole_game';
export type SfxKey = 'success' | 'correct' | 'error';

const BGM_VOLUME = 0.4;
const SFX_VOLUME = 0.7;
let current: { key: BgmKey; el: HTMLAudioElement } | null = null;
let muted = false;

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  if (current) current.el.muted = m;
}

function safePlay(el: HTMLAudioElement) {
  el.play()?.catch(() => { /* autoplay 차단 — 무시 */ });
}

export function playBgm(key: BgmKey) {
  if (typeof window === 'undefined') return;
  if (current?.key === key) { if (current.el.paused) safePlay(current.el); return; }
  current?.el.pause();
  const el = new Audio(`/assets/audio/${key}.mp3`);
  el.loop = true;
  el.volume = BGM_VOLUME;
  el.muted = muted;
  current = { key, el };
  safePlay(el);
}

export function stopBgm() {
  current?.el.pause();
  current = null;
}

export function playSfx(key: SfxKey) {
  if (typeof window === 'undefined' || muted) return;
  const el = new Audio(`/assets/audio/${key}.mp3`);
  el.volume = SFX_VOLUME;
  safePlay(el);
}

export function unlockAudio() {
  if (current?.el.paused) safePlay(current.el);
}
