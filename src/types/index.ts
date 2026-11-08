import type { CoachMemory } from '../services/coach/types';
import type { CustomSound } from '../services/soundRecipes';
import type { CustomSoundscape } from '../services/soundscapes';
import type { AnalyzerPreference, FindingFeedback } from '../services/analyzerFeedback';
import type { CustomCursor } from '../services/customCursor';
import type { TrailConfig } from '../services/trails';
import type { ChimeConfig, ChimeEvent } from '../services/chimes';
import type { ShapeConfig } from '../services/shapes';
import type { CustomCover, CustomShelf, CustomSkin } from '../services/looks';
import type { CustomEdge, CustomTexture } from '../services/surfaces';
import type { CustomPairing } from '../services/pairings';
import type { CustomBundle } from '../services/bundles';
import type { CelebrationConfig } from '../services/celebrations';
import type { Season, SeasonProgress } from '../services/seasons';
import type { BookDesign } from '../services/book/design';
import type { Look } from '../services/backdrops';
import type { Palette } from '../services/palettes';
import type { CoverDesign } from '../services/cover/design';
import type { BranchingStory } from '../services/branching';
import type { QuestState } from '../services/quests';
import type { ProjectPlay, PlayStats } from '../services/play/types';
import type { CoachKnowledge } from '../services/coach/knowledge';
import type { PageLayout } from '../services/pageLayout';
import type { CoachSettings } from '../services/coach/settings';

export type ThemeMode = 'parchment' | 'black' | 'white' | 'celestial' | 'velvet' | 'solarium' | 'scriptorium' | 'composition' | 'pasteldream' | 'duck' | 'custom' | string;

// the built-in cursors, or the id of one the writer uploaded (see services/customCursor).
export type CursorStyle = 'default' | 'quill' | 'wand' | 'golden_nib' | 'starlight' | (string & {});

export type EditorFont = 'Lora' | 'Playfair Display' | 'Cinzel' | 'Outfit' | 'Courier Prime' | 'Caveat' | 'Patrick Hand' | string;

export interface CustomThemeConfig {
  id: string;
  name: string;
  bgApp: string;
  bgPaper: string;
  textMain: string;
  textSecondary: string;
  accentPrimary: string;
  accentGold: string;
  borderSubtle: string;
  borderStrong: string;
  cornerRoundness: number; // 0 for square like Google Docs, up to 24px
  fontFamily?: string;
  // page treatment, like the built-in notebook themes have.
  paperStyle?: 'plain' | 'lined' | 'grid' | 'dots';
  ruleColor?: string;
  marginLine?: boolean;
  marginColor?: string;
  // use a handwriting face for the manuscript text.
  handwriting?: boolean;
  // uploaded images, stored in IndexedDB (see services/assetStore). `Dim` is how
  // strongly the theme's own color is laid over the picture, to keep text readable.
  appBgImageId?: string;
  appBgDim?: number;
  pageBgImageId?: string;
  pageBgDim?: number;
  // gradients, materials, stars and glass behind the app and behind the page (see services/backdrops)
  appLook?: Look;
  pageLook?: Look;
  createdAt?: string;
}

// background pictures for a theme. files live in IndexedDB; `Dim` is how strongly
// the theme's own color is laid over the picture, to keep text readable.
export interface ThemeImages {
  appBgImageId?: string;
  appBgDim?: number;
  pageBgImageId?: string;
  pageBgDim?: number;
  appLook?: Look;
  pageLook?: Look;
}

export interface CustomFontConfig {
  id: string;
  name: string;
  family: string;
  source: 'google' | 'url' | 'local';
  url?: string;
  // for uploaded files (source 'local'): the stored font data.
  assetId?: string;
  fileName?: string;
}

export type NoteShape = 'square' | 'rounded' | 'pill' | 'oval' | 'blob' | 'folded' | 'hexagon' | 'ticket';
export type NoteBorder = 'none' | 'solid' | 'dashed' | 'dotted' | 'double' | 'stitched' | 'tape' | 'pin';

// how a sticky note looks. every part is optional, so a plain yellow note needs none of it
export interface NoteStyle {
  color?: string;
  shape?: NoteShape;
  border?: NoteBorder;
  borderColor?: string;
  borderWidth?: number;
  // 0.3 to 1
  opacity?: number;
  // a picture behind the text, as a small data URL
  image?: string;
}

