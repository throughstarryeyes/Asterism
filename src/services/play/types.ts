// the shapes the Play games keep. they live in two places:
//  - ProjectPlay rides with a document (its Character Lab answers, optional scenes, and what the writer chose to keep),
//    so it syncs, backs up and exports with the document.
//  - PlayStats rides with the writer (solo adventures in progress, custom tables, and the daily limit on Quill Points).

export type GameId = 'roulette' | 'missing_scene' | 'lab' | 'adventure' | 'mystery' | 'multiplayer' | 'quick';

// one answer in the Character Lab. `twistId` is empty for the first version of a scenario.
export interface LabAnswer {
  id: string;
  characterId?: string;
  characterName: string;
  scenarioId: string;
  twistId?: string;
  choiceId: string;
  // when the writer picked "something else entirely", what they did
  other?: string;
  why: string;
  at: string;
}

// a scene written for a gap the writer was shown. it is kept beside the manuscript, not in it, until the writer says so.
export interface OptionalScene {
  id: string;
  title: string;
  html: string;
  // the chapter it belongs after (or the one it is about)
  chapterId?: string;
  // the missing-scene suggestion it answered, if any
  suggestionId?: string;
  characters?: string[];
  reflections?: Array<{ question: string; answer: string }>;
  // true once the writer put it into the manuscript as a chapter
  inManuscript?: boolean;
  createdAt: string;
}

// something the writer kept from a game as a note on the document
export interface SavedPlay {
  id: string;
  game: GameId;
  title: string;
  text: string;
  at: string;
}

export interface ProjectPlay {
  lab?: LabAnswer[];
  scenes?: OptionalScene[];
  // missing-scene suggestions the writer said are on purpose
  dismissed?: string[];
  saved?: SavedPlay[];
}

// ---- solo adventures ----

export type AdventureSlot = 'setting' | 'characterA' | 'characterB' | 'connection' | 'situation';

export interface AdventureRolls {
  setting: string;
  characterA: string;
  characterB: string;
  connection: string;
  situation: string;
}

export type OracleAnswer = 'yes_and' | 'yes' | 'yes_but' | 'no_but' | 'no' | 'no_and';

export interface JournalEntry {
  id: string;
  kind: 'note' | 'oracle' | 'event' | 'complication' | 'table' | 'roll';
  // what was asked or rolled, then what came of it
  text: string;
  result?: string;
  at: string;
}

export interface Adventure {
  id: string;
  title: string;
  rolls: AdventureRolls;
  locked: AdventureSlot[];
  // names the writer gave the two characters (the rolls describe them, they do not name them)
  nameA: string;
  nameB: string;
  // how likely the oracle's yes is to start with
  odds: 'likely' | 'even' | 'unlikely';
  // 1 to 9: how readily random events happen. doubles on the oracle's die call for an event when the digit is at or below this.
  chaos: number;
  journal: JournalEntry[];
  // set once it has been turned into a document
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomTable {
  id: string;
  name: string;
  entries: string[];
}

export interface PlayStats {
  adventures?: Adventure[];
  tables?: CustomTable[];
  // Quill Points paid for playing today, so the games cannot be farmed
  day?: string;
  awards?: number;
}
