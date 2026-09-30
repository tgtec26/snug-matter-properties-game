import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const DATA_FILES = ['substances', 'missions', 'minigame-config', 'dialog-config', 'quiz-pool'] as const;
const isDataFile = (f: string) => (DATA_FILES as readonly string[]).includes(f);
const filePath = (f: string) => path.resolve(process.cwd(), 'public', 'data', `${f}.json`);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!isDataFile(file)) return NextResponse.json({ error: 'unknown file' }, { status: 400 });
  try { return NextResponse.json(JSON.parse(await fs.readFile(filePath(file), 'utf-8'))); }
  catch { return NextResponse.json({ error: 'not found' }, { status: 404 }); }
}

/** 개발 서버에서만 저장 (배포 403). 스키마 검증은 vitest(tests/rules.test.ts)가 데이터 파일 전체를 확인한다. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Admin API disabled in production' }, { status: 403 });
  const { file } = await ctx.params;
  if (!isDataFile(file)) return NextResponse.json({ error: 'unknown file' }, { status: 400 });
  const body = await req.json();
  await fs.writeFile(filePath(file), JSON.stringify(body, null, 2) + '\n', 'utf-8');
  return NextResponse.json({ ok: true, file: `${file}.json` });
}
