'use client';

import { useGameStore } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { Backdrop, AssetImg } from '@/components/ui';
import { DialogBox } from '@/components/overlays/DialogBox';

export function IntroOverlay() {
  const phase = useGameStore(s => s.phase);
  const next = useGameStore(s => s.next);
  const dialog = useDataStore(d => d.dialog);
  if (phase !== 'intro' || !dialog) return null;
  const npc = dialog.npcs.master;
  return (
    <div className="absolute inset-0 pointer-events-auto">
      <Backdrop name="bench" tone="linear-gradient(#5b4128,#8a6238)" />
      <AssetImg src="/assets/npc/master.webp" className="absolute left-[80px] top-[150px] w-[300px] h-[300px] rounded-3xl border-[6px] border-amber-200 object-cover shadow-2xl" />
      <DialogBox npcName={npc.name} color={npc.color} portrait="/assets/npc/master.webp" lines={dialog.intro} onDone={next} />
    </div>
  );
}
