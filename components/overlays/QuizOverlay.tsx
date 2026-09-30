'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { playSfx } from '@/game/audio';
import { Backdrop } from '@/components/ui';

export function QuizOverlay() {
  const phase = useGameStore(s => s.phase);
  const id = useGameStore(s => s.missionId);
  if (phase !== 'quiz' || !id) return null;
  return <QuizFlow key={id} missionId={id} />;
}

/** 의뢰별 문제 중 무작위 1문항. 첫 시도 정답이면 별 +1. 오답은 교과서 근거를 보이고 재선택 */
function QuizFlow({ missionId }: { missionId: string }) {
  const finishQuiz = useGameStore(s => s.finishQuiz);
  const pool = useDataStore(d => d.quiz);
  const [q] = useState(() => {
    const list = pool.filter(x => x.mission === missionId);
    return list[Math.floor(Math.random() * list.length)];
  });
  const [wrong, setWrong] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState('');
  const lock = useRef(0);
  useEffect(() => { lock.current = Date.now() + 800; }, []);

  const choose = (i: number) => {
    if (!q || picked !== null || Date.now() < lock.current) return;
    if (i === q.answer) {
      setPicked(i); playSfx('correct'); setHint(q.why);
      setTimeout(() => finishQuiz(wrong === 0), 1500);
    } else {
      playSfx('error'); setWrong(w => w + 1); setHint(`다시 생각해 보자. (${q.page})`);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.repeat) return; const n = Number(e.key); if (n >= 1 && n <= 4) choose(n - 1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (!q) finishQuiz(false); }, [q, finishQuiz]);
  if (!q) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
      <Backdrop name="bench" tone="#222" />
      <div className="absolute inset-0 bg-black/65" />
      <div className={`relative w-[900px] rounded-3xl bg-slate-900/95 border px-9 py-7 ${picked !== null ? 'border-emerald-400' : 'border-white/20'}`}>
        <div className="text-amber-300 font-bold text-[20px] mb-3">확인 문제</div>
        <div className="text-white text-[30px] font-bold leading-relaxed mb-5">{q.q}</div>
        <div className="grid gap-3">
          {q.choices.map((c, i) => (
            <button key={i} onClick={() => choose(i)}
              className={`rounded-2xl border px-5 py-4 text-left text-[24px] flex gap-3 items-center ${picked === i ? 'border-emerald-400 bg-emerald-400/25 text-emerald-100' : 'border-white/25 bg-white/10 text-white hover:bg-white/20'}`}>
              <span className="font-black text-amber-300 w-6">{i + 1}</span><span>{c}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 min-h-[32px] text-[19px] text-amber-100">{hint}</div>
        <div className="text-[13px] text-white/40">숫자키 또는 탭 · 첫 시도에 맞히면 별 +1</div>
      </div>
    </div>
  );
}
