'use client';

import { useLayoutEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '@/game/config';

/**
 * 무대 1280×800을 뷰포트에 letterbox. 암석 순환 여행과 같은 구조.
 * 게임 본체(Phaser 캔버스 + React 오버레이)는 계획서 태스크에서 채운다.
 */
export default function Home() {
  const [size, setSize] = useState({ w: GAME_WIDTH, h: GAME_HEIGHT, scale: 1 });

  useLayoutEffect(() => {
    const update = () => {
      const s = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
      setSize({ w: GAME_WIDTH * s, h: GAME_HEIGHT * s, scale: s });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black flex items-center justify-center">
      <div className="relative bg-black overflow-hidden" style={{ width: size.w, height: size.h }}>
        <div
          className="absolute top-0 left-0 flex flex-col items-center justify-center text-center gap-4"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT, transform: `scale(${size.scale})`, transformOrigin: 'top left' }}
        >
          <h1 className="text-5xl font-bold">물질 분리 공방 (가제)</h1>
          <p className="text-xl text-neutral-300">프로젝트 뼈대 — 게임 본체는 아직 없음</p>
          <p className="text-sm text-neutral-500">무대 1280×800 · 스펙은 docs/superpowers/specs</p>
        </div>
      </div>
    </main>
  );
}
