'use client';

import { useEffect, useState } from 'react';
import { isMuted, setMuted } from '@/game/audio';

/** 사용자 동작(클릭·Enter) 안에서 불러야 브라우저가 허용한다. 미지원·거부는 무시 */
export function enterFullscreen() {
  if (document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {});
}

/** 오른쪽 위 전체 화면·음소거 버튼. 누른 뒤 초점을 해제해 Enter·Space가 다시 누르지 않게 한다 */
export function TopControls() {
  const [full, setFull] = useState(false);
  const [mute, setMute] = useState(isMuted);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFull = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else enterFullscreen();
  };
  const toggleMute = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.blur(); setMuted(!mute); setMute(!mute); };
  const btn = 'h-[42px] px-3 rounded-xl bg-black/85 text-[16px] font-bold text-white hover:bg-black';

  return (
    <div className="absolute right-4 top-2 z-50 flex gap-2 pointer-events-auto">
      <button onClick={toggleFull} className={btn} aria-label={full ? '전체 화면 끝내기' : '전체 화면'}>{full ? '창 모드' : '전체 화면'}</button>
      <button onClick={toggleMute} className={btn} aria-label={mute ? '소리 켜기' : '음소거'}>{mute ? '소리 꺼짐' : '소리 켜짐'}</button>
    </div>
  );
}