// a note on the page. today that is a sticky note; pets will be notes too and share everything
// here: dismissible, shown on one document or everywhere, movable, starting in a corner.
export interface Scratchpad {
  id: string;
  title: string;
  text: string;
  updatedAt: string;
  kind?: 'note' | 'pet';
  // set while it sits on the page; where it is and how big
  floating?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  // where it shows: every document, or only the documents listed
  everywhere?: boolean;
  docIds?: string[];
  style?: NoteStyle;
}

export interface DocToolbox {
  hiddenTabs?: SidebarTab[];
  // the tool that is open when the document opens; 'closed' keeps the sidebar shut
  openTab?: SidebarTab | 'closed';
}

export type ToolKind = 'mindmap' | 'branching' | 'character' | 'scene' | 'cards';

export type AppViewMode = 'home' | 'standard' | 'distraction_free' | 'book_preview' | 'mindmap' | 'tool' | 'prompt_lab' | 'branching' | 'sheet' | 'cards' | 'shop' | 'social' | 'cover' | 'play' | 'scratchpads';

export interface CustomSeparator {
  id: string;
  name: string;
  rule: 'dashed' | 'solid' | 'none' | 'gilt';
  // the ornament under the rule, plain text
  mark: string;
  gold?: boolean;
}

export interface CustomFlourish {
  id: string;
  name: string;
  top: string;
  bottom: string;
  frame?: 'double' | 'gilt';
}

// a loading animation: shapes that light up one after another
export type LoaderShape = 'star' | 'sparkle' | 'heart' | 'diamond' | 'circle' | 'moon' | 'leaf' | 'drop';
export type LoaderLayout = 'row' | 'ring' | 'arc' | 'wave' | 'constellation';
export interface LoaderConfig {
  id: string;
  name: string;
  shape: LoaderShape;
  layout: LoaderLayout;
  // 3 to 7
  count: number;
  // seconds between one shape lighting and the next
  step: number;
  // 'accent' follows the theme, otherwise a hex color
  color: string;
}

export type EditorScrollMode = 'single' | 'infinite';

export type EditorReviewMode = 'editing' | 'suggesting' | 'commenting';

export type SidebarTab = 'scratchpad' | 'coach' | 'chapters' | 'bible' | 'foundations' | 'prompts' | 'threads' | 'analyzer' | 'mindmap' | 'comments' | 'goals' | 'timeline';

export type KeystrokeSound = 'off' | 'thocky' | 'creamy' | 'clacky' | 'clicky' | 'typewriter' | 'bubbles' | 'duck' | 'droplet' | 'thud' | 'real-typewriter' | `custom-${string}`;

export type CalliopeMood = 'sparkly' | 'dramatic' | 'soft' | 'obsessed' | 'sleepy' | 'blocked';

export interface Chapter {
  id: string;
  title: string;
  order: number;
  content: string; // HTML formatted string
  synopsis?: string;
  status: 'draft' | 'revised' | 'final';
  wordCount: number;
  folder?: string; // act or section folder within the document
  updatedAt: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  aliases?: string[];
  role: 'protagonist' | 'antagonist' | 'deuteragonist' | 'mentor' | 'supporting' | 'minor';
  archetype?: string;
  coreDesire: string;
  fatalFlaw: string;
  internalConflict: string;
  physicalDescription: string;
  speechPattern?: string;
  theSecret: string; // the unspoken truth or hidden motive
  secretKnownBy?: string[]; // ids of characters who already know the secret when the story opens
  secretHiddenFrom?: string[]; // ids of characters who must not know it (yet)
  relationships: Array<{
    targetCharacterId: string;
    targetName: string;
    relationshipType: string;
    notes: string;
    // tags that say how they are connected (see services/relationships); older cards only have the text above
    types?: string[];
  }>;
  avatarColor?: string;
}

export interface LocationProfile {
  id: string;
  name: string;
  type: string;
  atmosphere: string;
  sensoryDetails: string;
  significance: string;
  // other names the story uses for it ("the Keep" for Greywatch keep)
  aliases?: string[];
}

export interface LoreEntry {
  id: string;
  title: string;
  category: 'magic_rules' | 'history' | 'technology' | 'faction' | 'culture' | 'custom';
  content: string;
}

// a fact that belongs to the story rather than to one character's card.
export interface SecretEntry {
  id: string;
  text: string;
  knownBy: string[]; // character ids who know it when the story opens
  hiddenFrom: string[]; // character ids who must not know it (yet)
}

