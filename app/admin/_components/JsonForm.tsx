'use client';

import { useState } from 'react';

type J = string | number | boolean | null | J[] | { [k: string]: J };

const LABEL: Record<string, string> = {
  id: '아이디', name: '이름', state: '상태', color: '색', density: '밀도 (g/cm³)', densityNote: '밀도 설명', meltingPoint: '녹는점 (℃)', boilingPoint: '끓는점 (℃)',
  solubility: '용해도 곡선', t: '온도 (℃)', g: '물 100 g당 녹는 양 (g)', misciblesWithWater: '물과 섞임', dissolvesInWater: '물에 녹음', floatsInSaltwater: '소금물에서 뜸',
  card: '도감 카드', example: '생활 예', page: '교과서 쪽', reference: '자료실 전용', title: '의뢰 이름', place: '장소', npc: '의뢰인', kind: '종류', components: '혼합물 성분',
  investigate: '조사 미니게임', targets: '조사 대상', steps: '분리 단계', method: '방법', obtains: '얻는 물질', leaves: '남는 물질', intro: '수락 대사', outro: '완료 대사', pos: '지도 위치', x: 'x', y: 'y',
  mission: '의뢰', q: '문제', choices: '보기', answer: '정답 번호(0부터)', why: '해설', reasons: '불가 안내 문구', hints: '갈림길 힌트', npcs: '의뢰인 정보',
};
const label = (k: string) => LABEL[k] ?? k;
const summary = (v: J, i: number): string => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, J>;
    const s = o.name ?? o.title ?? o.q ?? o.id ?? o.method;
    if (typeof s === 'string') return `${i + 1}. ${s}`;
  }
  return `${i + 1}`;
};
const blank = (v: J): J => {
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)]));
  if (typeof v === 'number') return 0;
  if (typeof v === 'boolean') return false;
  return typeof v === 'string' ? '' : null;
};

const inputCls = 'rounded bg-[#2a2a2a] px-2 py-1 text-[14px] text-white outline-none focus:ring-2 focus:ring-amber-500';

function Node({ k, v, onChange, depth }: { k: string; v: J; onChange: (n: J) => void; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  if (Array.isArray(v)) {
    const prim = v.every(x => typeof x !== 'object' || x === null);
    if (prim) return (
      <Row k={k}>
        <div className="flex flex-col gap-1 w-full">
          {v.map((x, i) => (
            <div key={i} className="flex gap-1">
              <input className={`${inputCls} flex-1`} value={x === null ? '' : String(x)} onChange={e => onChange(v.map((y, j) => (j === i ? (typeof x === 'number' ? Number(e.target.value) : e.target.value) : y)))} />
              <button className="rounded bg-[#444] px-2 text-[13px]" onClick={() => onChange(v.filter((_, j) => j !== i))}>삭제</button>
            </div>
          ))}
          <button className="self-start rounded bg-[#444] px-3 py-0.5 text-[13px]" onClick={() => onChange([...v, typeof v[0] === 'number' ? 0 : ''])}>+ 추가</button>
        </div>
      </Row>
    );
    return (
      <div className="border-l-2 border-[#555] pl-3 my-1">
        <button className="text-[15px] font-bold text-amber-300" onClick={() => setOpen(!open)}>{open ? '▼' : '▶'} {label(k)} ({v.length})</button>
        {open && (
          <div className="flex flex-col gap-2 mt-1">
            {v.map((x, i) => (
              <div key={i} className="rounded bg-[#242424] p-2">
                <div className="flex justify-between text-[14px] text-amber-200 mb-1"><span>{summary(x, i)}</span>
                  <button className="rounded bg-[#5a2a2a] px-2 text-[13px]" onClick={() => onChange(v.filter((_, j) => j !== i))}>이 항목 삭제</button></div>
                <Node k="" v={x} depth={depth + 1} onChange={n => onChange(v.map((y, j) => (j === i ? n : y)))} />
              </div>
            ))}
            <button className="self-start rounded bg-[#444] px-3 py-1 text-[13px]" onClick={() => onChange([...v, v.length ? blank(v[v.length - 1]) : {}])}>+ 항목 추가</button>
          </div>
        )}
      </div>
    );
  }
  if (v && typeof v === 'object') {
    const inner = (
      <div className="flex flex-col gap-1">
        {Object.entries(v).map(([ck, cv]) => <Node key={ck} k={ck} v={cv} depth={depth + 1} onChange={n => onChange({ ...v, [ck]: n })} />)}
      </div>
    );
    return k ? (
      <div className="border-l-2 border-[#555] pl-3 my-1">
        <button className="text-[15px] font-bold text-amber-300" onClick={() => setOpen(!open)}>{open ? '▼' : '▶'} {label(k)}</button>
        {open && inner}
      </div>
    ) : inner;
  }
  if (typeof v === 'boolean') return <Row k={k}><input type="checkbox" className="h-5 w-5" checked={v} onChange={e => onChange(e.target.checked)} /></Row>;
  if (typeof v === 'string' && (v.length > 36 || v.includes('\n'))) return <Row k={k}><textarea className={`${inputCls} w-full`} rows={2} value={v} onChange={e => onChange(e.target.value)} /></Row>;
  return (
    <Row k={k}>
      <input className={`${inputCls} ${typeof v === 'number' || v === null ? 'w-32' : 'w-full'}`} value={v === null ? '' : String(v)} placeholder={v === null ? '(없음)' : ''}
        onChange={e => { const t = e.target.value; onChange(typeof v === 'number' || v === null ? (t === '' ? null : Number.isNaN(Number(t)) ? t : Number(t)) : t); }} />
    </Row>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex items-start gap-3"><div className="w-[190px] shrink-0 pt-1 text-[14px] text-[#bbb]">{k ? label(k) : ''}</div><div className="flex-1">{children}</div></div>;
}

/** 어떤 JSON이든 입력칸으로 편집하는 폼 */
export default function JsonForm({ value, onChange }: { value: J; onChange: (v: J) => void }) {
  return <div className="text-white"><Node k="" v={value} depth={0} onChange={onChange} /></div>;
}
