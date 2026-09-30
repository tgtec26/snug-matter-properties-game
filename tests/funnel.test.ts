import { describe, expect, it } from 'vitest';
import { FUNNEL_DEFAULTS as D, judgeFunnel, settleStep, funnelCfg } from '@/game/minigames/funnel';

describe('funnel', () => {
  const iA = 1 - D.band, iB = 1 + D.band;
  it('정확히 놓으면 3별 순도 1', () => {
    const r = judgeFunnel(iA, iB, D);
    expect(r.stars).toBe(3); expect(r.purity).toBe(1); expect(r.reason).toBe('clean');
  });
  it('허용 폭 안이면 만점', () => {
    expect(judgeFunnel(iA + D.tolerance, iB - D.tolerance, D).purity).toBe(1);
  });
  it('아래층을 덜 받으면 감점·이유', () => {
    const r = judgeFunnel(0.3, iB, D);
    expect(r.purity).toBeLessThan(0.75); expect(r.reason).toBe('left-water');
  });
  it('너무 받으면 경계면이 아래층에 섞임', () => {
    expect(judgeFunnel(1.1, iB, D).reason).toBe('boundary-in-water');
  });
  it('경계면을 덜 빼면 boundary-left, 너무 빼면 oil-lost', () => {
    expect(judgeFunnel(iA, 1.0, D).reason).toBe('boundary-left');
    expect(judgeFunnel(iA, 1.7, D).reason).toBe('oil-lost');
  });
  it('순도 0 하한', () => { expect(judgeFunnel(0, 1.75, D).purity).toBe(0); });
  it('층 분리는 시간에 따라 진행, 흔들면 되돌아감', () => {
    expect(settleStep(0, D.settleSeconds, 0, D)).toBe(1);
    expect(settleStep(0.5, 0.1, 0.3, D)).toBeLessThan(0.5);
    expect(settleStep(0, 0.1, 0.3, D)).toBe(0);
  });
  it('config 덮어쓰기', () => { expect(funnelCfg({ band: 0.3 }).band).toBe(0.3); expect(funnelCfg({}).band).toBe(D.band); });
});