export interface StoryBible {
  characters: CharacterProfile[];
  locations: LocationProfile[];
  lore: LoreEntry[];
  secrets?: SecretEntry[];
}

export type FoundationCategory = 
  | 'characters' 
  | 'plot' 
  | 'relationships' 
  | 'autopsy'
  | 'faultline'
  | 'sorrow' 
  | 'identity' 
  | 'belonging' 
  | 'world'
  | 'descent'
  | 'tropes'
  | 'narration';

export interface FoundationCard {
  id: string;
  title: string;
  category: FoundationCategory;
  prompt: string;
  deepeningQuestions: string[];
  tags?: string[];
  isCustom?: boolean;
}

export interface CardReflection {
  id: string;
  cardId: string;
  cardTitle: string;
  category: FoundationCategory;
  reflectionText: string;
  linkedChapterId?: string;
  linkedCharacterId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ThreadType = 
  | 'mystery' 
  | 'promise' 
  | 'secret' 
  | 'foreshadowing' 
  | 'conflict' 
  | 'unanswered_question';

export type ThreadStatus = 
  | 'introduced' 
  | 'simmering' 
  | 'resolved' 
  | 'intentionally_open';

// a passage the writer confirmed belongs to a thread.
export interface ThreadPassage {
  id: string;
  chapterId: string;
  quote: string;
  role: 'setup' | 'development' | 'payoff';
  note?: string;
  // a little of the text either side, kept to find the passage again after edits.
  before?: string;
  after?: string;
  // set when the passage can no longer be found in the manuscript.
  lost?: boolean;
}

// something the writer expects the story to deliver on a thread.
export interface ThreadExpectation {
  id: string;
  text: string;
  status: 'open' | 'fulfilled' | 'abandoned';
}

export interface PlotThread {
  id: string;
  title: string;
  type: ThreadType;
  status: ThreadStatus;
  introducedInChapterId?: string;
  notes: string;
  passageQuote?: string;
  // context for finding the passage again, and whether it can still be found.
  passageBefore?: string;
  passageAfter?: string;
  originLost?: boolean;
  importance: 'subtle' | 'major' | 'central';
  // the open loop (services/openLoops) this thread started from, if it started from one.
  loopId?: string;
  // passages the writer confirmed follow the thread, and what they expect it to deliver.
  passages?: ThreadPassage[];
  expectations?: ThreadExpectation[];
  // suggested passages the writer said are not about this thread ("chapterId|words").
  rejectedLinks?: string[];
  createdAt: string;
  updatedAt: string;
}

// something that happens in the story. the timeline list's order is story order.
export interface TimelineEvent {
  id: string;
  title: string;
  // when, in the writer's words ("the night of the storm"), and optionally as a date (yyyy-MM-DD,
  // any year, invented ones included) so the order and the gaps can be checked.
  when?: string;
  // superseded by `when`, which reads dates as well as words. still honored if present.
  date?: string;
  // what a relative time ("the Tuesday after") counts from. default: the event above it.
  relativeTo?: string;
  characters?: string[];
  notes?: string;
  // where the story tells it: a quote, found again after edits like a thread's passages.
  chapterId?: string;
  quote?: string;
  before?: string;
  after?: string;
  lost?: boolean;
  createdAt: string;
}

export type GoalType = 'words' | 'time' | 'scene' | 'character' | 'revision' | 'custom';

export interface WritingGoal {
  id: string;
  title: string;
  type: GoalType;
  target: number;
  current: number;
  unit: string;
  pointsReward: number;
  completed: boolean;
  // paid once, so finishing it again does not pay again
  rewarded?: boolean;
  dueDate?: string;
}

export interface CosmeticItem {
  id: string;
  name: string;
  category: 'theme' | 'cursor' | 'soundscape' | 'keystroke' | 'separator' | 'flourish' | 'loader' | 'trail' | 'chime' | 'shape' | 'confetti' | 'skin' | 'shelf' | 'cover' | 'pairing' | 'texture' | 'edge' | 'pack';
  cost: number;
  // set by the shop from the cost (see services/shop)
  tier?: 'free' | 'common' | 'uncommon' | 'rare' | 'earned';
  // a badge that unlocks this instead of points
  earnedWith?: string;
  // only sold in this season; kept for good once bought
  season?: Season;
  // a bundle: the ids of the items it unlocks together
  contains?: string[];
  description: string;
  unlocked: boolean;
  previewColor?: string;
  previewIcon?: string;
}

export interface WritingBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'sprint' | 'words' | 'night' | 'cards' | 'streak';
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

export interface WritingPrompt {
  id: string;
  text: string;
  category: 'turning_point' | 'wound_confession' | 'scene_starter' | 'sensory_atmosphere' | 'one_liner' | 'exercise';
  calliopeMood?: CalliopeMood;
  flavorNotes?: string;
  defaultTargetWords?: number;
}

export interface SprintConfig {
  durationMinutes: number;
  targetWords: number;
  basePoints: number;
  bonusPointsPer100Words: number;
  promptText?: string;
  promptCategory?: string;
}

// a finished sprint, kept with its document so it follows the document to other devices
export interface SprintRecord {
  id: string;
  at: string;
  minutes: number;
  words: number;
  target?: number;
}

export interface ActiveSprintState {
  isActive: boolean;
  startTime: string;
  durationSeconds: number;
  remainingSeconds: number;
  startWordCount: number;
  currentWordCount: number;
  wordsWritten: number;
  targetWords: number;
  promptText?: string;
  config: SprintConfig;
}

export interface DocumentComment {
  id: string;
  chapterId: string;
  passageText: string;
  commentText: string;
  author: string;
  createdAt: string;
  resolved: boolean;
  type?: 'comment' | 'suggestion';
  suggestedText?: string;
  status?: 'pending' | 'accepted' | 'rejected';
}

export interface DocumentVersion {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  wordCount: number;
  chapterCount: number;
  trigger: 'manual' | 'periodic' | 'safety_net' | 'milestone';
  description?: string;
  chapters: Array<{
    id: string;
    title: string;
    order: number;
    content: string;
    wordCount: number;
  }>;
}

export interface MindMapNode {
  id: string;
  label: string;
  type: 'character' | 'plot_event' | 'clue' | 'location' | 'theme' | 'custom';
  x: number;
  y: number;
  color: string;
  notes?: string;
  linkedEntityId?: string;
}

export interface MindMapEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
}

