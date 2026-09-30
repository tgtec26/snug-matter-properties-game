export type State = 'solid' | 'liquid' | 'gas';
export type Method = 'density' | 'solubility' | 'boiling';
export type InvestigateKind = 'density-solid' | 'density-liquid' | 'solubility' | 'heating';
export type MissionKind = 'tutorial' | 'required' | 'final' | 'optional';
export type Phase =
  | 'title' | 'intro' | 'board' | 'accept' | 'investigate' | 'choose' | 'separate'
  | 'result' | 'quiz' | 'summary';

export interface Substance {
  id: string; name: string; state: State; color: string;
  /** 표 Ⅰ-1 값. 교과서 값이 없으면 null (densityRank로 정성 표현) */
  density: number | null;
  densityNote?: string;
  meltingPoint: number | null; boilingPoint: number | null;
  /** 물 100 g 기준 [{t: ℃, g}] — 곡선 모양만 교과서에 맞춤 */
  solubility: { t: number; g: number }[] | null;
  /** 액체: 물과 섞이는가 */
  misciblesWithWater?: boolean;
  /** 고체: 물에 녹는가 */
  dissolvesInWater?: boolean;
  /** 고체: 소금물(밀도가 중간)에서 뜨는가 */
  floatsInSaltwater?: boolean;
  /** 성분 카드(도감) */
  card: { example: string; page: string };
  /** 자료실 전용(게임에 쓰이지 않음) */
  reference?: boolean;
}

export interface MissionStep {
  method: Method;
  /** 이 단계에서 얻는 물질(순서대로). 증류는 끓는점 낮은 순 */
  obtains: string[];
  /** 단계 끝에 플라스크에 남는 것(있다면) */
  leaves?: string[];
}
export interface Mission {
  id: string; title: string; place: string; npc: NpcId; kind: MissionKind;
  /** 혼합물 성분 substance id. 용매(물·소금물)도 성분으로 넣는다 */
  components: string[];
  investigate: { kind: InvestigateKind; targets: string[] } | null;
  steps: MissionStep[];
  /** 갈림길 안내판 문구 (없으면 기본 문구) */
  choosePrompt?: string;
  intro: string[]; outro: string[];
  /** 지도 좌표 (1280×800) */
  pos: { x: number; y: number };
}
export type NpcId = 'master' | 'scrap' | 'cook' | 'researcher' | 'brewer' | 'farmer';

export interface QuizQuestion { id: string; mission: string; q: string; choices: string[]; answer: number; why: string; page: string }
export interface DialogConfig {
  intro: string[];
  npcs: Record<NpcId, { name: string; color: string }>;
  /** canSeparate 실패 이유 키 → 한 줄 안내 */
  reasons: Record<string, string>;
  /** 갈림길 힌트 */
  hints: Record<Method, string>;
}
/** 미니게임별 수치 (JSON). 값이 없으면 각 컴포넌트의 기본값 사용 */
export type MinigameConfig = Record<string, Record<string, number>>;

export interface MinigameResult { stars: 0 | 1 | 2 | 3; purity?: number }
