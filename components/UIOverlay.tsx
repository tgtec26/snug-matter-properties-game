'use client';

import { HUD } from '@/components/HUD';
import { TopControls } from '@/components/TopControls';
import { AudioRunner } from '@/components/AudioRunner';
import { TitleOverlay } from '@/components/overlays/TitleOverlay';
import { IntroOverlay } from '@/components/overlays/IntroOverlay';
import { BoardOverlay } from '@/components/overlays/BoardOverlay';
import { AcceptOverlay } from '@/components/overlays/AcceptOverlay';
import { InvestigateOverlay } from '@/components/overlays/InvestigateOverlay';
import { ChooseOverlay } from '@/components/overlays/ChooseOverlay';
import { SeparateOverlay } from '@/components/overlays/SeparateOverlay';
import { ResultOverlay } from '@/components/overlays/ResultOverlay';
import { QuizOverlay } from '@/components/overlays/QuizOverlay';
import { SummaryOverlay } from '@/components/overlays/SummaryOverlay';

/** 1280×800 네이티브 좌표. 루트는 클릭을 통과시키고 각 오버레이가 pointer-events-auto를 켠다. */
export function UIOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <TitleOverlay />
      <IntroOverlay />
      <BoardOverlay />
      <AcceptOverlay />
      <InvestigateOverlay />
      <ChooseOverlay />
      <SeparateOverlay />
      <ResultOverlay />
      <QuizOverlay />
      <SummaryOverlay />
      <HUD />
      <TopControls />
      <AudioRunner />
    </div>
  );
}