export interface MindMap {
  id: string;
  title: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export type FindingCategory = 'contradiction' | 'dropped_thread' | 'expansion' | 'continuity' | 'drafting_note';

export interface AnalysisFinding {
  id: string;
  category: FindingCategory;
  title: string;
  summary: string;
  evidencePassages: Array<{
    chapterId: string;
    chapterTitle: string;
    quote: string;
  }>;
  confidence: 'definite' | 'probable' | 'possible_exploration';
  linkedFoundationCardId?: string;
  linkedThreadId?: string;
  // the open loop (services/openLoops) this finding is about, if any. ties the finding to the
  // coach's board so an answer on one side reaches the other.
  loopId?: string;
  status: 'unreviewed' | 'confirmed' | 'explained' | 'intentional' | 'dismissed';
  authorExplanation?: string;
  // the character this finding is about, when it has one
  subject?: string;
  // the preference that is hiding this finding
  hiddenBy?: string;
}

export interface EstablishedFact {
  id: string;
  subject: string;
  claim: string;
  sourceChapterId: string;
  sourceQuote: string;
  isIntentionalContradiction?: boolean;
}

export interface AuthorStyleRule {
  id: string;
  pattern: string;
  meaning: string;
  examplesCount: number;
  lastUpdated: string;
}

export interface StoryLexiconConfig {
  deflectionPhrases: string[];
  traumaCues: string[];
  tactileObjects: string[];
  mysteryInquiries: string[];
  commitmentPhrases: string[];
  eyeColors: string[];
  hairColors: string[];
  customCategories?: Record<string, string[]>;
}

export interface ReadFactRecord {
  id: string;
  character: string;
  kind: 'eyes' | 'hair' | 'age' | 'hand' | 'mark' | 'death';
  label: string;
  value: string;
  chapterId: string;
  chapterTitle: string;
  quote: string;
  ignored: boolean;
}

// where the scan saw a character: leaving for a place, reaching it, being said to be in it, or
// simply in a scene set there.
export interface ReadPlaceRecord {
  id: string;
  character: string;
  how: 'set out for' | 'arrived at' | 'was in' | 'seen in';
  place: string;
  chapterId: string;
  chapterTitle: string;
  quote: string;
  order: number;
  ignored: boolean;
}

// how a character comes to know a secret: the card says so, they were told or found out, they were
// there when it came up, or they spoke as if they knew.
export interface ReadKnowledgeRecord {
  id: string;
  secret: string; // "Corin’s secret" or the secret's own words
  secretText: string;
  character: string;
  how: 'owner' | 'marked knows' | 'marked must not know' | 'learned' | 'there' | 'spoke';
  chapterId: string;
  chapterTitle: string;
  quote: string;
  order: number;
  ignored: boolean;
}

export interface StoryMemoryVault {
  establishedFacts: EstablishedFact[];
  authorStyleRules: AuthorStyleRule[];
  lexiconConfig?: StoryLexiconConfig;
  // statements the writer set aside in the story memory view (see characterFacts.statementKey).
  ignoredStatements?: string[];
  // how the writer answered findings, and the scoped preferences they chose (see services/analyzerFeedback)
  feedback?: FindingFeedback[];
  preferences?: AnalyzerPreference[];
  declinedSuggestions?: string[];
  // what the last scan read about each character (derived; rebuilt on every scan).
  readFacts?: ReadFactRecord[];
  readPlaces?: ReadPlaceRecord[];
  readKnowledge?: ReadKnowledgeRecord[];
  analysisPreferences: {
    sensitivity: 'gentle' | 'balanced' | 'rigorous';
    ignoreResolvedThreads: boolean;
  };
}

export interface SheetRow { label: string; value: string; key: string }

export type StatKind = 'none' | 'classic' | 'psych' | 'both';

export interface SheetData {
  rows: SheetRow[];
  stats: StatKind;
  // the scene starter goal ('none' for no starter)
  starter: string;
  notes: string;
}

export interface Project {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  // retired: a saved genre is kept as a tag when the document loads (see services/tags)
  genre: string;
  synopsis: string;
  folder?: string; // document folder/collection grouping (e.g. series or manuscript folder)
  // the writer's own labels for the document
  tags?: string[];
  // the document this is an alternate draft of
  alternateOf?: string;
  // set on a copy made by joining a live session: which shared document it is, so joining again updates this copy instead of making another
  liveFrom?: { doc: string; title: string };
  // an interactive story the reader clicks through (see services/branching)
  branching?: BranchingStory;
  // the sprints finished in this document, newest last
  sprints?: SprintRecord[];
  // this document's cover, when it differs from the writer's usual one
  coverStyle?: string;
  // how the book is laid out in the book view and the PDF (see services/book)
  book?: BookDesign;
  // the wrap-around book cover made in the cover creator (see services/cover)
  coverDesign?: CoverDesign;
  // set on a mind map or branching story that lives in the library as its own document
  kind?: ToolKind;
  // the manuscript (by document id) a tool document is attached to
  attachedTo?: string;
  // brain-dump notes that belong to this document (see components/Sidebar/ScratchpadPanel)
  scratchpads?: Scratchpad[];
  // which sidebar tools this document shows, and which one is open when it is opened
  toolbox?: DocToolbox;
  // a rolled character or scene
  sheet?: SheetData;
  // what came out of the Play games for this document (see services/play)
  play?: ProjectPlay;
  // the writer marked the first draft done; the points are paid only once
  draftComplete?: boolean;
  draftPaid?: boolean;
  draftMode?: 'chaptered' | 'open_draft'; // choose between discrete chapters or a single continuous open draft
  chapters: Chapter[];
  storyBible: StoryBible;
  plotThreads: PlotThread[];
  timeline?: TimelineEvent[];
  reflections: CardReflection[];
  goals: WritingGoal[];
  comments: DocumentComment[];
  mindMap: MindMap;
  findings: AnalysisFinding[];
  memoryVault: StoryMemoryVault;
  coachMemory?: CoachMemory;
  useStoryTheme?: boolean;
  storyTheme?: {
    activeTheme?: ThemeMode;
    customThemeId?: string;
    customTheme?: CustomThemeConfig;
    cornerRoundness?: number;
    activeFont?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  quillPoints: number;
  totalWordsWritten: number;
  totalMinutesFocussed: number;
  sprintsCompleted: number;
  unlockedCosmetics: string[];
  unlockedBadges: string[];
  activeTheme: ThemeMode;
  activeCursor: CursorStyle;
  activeFont: EditorFont;
  keystrokeSound: KeystrokeSound;
  keystrokeVolume: number;
  calliopeMood: CalliopeMood;
  fontSize: number;
  lineHeight: number;
  indentParagraphs: boolean;
  typewriterMode: boolean;
  // 'off', a built-in ambient sound, or the id of a soundscape the writer made.
  ambientSound: string;
  ambientVolume: number;
  cornerRoundness: number; // 0 for square (Google Docs style) to 24px
  customThemes: CustomThemeConfig[];
  customFonts: CustomFontConfig[];
  activeCustomThemeId?: string | null;
  documentFolders?: string[];
  coach?: CoachSettings;
  home?: HomeSettings;
  // page width and margins in the editor.
  page?: PageLayout;
  // everything the coach looks for, as editable data (see services/coach/knowledge).
  coachKnowledge?: CoachKnowledge;
  // keystroke sounds the writer made or imported.
  customSounds?: CustomSound[];
  // pictures added to built-in themes, by theme id.
  themeImages?: Record<string, ThemeImages>;
  // when each custom theme, sound and built-in theme picture was last saved or deleted here (see services/sync/extras).
  extrasStamps?: Record<string, { at: number; gone?: true }>;
  // soundscapes and cursors the writer made or uploaded.
  customSoundscapes?: CustomSoundscape[];
  customCursors?: CustomCursor[];
  // the loading animation: 'stars' (the default), or one unlocked in the shop
  activeLoader?: string;
  // loaders the writer made in the workshop
  customLoaders?: LoaderConfig[];
  // the scene break style and the title page flourish ('stars' and 'none' are the defaults)
  activeSeparator?: string;
  activeFlourish?: string;
  // scene breaks and title page flourishes the writer made in the shop workshops
  customSeparators?: CustomSeparator[];
  customFlourishes?: CustomFlourish[];
  // pointer trails, chimes and comment shapes the writer made, and the ones in use
  customTrails?: TrailConfig[];
  customChimes?: ChimeConfig[];
  customShapes?: ShapeConfig[];
  // document covers and confetti styles the writer made, the confetti in use, and whether ordinary writing points celebrate
  customCovers?: CustomCover[];
  customCelebrations?: CelebrationConfig[];
  // fonts, page textures, margins, window skins, badge shelves and bundles the writer made
  customPairings?: CustomPairing[];
  customTextures?: CustomTexture[];
  customEdges?: CustomEdge[];
  customSkins?: CustomSkin[];
  customShelves?: CustomShelf[];
  customBundles?: CustomBundle[];
  activeCelebration?: string;
  // on unless the writer turns it off
  quietWriting?: boolean;
  // hide the "+N Quill Points" notes altogether
  noPointNotes?: boolean;
  // color palettes kept in the palette tool
  customPalettes?: Palette[];
  activeTrail?: string;
  // the chime for each event; any not listed use the default
  activeChimes?: Partial<Record<ChimeEvent, string>>;
  chimeVolume?: number;
  activeShape?: string;
  // window and header skin, badge shelf style, and the cover new documents wear
  activeSkin?: string;
  activeShelf?: string;
  activeCover?: string;
  // badges pinned to the top of the shelf
  showcase?: string[];
  // page texture, margin decoration and the heading font of a pairing
  activeTexture?: string;
  activeEdge?: string;
  titleFont?: string;
  // words written this season toward the season challenge
  season?: SeasonProgress;
  // analyzer preferences that apply to every project
  analyzerPreferences?: AnalyzerPreference[];
  // daily and weekly challenges and the streak (see services/quests)
  quests?: QuestState;
  // every scratchpad. each says which documents it shows on (see services/scratchpads)
  scratchpads?: Scratchpad[];
  // highlight colors the writer saved
  savedHighlights?: string[];
  // note styles the writer saved to reuse
  savedNoteStyles?: Array<{ id: string; name: string; style: NoteStyle }>;
  // solo adventures, custom tables and the daily limit on points for playing (see services/play)
  play?: PlayStats;
  // chapters already paid for finishing or revising, so changing the status back and forth pays once
  rewarded?: string[];
}

export interface HomeSettings {
  // resume line for the last document. off by default: home is just the library.
  showRecent: boolean;
  // row of standalone tool shortcuts under the library.
  showTools: boolean;
  // tool cards on home, and buttons in a document's top bar, that the writer turned off (ids from services/layout).
  hiddenCards?: string[];
  hiddenBar?: string[];
  // the order of the view buttons in the top bar (ids from services/layout)
  barOrder?: string[];
  // pieces of the bar along the bottom that the writer turned off, and their order
  hiddenCapsule?: string[];
  capsuleOrder?: string[];
  // how the library is ordered ('manual' keeps the saved order)
  sort?: 'manual' | 'edited' | 'newest' | 'oldest' | 'az' | 'za';
}
