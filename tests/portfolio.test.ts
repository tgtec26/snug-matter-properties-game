import { describe, expect, it, vi } from 'vitest';
import {
  findSelectedClass,
  isFreshPortfolioPreview,
  makeIdempotencyKey,
  parseStudentNumbers,
  submitPortfolioGroup,
  validatePngBlob,
  validateStudentNumbers,
} from '../game/portfolio';

const png = () => new Blob(['png-bytes'], { type: 'image/png' });

describe('matter portfolio helpers', () => {
  it('parses group numbers and rejects non-numeric entries', () => {
    expect(parseStudentNumbers('03, 4 4 a 0')).toEqual({ numbers: ['3', '4'], rejected: ['a', '0'] });
    expect(validateStudentNumbers('')).toContain('학생 번호');
    expect(validateStudentNumbers('1 2 3 4 5 6 7 8 9')).toContain('8명');
    expect(validateStudentNumbers('3, 4')).toBeNull();
    expect(validatePngBlob(png())).toBeNull();
  });

  it('keeps same-subject teachers distinct by id', () => {
    const destinations = { teachers: [
      { teacherId: 'science-a', subject: '과학', teacherName: 'A', classes: [{ classId: 'a-1', grade: 2, classNo: 1 }] },
      { teacherId: 'science-b', subject: '과학', teacherName: 'B', classes: [{ classId: 'b-1', grade: 2, classNo: 1 }] },
    ] };
    expect(findSelectedClass(destinations, { teacherId: 'science-b', classId: 'b-1' })?.teacher.teacherName).toBe('B');
  });

  it('uses stable idempotency keys for duplicate clicks', () => {
    expect(makeIdempotencyKey({
      gameId: 'matter-properties',
      teacherId: 'science-b',
      classId: 'b-1',
      studentNumber: '4',
      now: new Date('2026-10-03T13:00:00Z'),
    })).toBe('matter-properties:science-b:b-1:4:2026-10-03');
  });

  it('discards delayed PNG completion after destination revision changes', async () => {
    let currentRevision = 1;
    const startedRevision = currentRevision;
    let accepted: Blob | null = null;
    const delayedPng = Promise.resolve(new Blob(['old'], { type: 'image/png' }));
    currentRevision += 1;
    const blob = await delayedPng;
    if (isFreshPortfolioPreview(startedRevision, currentRevision)) accepted = blob;
    expect(accepted).toBeNull();
  });
});

describe('matter submitPortfolioGroup', () => {
  it('binds session, upload file, destination, type, and size before success', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/upload-session')) {
        const body = JSON.parse(String(init?.body));
        return Response.json({ uploadToken: `token-${body.studentNumber}`, files: [{ fileId: `file-${body.studentNumber}`, uploadUrl: `https://upload.test/${body.studentNumber}` }] });
      }
      if (url.startsWith('https://upload.test/')) return new Response(null, { status: 200 });
      if (url.endsWith('/upload-finalize')) return Response.json({ postId: 'post-ok' });
      return new Response(null, { status: 404 });
    });
    const results = await submitPortfolioGroup({
      baseUrl: 'https://portfolio.test',
      destination: { teacherId: 'science-b', classId: 'b-1' },
      studentNumbers: ['4'],
      blob: png(),
      title: '물질 분리 공방 결과',
      description: '별 7개',
      now: new Date('2026-10-03T13:00:00Z'),
      fetcher: fetchMock as unknown as typeof fetch,
    });

    expect(results).toEqual([{ studentNumber: '4', ok: true, postId: 'post-ok' }]);
    const session = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(session).toMatchObject({ classId: 'b-1', studentNumber: '4', idempotencyKey: 'matter-properties:science-b:b-1:4:2026-10-03' });
    const finalize = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(finalize).toMatchObject({ type: 'image', uploadToken: 'token-4', driveFileIds: ['file-4'], mimeTypes: ['image/png'] });
  });

  it('keeps partial group failures retryable', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/upload-session')) {
        const body = JSON.parse(String(init?.body));
        return Response.json({ uploadToken: `token-${body.studentNumber}`, files: [{ fileId: `file-${body.studentNumber}`, uploadUrl: `https://upload.test/${body.studentNumber}` }] });
      }
      if (url === 'https://upload.test/5') return new Response(null, { status: 503 });
      if (url.startsWith('https://upload.test/')) return new Response(null, { status: 200 });
      if (url.endsWith('/upload-finalize')) return Response.json({ postId: 'post-ok' });
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    const results = await submitPortfolioGroup({
      baseUrl: 'https://portfolio.test',
      destination: { teacherId: 'science-b', classId: 'b-1' },
      studentNumbers: ['4', '5'],
      blob: png(),
      title: '물질 분리 공방 결과',
      description: '별 7개',
      fetcher,
    });

    expect(results.map(r => [r.studentNumber, r.ok])).toEqual([['4', true], ['5', false]]);
    expect(results[1].error).toBe('file-upload-failed');
  });
});
