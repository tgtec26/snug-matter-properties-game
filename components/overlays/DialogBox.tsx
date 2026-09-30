'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props { npcName: string; color: string; portrait?: string; lines: string[]; onDone: () => void }

const CHAR_MS = 18;
const INPUT_LOCK_MS = 700;

export function DialogBox({ npcName, color, portrait, lines, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [hasPortrait, setHasPortrait] = useState(!!portrait);
  const [shown, setShown] = useState(0);
  const mountedAt = useRef(0);
  const line = lines[idx] ?? '';
  const complete = shown >= line.length;

  useEffect(() => { mountedAt.current = Date.now(); }, []);

  useEffect(() => {
    if (complete) return;
    const t = setInterval(() => setShown(s => Math.min(line.length, s + 1)), CHAR_MS);
    return () => clearInterval(t);
  }, [complete, line, idx]);

  const advance = useCallback(() => {
    if (Date.now() - mountedAt.current < INPUT_LOCK_MS) return;
    if (!complete) { setShown(line.length); return; }
    if (idx + 1 < lines.length) { setIdx(idx + 1); setShown(0); }
    else onDone();
  }, [complete, line.length, idx, lines.length, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-auto cursor-pointer select-none" onClick={advance}>
      <div className="mx-6 mb-5 rounded-2xl border border-white/20 bg-black/80 px-7 py-5 flex gap-6 min-h-[190px]">
        <div className="shrink-0 flex flex-col items-center gap-2 w-[120px]">
          <div className="w-[96px] h-[96px] rounded-full border-4 border-white/70 overflow-hidden" style={{ background: color }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {hasPortrait && portrait && <img src={portrait} alt="" className="w-full h-full object-cover object-top scale-125 origin-top" onError={() => setHasPortrait(false)} />}
          </div>
          <div className="text-[16px] text-amber-200 font-bold text-center">{npcName}</div>
        </div>
        <div className="flex-1 text-[24px] leading-relaxed text-white whitespace-pre-wrap" style={{ wordBreak: 'keep-all' }}>
          {line.slice(0, shown)}
          {complete && <span className="ml-2 text-amber-300 animate-pulse">▼</span>}
        </div>
        <div className="self-end text-[13px] text-white/50">{idx + 1}/{lines.length} · Enter 또는 탭</div>
      </div>
    </div>
  );
}
