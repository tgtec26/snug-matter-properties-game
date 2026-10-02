import { create } from 'zustand';
import type { AudioConfig } from '@/game/audio';
import type { DialogConfig, MinigameConfig, Mission, QuizQuestion, Substance } from '@/game/types';

interface DataState {
  substances: Substance[]; missions: Mission[]; dialog: DialogConfig | null;
  quiz: QuizQuestion[]; minigame: MinigameConfig; audio: AudioConfig | null;
  loaded: boolean; error: string | null;
  load: () => Promise<void>;
}
const getJson = async <T,>(f: string): Promise<T> => {
  const r = await fetch(`/data/${f}.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${f}.json: HTTP ${r.status}`);
  return (await r.json()) as T;
};

export const useDataStore = create<DataState>()((set) => ({
  substances: [], missions: [], dialog: null, quiz: [], minigame: {}, audio: null, loaded: false, error: null,
  load: async () => {
    try {
      const [substances, missions, dialog, quiz, minigame, audio] = await Promise.all([
        getJson<Substance[]>('substances'), getJson<Mission[]>('missions'), getJson<DialogConfig>('dialog-config'),
        getJson<QuizQuestion[]>('quiz-pool'), getJson<MinigameConfig>('minigame-config'), getJson<AudioConfig>('audio-config'),
      ]);
      set({ substances, missions, dialog, quiz, minigame, audio, loaded: true, error: null });
    } catch (e) {
      set({ error: String(e), loaded: true });
    }
  },
}));
