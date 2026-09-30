'use client';

import { useEffect, useState } from 'react';
import JsonForm from './_components/JsonForm';
import BoardEditor from './_components/BoardEditor';

const TABS = [
  ['substances', '물질'], ['missions', '의뢰'], ['board', '의뢰판 배치'], ['minigame-config', '미니게임 수치'], ['dialog-config', '대화'], ['quiz-pool', '퀴즈'],
] as const;
type Tab = (typeof TABS)[number][0];
const fileOf = (t: Tab) => (t === 'board' ? 'missions' : t);

/** 데이터 편집기: 입력 칸(기본) / JSON 직접 편집 / 의뢰판 카드 끌어 배치. 저장은 개발 서버에서만(배포 403), 저장 후 게임 새로고침 */
export default function Admin() {
  const [tab, setTab] = useState<Tab>('substances');
  const [data, setData] = useState<unknown>(null);
  const [raw, setRaw] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/${fileOf(tab)}`).then(r => r.json()).then(v => { if (alive) { setData(v); setText(JSON.stringify(v, null, 2)); } });
    return () => { alive = false; };
  }, [tab]);

  const switchTab = (t: Tab) => { setData(null); setRaw(false); setTab(t); };
  let err = '';
  let out = data;
  if (raw) { try { out = JSON.parse(text); } catch (e) { err = String(e); } }
  const save = async () => {
    const r = await fetch(`/api/admin/${fileOf(tab)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
    setStatus(r.ok ? '저장됨 — 게임 화면을 새로고침하면 반영됩니다' : `저장 실패 (${r.status}${r.status === 403 ? ', 배포 서버에서는 저장할 수 없어요' : ''})`);
    setTimeout(() => setStatus(''), 6000);
  };
  const toggleRaw = () => { if (!raw) setText(JSON.stringify(data, null, 2)); else if (!err) setData(out); setRaw(!raw); };

  return (
    <div className="min-h-screen bg-[#111] p-4 text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map(([f, n]) => <button key={f} onClick={() => switchTab(f)} className={`rounded-md px-4 py-1.5 text-[16px] ${f === tab ? 'bg-amber-500 text-black font-bold' : 'bg-[#333]'}`}>{n}</button>)}
        {tab !== 'board' && <button onClick={toggleRaw} className="ml-auto rounded-md bg-[#333] px-3 py-1.5 text-[14px]">{raw ? '입력 칸으로 보기' : 'JSON 직접 편집'}</button>}
      </div>
      <div className="rounded-lg bg-[#1a1a1a] p-3 pb-16">
        {data === null ? <div className="text-[#888]">불러오는 중…</div>
          : tab === 'board' ? <BoardEditor missions={data as never} onChange={m => setData(m)} />
          : raw ? <textarea value={text} onChange={e => setText(e.target.value)} spellCheck={false} className="h-[75vh] w-full rounded bg-[#1c1c1c] p-2 font-mono text-[13px] text-[#eee]" />
          : <JsonForm value={data as never} onChange={v => setData(v)} />}
        {err && <div className="mt-2 text-[13px] text-red-400">{err}</div>}
      </div>
      <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 bg-black/90 px-4 py-2">
        <button onClick={save} disabled={!!err || data === null} className="rounded-md bg-amber-500 px-8 py-2 text-[17px] font-bold text-black disabled:opacity-40">저장</button>
        <span className="text-[14px]">{status}</span>
      </div>
    </div>
  );
}
