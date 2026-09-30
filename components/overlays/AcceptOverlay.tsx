'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { loadDex } from '@/game/dex';
import { Backdrop, AssetImg, MixtureTray } from '@/components/ui';
import { DialogBox } from '@/components/overlays/DialogBox';

/** 의뢰 수락: 실험대 배경에 혼합물 성분 카드(특성 ?) + 의뢰 NPC 대사 */
export function AcceptOverlay() {
  const phase = useGameStore(s => s.phase);
  return phase === 'accept' ? <Accept /> : null;
}

function Accept() {
  const id = useGameStore(s => s.missionId);
  const next = useGameStore(s => s.next);
  const m = useDataStore(d => d.missions.find(x => x.id === id));
  const dialog = useDataStore(d => d.dialog);
  const [known] = useState(() => loadDex().known);
  if (!m || !dialog) return null;
  const npc = dialog.npcs[m.npc];
  return (
    <div className="absolute inset-0 pointer-events-auto">
      <Backdrop name="bench" tone="linear-gradient(#5b4128,#8a6238)" />
      <AssetImg src={`/assets/npc/${m.npc}.webp`} className="absolute left-[80px] top-[100px] w-[260px] h-[260px] rounded-3xl border-[6px] border-amber-200 object-cover shadow-2xl" />
      <div className="absolute left-[400px] top-[190px]"><MixtureTray ids={m.components} known={known} /></div>
      <DialogBox key={m.id} npcName={npc.name} color={npc.color} portrait={`/assets/npc/${m.npc}.webp`} lines={m.intro} onDone={next} />
    </div>
  );
}
