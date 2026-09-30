'use client';

import { useEffect, useState } from 'react';

const TABS = [
  ['substances', '물질'], ['missions', '의뢰'], ['minigame-config', '미니게임'], ['dialog-config', '대화'], ['quiz-pool', '퀴즈'],
] as const;

/** 데이터 JSON 편집기: 형식 오류면 저장이 꺼진다. 저장 후 게임 페이지를 새로고침하면 반영된다. 배포 서버는 저장 403 */
export default function Admin() {
  const [file, setFile] = useState<(typeof TABS)[number][0]>('substances');
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    fetch(`/api/admin/${file}`).then(r => r.json()).then(v => setText(JSON.stringify(v, null, 2)));
  }, [file]);
  let parsed: unknown = null; let err = '';
  if (text !== null) { try { parsed = JSON.parse(text); } catch (e) { err = String(e); } }
  const save = async () => {
    const r = await fetch(`/api/admin/${file}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
    setStatus(r.ok ? '저장됨' : `저장 실패 (${r.status})`); setTimeout(() => setStatus(''), 4000);
  };
  return (
    <div style={{ padding: 16, background: '#111', color: '#eee', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map(([f, n]) => <button key={f} onClick={() => { setText(null); setFile(f); }} style={{ padding: '6px 14px', background: f === file ? '#f59e0b' : '#333', color: f === file ? '#000' : '#eee', borderRadius: 6 }}>{n}</button>)}
      </div>
      <textarea value={text ?? '불러오는 중…'} onChange={e => setText(e.target.value)} spellCheck={false}
        style={{ flex: 1, minHeight: '75vh', background: '#1c1c1c', color: '#eee', fontFamily: 'monospace', fontSize: 13, padding: 8 }} />
      {err && <div style={{ color: '#f87171', fontSize: 12 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={save} disabled={!!err || text === null} style={{ padding: '6px 20px', background: '#f59e0b', color: '#000', borderRadius: 6, opacity: err ? 0.4 : 1 }}>저장</button>
        <span style={{ fontSize: 12 }}>{status}</span>
      </div>
    </div>
  );
}
