import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { 
  Project, 
  Chapter, 
  UserStats, 
  ThemeMode, 
  CursorStyle, 
  EditorFont, 
  AppViewMode, 
  EditorScrollMode,
  EditorReviewMode,
  SidebarTab,
  CharacterProfile,
  SecretEntry,
  LocationProfile,
  LoreEntry,
  PlotThread,
  CardReflection,
  WritingGoal,
  CosmeticItem,
  LoaderConfig,
  CustomSeparator,
  CustomFlourish,
  DocumentComment,
  MindMap,
  ToolKind,
  AnalysisFinding,
  EstablishedFact,
  AuthorStyleRule,
  KeystrokeSound,
  CalliopeMood,
  WritingBadge,
  WritingPrompt,
  SprintConfig,
  ActiveSprintState,
  CustomThemeConfig,
  HomeSettings,
  ThemeImages,
  CustomFontConfig,
  DocumentVersion
} from '../types';
import { sanitizeStory } from '../services/branching';
import { TOOL_NAMES, viewFor } from '../services/toolKinds';
import { REWARD, chapterFinishReward, draftReward, goalReward } from '../services/rewards';
import { applyEvent, buyFreeze, dayKey, ensureDay, liveStreak, newQuestState, swapQuest, takeGoalPoints, takePlanAward, type QuestContext, type QuestEvent, type QuestState } from '../services/quests';
import { insertDividerAtCaret, trackCaret } from '../services/caretMemory';
import { addToTrash, loadTrash, removeFromTrash, saveTrash, type TrashedProject } from '../services/trash';
import { storageService, countWordsFromHtml } from '../services/storage';
import { WELCOME_QP } from '../data/defaultProject';
import { localAssets } from '../services/sync/localAssets';
import { MAX_SCAPES, SCAPE_PREFIX, migrateAmbient, sanitizeSoundscape, scapeAssetIds, scapeProblem, tooLong, validateScapeFile, type CustomSoundscape } from '../services/soundscapes';
import { MAX_CURSORS, cursorCss, hotspotAt, isCursorId, makeCursorImage, sanitizeCursor, type Hotspot } from '../services/customCursor';
import { findCursorPreset, presetCursorCss } from '../services/cursors';
import { MADE, madeFields, madeKey, type MadeKind } from '../services/made';
import { DEFAULT_CHIME_VOLUME, PRESET_CHIMES, chimeFor, pruneChimes, type ChimeConfig, type ChimeEvent } from '../services/chimes';
import { SHAPE_VARS, findShape, shapeStyle, type ShapeConfig } from '../services/shapes';
import { NO_CELEBRATION, findCelebration, type CelebrationConfig } from '../services/celebrations';
import { runCelebration } from '../services/celebrationRun';
import type { CustomCover } from '../services/looks';
import type { TrailConfig } from '../services/trails';
import { coverAssetIds } from '../services/cover/design';
import { MAX_SAVED as MAX_PALETTES, type Palette } from '../services/palettes';
import { findPairing, fontStack } from '../services/pairings';
import { isSystemFont, systemStack } from '../services/systemFonts';
import { findThemePreset, presetCopy } from '../services/themePresets';
import { EDGE_VARS, edgeLook, findTexture } from '../services/surfaces';
import { SKIN_ATTRS, findCustomSkin, skinLook } from '../services/looks';
import { splitId } from '../services/bundles';
import { SEASON_GOAL, SEASON_REWARD, SEASONS, addSeasonWords, inSeason, seasonBadge, seasonOf } from '../services/seasons';
import { cursorKey, extrasOf, imagesKey, prefKey, scapeKey, soundKey, stamped, stampChanges, themeKey, type Extras } from '../services/sync/extras';
import { ambientAudio } from '../services/audioService';
import { useSession, useSessions, getSession, sessionShared, type LiveState } from '../editor/collab/live';
import { setCommentTargets } from '../editor/review';
import { useLiveSession, type LiveApi } from './useLiveSession';
import { fontLoader } from '../services/fontLoader';
import { addFontFile, loadStoredFonts, registerFontBlob } from '../services/fontFiles';
import { MAX_CUSTOM_SOUNDS, parseSoundFile, sanitizeCustomSound, soundAssetIds, validateAudioFile, MAX_AUDIO_SECONDS, newSoundId, type CustomSound, type SoundFile } from '../services/soundRecipes';
import { base64ToBytes, bytesToBase64 } from '../services/exportFonts';
import { getAsset, getAssetUrl, putAsset, newAssetId } from '../services/assetStore';
import { buildStandaloneHtml, collectEmbeddedFonts, restoreEmbeddedFonts } from '../services/exportFonts';
import { useSync, type SyncApi } from './useSync';
import { buildDocx } from '../services/exporters/docx';
import { buildEpub } from '../services/exporters/epub';
import { fileStem, prepareManuscript } from '../services/exporters/manuscript';
import { deleteAsset, pruneAssets } from '../services/assetStore';
import { applyThemeImages, clearThemeImages, hasThemeImages, themeAssetIds } from '../services/themeImages';
import { CUSTOM_THEME_COST, DERIVED_VAR_NAMES, deriveThemeVars } from '../services/customTheme';
import { normalizeCoachSettings, type CoachSettings } from '../services/coach/settings';
import { sanitizeKnowledge, type CoachKnowledge } from '../services/coach/knowledge';
import { normalizePage, pageVars, type PageLayout } from '../services/pageLayout';
import { readStory, scanStory } from '../services/analysisClient';
import { withGenreAsTag } from '../services/tags';
import { tourSeen } from '../services/tour';
import { getActiveEditor } from '../editor/active';
import { applyPending } from '../editor/pending';
import { insertHtml } from '../editor/commands';
import { addSprint } from '../services/sprints';
import { moveScene as moveSceneHtml, removeScene as removeSceneHtml } from '../services/openDraft';
import { detectOpenLoops } from '../services/openLoops';
import { removeThread, saveThread, trackLoop } from '../services/threads';
import { prepareChapters, reanchorThreads, reanchorTimeline } from '../services/passageAnchor';
import { syncTimelineFindings } from '../services/timeline';
import { getEffectiveLexicon } from '../data/defaultStoryLexicon';
import { applyFindingResponse, applyLoopHandled } from '../services/storyMemory';
import { allPreferences, applyPreferences, applyVerdict, checkLabel, describePreference, reopenFinding, type AnalyzerPreference, type AnswerOptions, type FindingVerdict } from '../services/analyzerFeedback';
import { readManuscriptFile } from '../services/manuscriptImporter';
import { CATALOG, MAKE_COST, isOwned } from '../services/shop';
import { findFlourish, separatorHtml } from '../services/ornaments';
import {
  DEFAULT_WRITING_BADGES,
  CALLIOPE_MOODS 
} from '../data/calliopeData';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'reward';
}

interface AsterismContextType {
  project: Project;
  allProjects: Project[];
  activeChapterId: string;
  activeChapter: Chapter | undefined;
  userStats: UserStats;
  sidebarTab: SidebarTab;
  isSidebarOpen: boolean;
  viewMode: AppViewMode;
  toasts: Toast[];
  cosmeticShop: CosmeticItem[];

  // navigation & view actions
  setActiveChapterId: (id: string) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  // a foundations card to show when the cards tab opens (from a suggestion), and the character it is about
  focusedCard: { cardId: string; characterId?: string } | null;
  openFoundationCard: (cardId: string, characterId?: string) => void;
  clearFocusedCard: () => void;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setViewMode: (mode: AppViewMode) => void;
  goToTool: (tab: SidebarTab, standalone?: boolean) => void;
  // mind maps and branching stories: the document the open tool edits, and the manuscript it is attached to
  toolDoc: Project;
  toolParent: Project | null;
  // true when the tool was opened from inside a manuscript, so back returns to it
  toolFromDoc: boolean;
  openTool: (kind: ToolKind, docId?: string) => void;
  createToolDoc: (kind: ToolKind, folder?: string) => void;
  updateToolDoc: (meta: Partial<Project>) => void;
  attachTool: (toolId: string, manuscriptId: string | null) => void;
  leaveTool: () => void;
  editorScrollMode: EditorScrollMode;
  setEditorScrollMode: (mode: EditorScrollMode) => void;
  editorReviewMode: EditorReviewMode;
  setEditorReviewMode: (mode: EditorReviewMode) => void;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;

  // project library actions
  createNewProject: (title?: string, author?: string, tags?: string[], synopsis?: string, folder?: string, draftMode?: 'chaptered' | 'open_draft', templateId?: string) => void;
  makeAlternateDraft: (projectId: string) => void;
  openProject: (projectId: string) => void;
  deleteExistingProject: (projectId: string) => void;
  // what is being worked on right now, so the screen can say so
  working: string | null;
  trash: TrashedProject[];
  restoreDeleted: (projectId: string) => void;
  deleteForever: (projectId: string) => void;
  updateAnyProject: (projectId: string, updates: Partial<Project>) => void;
  createDocumentFolder: (folderName: string) => void;
  renameDocumentFolder: (oldName: string, newName: string) => void;
  deleteDocumentFolder: (folderName: string) => void;
  moveProjectToFolder: (projectId: string, folderName: string | null) => void;
  updateChapterFolder: (chapterId: string, folderName: string | null) => void;

  // chapter editing & outline structuring
  updateChapterContent: (chapterId: string, content: string) => void;
  createChapter: (title?: string, contentHtml?: string) => void;
  deleteChapter: (chapterId: string) => void;
  // in an open draft: take out or reorder a scene (the stretch between scene breaks)
  removeScene: (index: number) => void;
  moveScene: (index: number, by: -1 | 1) => void;
  updateChapterTitle: (chapterId: string, title: string) => void;
  updateChapterStatus: (chapterId: string, status: 'draft' | 'revised' | 'final') => void;
  splitChapter: (chapterId: string, splitHtmlBefore: string, splitHtmlAfter: string, newTitle?: string) => void;
  insertChapterAt: (targetIndex: number, title?: string) => void;
  mergeChapterWithPrevious: (chapterId: string) => void;
  setDraftMode: (mode: 'chaptered' | 'open_draft') => void;
  // today's challenges and the streak
  quests: QuestState;
  streak: number;
  swapDailyQuest: (index: number) => void;
  buyStreakFreeze: () => void;
  // a small award for using a planning tool (limited per day), and it counts toward challenges
  notePlanning: (reason: string) => void;
  markDraftComplete: (projectId: string) => void;
  // with a chapter id: at the end of that chapter. without: at the caret, or the end if there is none
  insertSceneBreak: (endOfChapterId?: string) => void;

  // live writing together: a short summary for the pills, the full state, and what can be done with a session
  collabSession: { selfName: string; selfRole: 'co_writer' | 'beta_reader'; peers: Array<{ name: string }> } | null;
  // the session of the open document (nothing when it is not in one), and every session this device is in
  live: LiveState;
  liveSessions: LiveState[];
  liveApi: LiveApi;
  isCollabModalOpen: boolean;
  setIsCollabModalOpen: (open: boolean) => void;

  // project details
  updateProjectMeta: (meta: Partial<Project>) => void;
  exportProject: () => Promise<void>;
  exportStandaloneHtml: () => Promise<void>;
  exportDocx: () => Promise<void>;
  sync: SyncApi;
  exportEpub: () => Promise<void>;
  exportActiveChapterMd: () => void;
  exportFullManuscriptMd: () => void;

  // story bible actions
  saveCharacter: (char: CharacterProfile) => void;
  deleteCharacter: (id: string) => void;
  saveSecret: (entry: SecretEntry) => void;
  deleteSecret: (id: string) => void;
  saveLocation: (loc: LocationProfile) => void;
  deleteLocation: (id: string) => void;
  saveLore: (lore: LoreEntry) => void;
  deleteLore: (id: string) => void;

  // foundations cards actions
  saveReflection: (reflection: CardReflection) => void;
  deleteReflection: (id: string) => void;

  // plot threads actions
  // `quiet` skips the "tracked" toast, for the many small edits a thread gets.
  savePlotThread: (thread: PlotThread, options?: { quiet?: boolean }) => void;
  deletePlotThread: (id: string) => void;
  // start a plot thread from an open loop (a finding's or the coach board's loopId).
  trackLoopAsThread: (loopId: string) => void;

  // goals & points actions
  saveGoal: (goal: WritingGoal) => void;
  toggleGoalComplete: (id: string) => void;
  deleteGoal: (id: string) => void;
  // routine: an ordinary writing award; the writer can turn its confetti off
  awardPoints: (amount: number, reason: string, routine?: boolean) => void;
  buyCosmetic: (item: CosmeticItem) => boolean;
  equipCosmetic: (item: CosmeticItem) => void;
  saveCustomLoader: (loader: Partial<LoaderConfig> & { id: string }) => void;
  deleteCustomLoader: (id: string) => void;
  saveCustomSeparator: (sep: Partial<CustomSeparator> & { id: string }) => void;
  deleteCustomSeparator: (id: string) => void;
  saveCustomFlourish: (fl: Partial<CustomFlourish> & { id: string }) => void;
  deleteCustomFlourish: (id: string) => void;
  openShop: () => void;
  closeShop: () => void;
  saveCustomTrail: (t: Partial<TrailConfig> & { id: string }) => void;
  deleteCustomTrail: (id: string) => void;
  saveCustomChime: (c: Partial<ChimeConfig> & { id: string }) => void;
  deleteCustomChime: (id: string) => void;
  saveCustomShape: (s: Partial<ShapeConfig> & { id: string }) => void;
  deleteCustomShape: (id: string) => void;
  saveCustomCover: (c: Partial<CustomCover> & { id: string }) => void;
  deleteCustomCover: (id: string) => void;
  saveCustomCelebration: (c: Partial<CelebrationConfig> & { id: string }) => void;
  deleteCustomCelebration: (id: string) => void;
  setQuietWriting: (quiet: boolean) => void;
  setNoPointNotes: (hide: boolean) => void;
  makeMine: (kind: MadeKind, raw: { id: string; name?: string }) => void;
  removeMine: (kind: MadeKind, id: string) => void;
  importMine: (kind: MadeKind, raw: { id: string; name?: string }) => void;
  // true when there are enough points to make something new; otherwise says so
  canMake: () => boolean;
  previewCelebration: (c: CelebrationConfig) => void;
  savePalette: (p: Palette) => void;
  deletePalette: (id: string) => void;
  // play a chime the way it will sound for the writer
  previewChime: (c: ChimeConfig) => void;
  setChimeFor: (event: ChimeEvent, id: string) => void;
  setChimeVolume: (v: number) => void;
  // a cover for one document, or for all of them when docId is null
  setDocCover: (docId: string | null, coverId: string) => void;
  toggleShowcase: (badgeId: string) => void;
  // paid once per document (or once per story) the first time it is shared as a finished file
  noteExport: (kind: 'manuscript' | 'branching', id: string) => void;

  // comments & annotations
  addComment: (passageText: string, commentText: string, type?: 'comment' | 'suggestion', suggestedText?: string, customId?: string, inChapterId?: string) => string;
  // jump the editor to a quoted passage, and comment on one that was detected.
  jumpTarget: JumpTarget | null;
  // which prompt lab tool to open on (set by the home page cards).
  promptLabTool: string | null;
  setPromptLabTool: (id: string | null) => void;
  jumpToPassage: (chapterId: string, quote: string) => void;
  addCommentAtPassage: (chapterId: string, passage: string, text: string) => void;
  updateSuggestionText: (commentId: string, text: string) => void;
  toggleCommentResolved: (id: string) => void;
  deleteComment: (id: string) => void;
  acceptSuggestion: (commentId: string) => void;
  rejectSuggestion: (commentId: string) => void;

  // story analyzer & learning engine
  runStoryAnalysis: () => void;
  // a scan is running, so screens can show that something is happening
  isScanning: boolean;
  setStatementIgnored: (id: string, ignored: boolean) => void;
  importManuscriptFile: (file: File) => Promise<void>;
  respondToFinding: (findingId: string, status: AnalysisFinding['status'], authorExplanation?: string) => void;
  answerFinding: (findingId: string, verdict: FindingVerdict, options?: AnswerOptions) => void;
  setPreferenceEnabled: (id: string, enabled: boolean) => void;
  deletePreference: (id: string) => void;
  acceptHideSuggestion: (check: string, scope: 'project' | 'global') => void;
  declineSuggestion: (key: string) => void;
  // mark an open loop handled (or bring it back) from the coach; findings about it follow.
  dismissLoop: (loopId: string, handled?: boolean) => void;
  setCoachSettings: (settings: CoachSettings) => void;
  setCoachKnowledge: (knowledge: CoachKnowledge) => void;
  setPageLayout: (page: Partial<PageLayout>) => void;
  setHomeSettings: (home: Partial<HomeSettings>) => void;
  // the first-run tour (see services/tour)
  isTourOpen: boolean;
  setIsTourOpen: (open: boolean) => void;
  setThemeImages: (themeId: string, images: ThemeImages | undefined) => void;
  saveCustomSound: (sound: CustomSound, imported?: boolean) => boolean;
  deleteCustomSound: (id: string) => void;
  uploadSoundFile: (file: File) => Promise<string | null>;
  exportCustomSound: (id: string) => Promise<void>;
  importSoundFile: (file: File) => Promise<boolean>;
  saveSoundscape: (scape: CustomSoundscape, imported?: boolean) => boolean;
  deleteSoundscape: (id: string) => void;
  uploadScapeFile: (file: File) => Promise<string | null>;
  addCustomCursor: (file: File, name: string, size: number, hotspot: Hotspot) => Promise<boolean>;
  deleteCustomCursor: (id: string) => void;
  addEstablishedFact: (fact: EstablishedFact) => void;
  deleteEstablishedFact: (id: string) => void;
  addAuthorStyleRule: (rule: AuthorStyleRule) => void;
  deleteAuthorStyleRule: (id: string) => void;

  // appearance & sensory settings
  setTheme: (theme: ThemeMode) => void;
  // a shop theme (its id without the "theme-") worn only while the writer looks at it, before buying; null stops
  themePreview: string | null;
  previewTheme: (tail: string | null) => void;
  setCursor: (cursor: CursorStyle) => void;
  setLoader: (loader: string) => void;
  setFont: (font: EditorFont) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  toggleIndentParagraphs: () => void;
  toggleTypewriterMode: () => void;
  setAmbientSound: (sound: string) => void;
  setAmbientVolume: (vol: number) => void;
  setKeystrokeSound: (sound: KeystrokeSound) => void;
  setKeystrokeVolume: (vol: number) => void;
  playKeystroke: (key: string, soundOverride?: KeystrokeSound) => void;

  // custom themes, corner roundness & font importer
  setCornerRoundness: (roundness: number) => void;
  saveCustomTheme: (theme: CustomThemeConfig) => boolean;
  deleteCustomTheme: (themeId: string) => void;
  applyCustomTheme: (themeId: string | null) => void;
  importCustomFont: (font: CustomFontConfig, activate?: boolean) => void;
  uploadFontFile: (file: File, family?: string, activate?: boolean) => Promise<string | null>;
  deleteCustomFont: (fontId: string) => void;
  setStoryTheme: (config: { activeTheme?: ThemeMode; customTheme?: CustomThemeConfig; cornerRoundness?: number; activeFont?: string; useStoryTheme: boolean }) => void;

  // Calliope companion & mood
  setCalliopeMood: (mood: CalliopeMood) => void;
  shakeCalliopeJar: () => string;

  // writing sprints
  isSprintModalOpen: boolean;
  setIsSprintModalOpen: (open: boolean) => void;
  sprintPresetPrompt: string | null;
  setSprintPresetPrompt: (prompt: string | null) => void;
  activeSprint: ActiveSprintState | null;
  startSprint: (config: SprintConfig) => void;
  cancelSprint: () => void;
  completeSprint: () => void;

  // badges
  badges: WritingBadge[];
  checkBadgeMilestones: () => void;

  // visual celebrations
  triggerConfetti: () => void;
  showToast: (message: string, type?: 'info' | 'success' | 'reward') => void;

  // document versions & snapshot recovery
  versions: DocumentVersion[];
  isVersionHistoryOpen: boolean;
  setIsVersionHistoryOpen: (open: boolean) => void;
  createManualSnapshot: (title?: string, description?: string) => DocumentVersion;
  restoreVersion: (versionId: string) => void;
  deleteVersionSnapshot: (versionId: string) => void;
  renameVersionSnapshot: (versionId: string, newTitle: string) => void;
  duplicateVersionAsNewProject: (versionId: string, copyTitle?: string) => void;
  lastAutosaveTime: Date | null;
  updateProject: (updates: Partial<Project>) => void;
}

export interface JumpTarget {
  chapterId: string;
  quote: string;
  // a new number each request, so asking for the same passage twice still jumps.
  nonce: number;
}

const AsterismContext = createContext<AsterismContextType | null>(null);

export const AsterismProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const firstOpen = useRef(storageService.isFirstOpen());
  const [isTourOpen, setIsTourOpen] = useState(() => storageService.isFirstOpen() && !tourSeen());
  const [project, setProject] = useState<Project>(() => applyPending(storageService.loadProject()));
  const [allProjects, setAllProjects] = useState<Project[]>(() => storageService.loadProjectsList());
  const [trash, setTrash] = useState<TrashedProject[]>(() => loadTrash());
  const [working, setWorking] = useState<string | null>(null);
  const [themePreview, setThemePreview] = useState<string | null>(null);
  const previewTheme = useCallback((tail: string | null) => setThemePreview(tail), []);
  const [userStats, setUserStats] = useState<UserStats>(() => {
    const loaded = storageService.loadUserStats();
    return {
      ...loaded,
      cornerRoundness: loaded.cornerRoundness ?? 10,
      customThemes: Array.isArray(loaded.customThemes) ? loaded.customThemes : [],
      customFonts: Array.isArray(loaded.customFonts) ? loaded.customFonts : [],
      activeCustomThemeId: loaded.activeCustomThemeId ?? null,
      keystrokeSound: loaded.keystrokeSound || 'typewriter',
      keystrokeVolume: loaded.keystrokeVolume ?? 0.45,
      calliopeMood: loaded.calliopeMood || 'sparkly',
      sprintsCompleted: loaded.sprintsCompleted ?? 0,
      unlockedBadges: Array.isArray(loaded.unlockedBadges) ? loaded.unlockedBadges : [],
      ambientSound: migrateAmbient(typeof loaded.ambientSound === 'string' ? loaded.ambientSound : 'off'),
      coach: normalizeCoachSettings(loaded.coach),
      coachKnowledge: sanitizeKnowledge(loaded.coachKnowledge),
      page: normalizePage(loaded.page),
      customSounds: Array.isArray(loaded.customSounds) ? loaded.customSounds.map(sanitizeCustomSound).filter((s): s is CustomSound => !!s) : [],
      customSoundscapes: Array.isArray(loaded.customSoundscapes) ? loaded.customSoundscapes.map(sanitizeSoundscape).filter((s): s is CustomSoundscape => !!s) : [],
      customCursors: Array.isArray(loaded.customCursors) ? loaded.customCursors.map(sanitizeCursor).filter((c): c is NonNullable<typeof c> => !!c) : [],
      home: {
        showRecent: loaded.home?.showRecent ?? false,
        showTools: loaded.home?.showTools ?? true,
        hiddenCards: Array.isArray(loaded.home?.hiddenCards) ? loaded.home.hiddenCards.filter((x: unknown) => typeof x === 'string') : [],
        hiddenBar: Array.isArray(loaded.home?.hiddenBar) ? loaded.home.hiddenBar.filter((x: unknown) => typeof x === 'string') : []
      }
    };
  });
  const [activeChapterId, setActiveChapterId] = useState<string>(() => {
    return project.chapters.length > 0 ? project.chapters[0].id : '';
  });
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chapters');
  const [focusedCard, setFocusedCard] = useState<{ cardId: string; characterId?: string } | null>(null);
  // a small window starts with the writing, not the sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => typeof window === 'undefined' || window.innerWidth >= 900);
  const [viewMode, setViewMode] = useState<AppViewMode>('home');
  // where the shop was opened from, so closing it goes back there
  const [shopReturn, setShopReturn] = useState<AppViewMode>('home');
  const [toolDocId, setToolDocId] = useState<string | null>(null);
  const [toolFromDoc, setToolFromDoc] = useState(false);
  const [editorScrollMode, setEditorScrollMode] = useState<EditorScrollMode>('infinite');
  const [editorReviewMode, setEditorReviewMode] = useState<EditorReviewMode>('editing');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [jumpTarget, setJumpTarget] = useState<JumpTarget | null>(null);
  const [promptLabTool, setPromptLabTool] = useState<string | null>(null);
  const live = useSession(project.id);
  const liveSessions = useSessions();
  const collabSession = useMemo(() => live.mode === 'none' ? null : {
    selfName: live.who.name,
    selfRole: (live.role === 'reader' ? 'beta_reader' : 'co_writer') as 'co_writer' | 'beta_reader',
    peers: live.people.map(name => ({ name })),
  }, [live.mode, live.who.name, live.role, live.people]);
  // in a live session every comment is lit up on the page, including ones whose mark did not travel with the text
  useEffect(() => {
    setCommentTargets(live.mode === 'none' ? [] : (project.comments ?? []).filter(c => c.type !== 'suggestion' && !c.resolved && c.passageText).map(c => ({ chapterId: c.chapterId, id: c.id, text: c.passageText })));
    return () => setCommentTargets([]);
  }, [live.mode, project.comments]);
  // so the guards on chapter changes read the document that is open now
  const openIdRef = useRef(project.id);
  openIdRef.current = project.id;
  const liveLocked = () => { const m = getSession(openIdRef.current).mode; return m === 'hosting' || m === 'joined'; };
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // version history & recovery state
  const [versions, setVersions] = useState<DocumentVersion[]>(() => storageService.loadProjectVersions(project.id));
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [lastAutosaveTime, setLastAutosaveTime] = useState<Date | null>(new Date());
  const lastSnapshotWordCountRef = useRef<number>(
    project.chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0)
  );
  const lastSnapshotTimeRef = useRef<number>(Date.now());
  const lastStableProjectRef = useRef<Project>(project);

  // sync versions when switching active project
  useEffect(() => {
    setVersions(storageService.loadProjectVersions(project.id));
    lastStableProjectRef.current = project;
    lastSnapshotWordCountRef.current = project.chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0);
  }, [project.id]);

  // sprints state
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [sprintPresetPrompt, setSprintPresetPrompt] = useState<string | null>(null);
  const [activeSprint, setActiveSprint] = useState<ActiveSprintState | null>(null);

  // badges state
  const [badges, setBadges] = useState<WritingBadge[]>(() => {
    const unlocked = userStats.unlockedBadges || [];
    return DEFAULT_WRITING_BADGES.map(b => ({
      ...b,
      unlocked: unlocked.includes(b.id)
    }));
  });

  const cosmeticShop = useMemo<CosmeticItem[]>(
    () => CATALOG.map(item => ({ ...item, unlocked: isOwned(item, userStats.unlockedCosmetics, userStats.unlockedBadges) })),
    [userStats.unlockedCosmetics, userStats.unlockedBadges]
  );

  // track active chapter
  const activeChapter = useMemo(() => {
    return project.chapters.find(c => c.id === activeChapterId) || project.chapters[0];
  }, [project.chapters, activeChapterId]);

  // apply theme, font, corner roundness, and cursor attributes to root & body
  useEffect(() => {
    const root = document.documentElement;

    // check if story theme override is enabled for current project
    const useStoryTheme = project.useStoryTheme && project.storyTheme;
    // a document with its own theme ignores the global one completely, custom or not
    // a theme being tried in the shop overrides everything until the writer stops
    const previewPreset = themePreview ? findThemePreset(themePreview) : undefined;
    const ownTheme = !themePreview && !!useStoryTheme && !!project.storyTheme?.activeTheme && viewMode !== 'home' && viewMode !== 'shop' && viewMode !== 'social';
    const effectiveThemeMode = themePreview
      ? (previewPreset ? 'custom' : themePreview)
      : ownTheme
        ? project.storyTheme!.activeTheme!
        : userStats.activeTheme;

    const effectiveCustomTheme = themePreview
      ? previewPreset?.theme
      : ownTheme
        ? project.storyTheme!.customTheme
        : (userStats.customThemes || []).find(t => t.id === userStats.activeCustomThemeId);

    const effectiveRoundness = useStoryTheme && project.storyTheme?.cornerRoundness !== undefined
      ? project.storyTheme.cornerRoundness
      : (userStats.cornerRoundness ?? 10);

    const customActive = !!effectiveCustomTheme && (effectiveThemeMode === 'custom' || (!ownTheme && !!userStats.activeCustomThemeId));
    const effectiveFont = useStoryTheme && project.storyTheme?.activeFont
      ? project.storyTheme.activeFont
      : (customActive && effectiveCustomTheme?.fontFamily) || userStats.activeFont;

    // 1. apply corner roundness: 0px = sharp square like Google Docs, up to 24px
    const r = Math.max(0, effectiveRoundness);
    root.style.setProperty('--radius-sm', `${r <= 1 ? 0 : Math.round(r * 0.6)}px`);
    root.style.setProperty('--radius-md', `${r}px`);
    root.style.setProperty('--radius-lg', `${r <= 1 ? 0 : Math.round(r * 1.6)}px`);
    root.style.setProperty('--radius-paper', `${r <= 1 ? 0 : Math.round(r * 1.2)}px`);
    root.style.setProperty('--radius-btn', `${r}px`);

    // 2. apply custom colors if custom theme is active
    if (customActive && effectiveCustomTheme) {
      root.setAttribute('data-theme', 'custom');
      Object.entries(deriveThemeVars(effectiveCustomTheme)).forEach(([name, value]) => root.style.setProperty(name, value));
      root.setAttribute('data-paper', effectiveCustomTheme.paperStyle || 'plain');
      root.toggleAttribute('data-margin', !!effectiveCustomTheme.marginLine);
      root.toggleAttribute('data-handwriting', !!effectiveCustomTheme.handwriting);
    } else {
      // clear inline overrides so preset themes from CSS take effect cleanly
      root.setAttribute('data-theme', effectiveThemeMode);
      DERIVED_VAR_NAMES.forEach(name => root.style.removeProperty(name));
      root.removeAttribute('data-paper');
      root.removeAttribute('data-margin');
      root.removeAttribute('data-handwriting');
    }

    // 3. apply font (uploaded fonts are registered separately; do not ask Google for them)
    if (effectiveFont) {
      const isUploaded = (userStats.customFonts || []).some(f => f.family === effectiveFont && f.source === 'local');
      if (!isUploaded) fontLoader.loadGoogleFont(effectiveFont);
      root.style.setProperty('--font-active', isSystemFont(effectiveFont) ? systemStack(effectiveFont) : `"${effectiveFont}", Lora, Georgia, serif`);
    }

    document.body.setAttribute('data-cursor', userStats.activeCursor);

    // 4. background pictures: from the custom theme itself, or the ones added to a built-in theme
    let cancelImages: () => void = () => undefined;
    if (customActive) {
      cancelImages = applyThemeImages(effectiveCustomTheme);
    } else {
      const added = userStats.themeImages?.[effectiveThemeMode];
      if (hasThemeImages(added)) {
        const computed = getComputedStyle(root);
        cancelImages = applyThemeImages({
          ...added!,
          bgApp: computed.getPropertyValue('--bg-app').trim(),
          bgPaper: computed.getPropertyValue('--bg-paper').trim(),
        });
      } else {
        clearThemeImages(root);
      }
    }
    return cancelImages;
  }, [
    userStats.customFonts,
    userStats.themeImages,
    userStats.activeTheme, 
    userStats.activeCursor, 
    userStats.activeFont, 
    userStats.cornerRoundness, 
    userStats.activeCustomThemeId, 
    userStats.customThemes,
    project.useStoryTheme,
    project.storyTheme,
    themePreview,
    viewMode
  ]);

  // page width and margins, as CSS variables the editor reads.
  useEffect(() => {
    Object.entries(pageVars(normalizePage(userStats.page))).forEach(([name, value]) => document.documentElement.style.setProperty(name, value));
  }, [userStats.page]);

  // tell the audio engine about the writer's own keystroke sounds.
  useEffect(() => {
    ambientAudio.setCustomSounds(userStats.customSounds || []);
  }, [userStats.customSounds]);

  // tell the audio engine about the writer's own soundscapes.
  useEffect(() => {
    ambientAudio.setSoundscapes(userStats.customSoundscapes || []);
  }, [userStats.customSoundscapes]);

  // a cursor the writer uploaded is the page's cursor; built-in ones come from the stylesheet.
  useEffect(() => {
    const preset = findCursorPreset(userStats.activeCursor);
    if (preset && preset.id !== 'default') {
      document.body.style.cursor = presetCursorCss(preset);
      return () => { document.body.style.removeProperty('cursor'); };
    }
    const own = isCursorId(userStats.activeCursor) ? (userStats.customCursors || []).find(c => c.id === userStats.activeCursor) : undefined;
    if (!own) return undefined;
    let live = true;
    getAssetUrl(own.assetId).then(url => { if (live && url) document.body.style.cursor = cursorCss(url, own); }).catch(() => undefined);
    return () => { live = false; document.body.style.removeProperty('cursor'); };
  }, [userStats.activeCursor, userStats.customCursors]);

  // the shape of comment cards and the marks they leave in the text
  useEffect(() => {
    const root = document.documentElement;
    const look = shapeStyle(findShape(userStats.activeShape, userStats.customShapes));
    SHAPE_VARS.forEach(v => root.style.removeProperty(v));
    ['data-cs', 'data-cs-corner', 'data-cs-mark', 'data-cs-bar'].forEach(a => root.removeAttribute(a));
    if (!look) return;
    Object.entries(look.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-cs', '1');
    root.setAttribute('data-cs-corner', look.corner);
    root.setAttribute('data-cs-mark', look.mark);
    root.setAttribute('data-cs-bar', look.bar);
  }, [userStats.activeShape, userStats.customShapes]);

  // the page's texture and margin decoration
  useEffect(() => {
    const root = document.documentElement;
    const tex = findTexture(userStats.activeTexture, userStats.customTextures);
    if (tex.image === 'none') { root.style.removeProperty('--page-texture'); root.style.removeProperty('--page-texture-size'); }
    else { root.style.setProperty('--page-texture', tex.image); root.style.setProperty('--page-texture-size', tex.size ?? 'auto'); }
    EDGE_VARS.forEach(v => root.style.removeProperty(v));
    const mine = (userStats.customEdges ?? []).find(e => e.id === userStats.activeEdge);
    if (mine) {
      const look = edgeLook(mine);
      Object.entries(look.vars).forEach(([k, v]) => root.style.setProperty(k, v));
      root.setAttribute('data-edge', look.attr);
    } else if (userStats.activeEdge && userStats.activeEdge !== 'none') root.setAttribute('data-edge', userStats.activeEdge);
    else root.removeAttribute('data-edge');
  }, [userStats.activeTexture, userStats.activeEdge, userStats.customTextures, userStats.customEdges]);

  // a pairing's heading font replaces the theme's title fonts
  useEffect(() => {
    const root = document.documentElement;
    const heading = userStats.titleFont;
    if (!heading) { root.style.removeProperty('--font-title'); root.style.removeProperty('--font-display'); return; }
    if (!(userStats.customFonts || []).some(f => f.family === heading && f.source === 'local')) fontLoader.loadGoogleFont(heading);
    root.style.setProperty('--font-title', fontStack(heading));
    root.style.setProperty('--font-display', fontStack(heading));
  }, [userStats.titleFont, userStats.customFonts]);

  // the frame around the header and windows
  useEffect(() => {
    const body = document.body;
    SKIN_ATTRS.forEach(a => body.removeAttribute(a));
    body.style.removeProperty('--sk-color');
    const mine = findCustomSkin(userStats.activeSkin, userStats.customSkins);
    if (mine) {
      const look = skinLook(mine);
      body.setAttribute('data-skin', 'x');
      Object.entries(look.attrs).forEach(([k, v]) => body.setAttribute(k, v));
      body.style.setProperty('--sk-color', look.color);
    } else if (userStats.activeSkin && userStats.activeSkin !== 'plain') body.setAttribute('data-skin', userStats.activeSkin);
    else body.removeAttribute('data-skin');
  }, [userStats.activeSkin, userStats.customSkins]);

  // bring uploaded fonts back after a reload.
  useEffect(() => {
    loadStoredFonts(userStats.customFonts || []);
  }, [userStats.customFonts]);

  // once per session, delete stored files nothing refers to (replaced images,
  // deleted themes and fonts).
  useEffect(() => {
    const timer = setTimeout(() => {
      const used = new Set<string>([
        ...themeAssetIds([...(userStats.customThemes || []), ...Object.values(userStats.themeImages || {}), project.storyTheme?.customTheme, ...allProjects.map(p => p.storyTheme?.customTheme)]),
        ...(userStats.customFonts || []).map(f => f.assetId).filter((x): x is string => !!x),
        ...soundAssetIds(userStats.customSounds || []),
        ...scapeAssetIds(userStats.customSoundscapes || []),
        ...(userStats.customCursors || []).map(c => c.assetId),
        ...[project, ...allProjects].map(p => p.book?.coverImage).filter((x): x is string => !!x),
        ...[project, ...allProjects].flatMap(p => coverAssetIds(p.coverDesign)),
      ]);
      pruneAssets(used).catch(() => undefined);
    }, 5000);
    return () => clearTimeout(timer);
    // only on first load: later changes are handled where files are replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autosave active project with debounce & periodic version snapshots
  useEffect(() => {
    const handler = setTimeout(() => {
      storageService.saveProject(project);
      setLastAutosaveTime(new Date());

      // smart periodic auto-snapshot (every 5 mins or 80+ words changed)
      const now = Date.now();
      const currentWords = project.chapters.reduce((sum, ch) => sum + (ch.wordCount || countWordsFromHtml(ch.content)), 0);
      const wordDiff = Math.abs(currentWords - lastSnapshotWordCountRef.current);
      const timeDiff = now - lastSnapshotTimeRef.current;

      if ((timeDiff >= 5 * 60 * 1000 && wordDiff >= 15) || wordDiff >= 80) {
        storageService.createVersionSnapshot(project, undefined, 'periodic');
        setVersions(storageService.loadProjectVersions(project.id));
        lastSnapshotWordCountRef.current = currentWords;
        lastSnapshotTimeRef.current = now;
      }

      // keep stable project reference updated
      if (currentWords > 0) {
        lastStableProjectRef.current = project;
      }
    }, 600);
    return () => clearTimeout(handler);
  }, [project]);

  // sync current project into allProjects library
  useEffect(() => {
    setAllProjects(prev => {
      const exists = prev.some(p => p.id === project.id);
      const updated = exists
        ? prev.map(p => (p.id === project.id ? project : p))
        : [project, ...prev];
      storageService.saveProjectsList(updated);
      return updated;
    });
  }, [project]);

  // save user stats
  useEffect(() => {
    storageService.saveUserStats(userStats);
  }, [userStats]);

  // toast notification helper
  const showToast = useCallback((message: string, type: 'info' | 'success' | 'reward' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  }, []);

  // a brand new install is welcomed once. the points come with the starting stats, this just says so.
  useEffect(() => {
    if (!firstOpen.current) return;
    firstOpen.current = false;
    showToast(`Welcome to Asterism! Here are ${WELCOME_QP} Quill Points to start with.`, 'reward');
  }, [showToast]);

  // visual celebrations
  const triggerConfetti = useCallback(() => {
    const s = userStatsRef.current;
    if (s.activeCelebration === NO_CELEBRATION) return;
    runCelebration(findCelebration(s.activeCelebration, s.customCelebrations));
  }, []);
  const previewCelebration = useCallback((c: CelebrationConfig) => {
    // confetti stays off for people whose system asks for less motion; say so rather than do nothing
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      showToast('Your system asks for reduced motion, so confetti stays off.', 'info');
      return;
    }
    runCelebration(c);
  }, [showToast]);

  // award points
  const awardPoints = useCallback((amount: number, reason: string, routine = false) => {
    setUserStats(prev => ({
      ...prev,
      quillPoints: prev.quillPoints + amount
    }));
    // ordinary writing points can be quiet: a plain note and no confetti
    // quiet is the default: it stays off only if the writer turned it off
    const quiet = routine && userStatsRef.current.quietWriting !== false;
    if (!userStatsRef.current.noPointNotes) showToast(`+${amount} Quill Points: ${reason}`, quiet ? 'info' : 'reward');
    if (!quiet) triggerConfetti();
  }, [showToast, triggerConfetti]);

  // ---- daily challenges, streaks and what finishing pays ----
  const userStatsRef = useRef(userStats);
  userStatsRef.current = userStats;

  // the tune for an event. two close together would clash, so the first one wins
  const lastChimeRef = useRef(0);
  const playChimeFor = useCallback((event: ChimeEvent) => {
    const now = Date.now();
    if (now - lastChimeRef.current < 900) return;
    const s = userStatsRef.current;
    const chime = chimeFor(event, s.activeChimes, s.customChimes);
    if (!chime) return;
    lastChimeRef.current = now;
    ambientAudio.playChime(chime, s.chimeVolume ?? DEFAULT_CHIME_VOLUME);
  }, []);
  const questContext: QuestContext = {
    hasThread: project.plotThreads.some(t => t.status !== 'resolved'),
    hasFinding: (project.findings || []).some(f => f.status === 'unreviewed'),
    hasDraft: project.chapters.some(c => c.status === 'draft'),
  };
  const questContextRef = useRef(questContext);
  questContextRef.current = questContext;

  const commitQuests = useCallback((state: QuestState, qp: number) => {
    userStatsRef.current = { ...userStatsRef.current, quests: state };
    setUserStats(prev => ({ ...prev, quests: state, quillPoints: prev.quillPoints + qp }));
  }, []);

  // set below, once badges exist
  const unlockBadgeRef = useRef<(id: string) => void>(() => undefined);

  const noteQuest = useCallback((event: QuestEvent) => {
    if (event.type === 'words') {
      const r = addSeasonWords(userStatsRef.current.season, event.n);
      userStatsRef.current = { ...userStatsRef.current, season: r.state };
      setUserStats(prev => ({ ...prev, season: r.state }));
      if (r.done) {
        awardPoints(SEASON_REWARD, `${SEASONS[seasonOf()].label} challenge complete`);
        unlockBadgeRef.current(seasonBadge(seasonOf()));
      }
    }
    const r = applyEvent(userStatsRef.current.quests ?? newQuestState(), event, dayKey(), questContextRef.current);
    commitQuests(r.state, r.awards.reduce((n, a) => n + a.qp, 0));
    // a point note can be hidden; a note with no points in it (a badge, a streak) cannot
    r.awards.forEach(a => { if (!a.qp || !userStatsRef.current.noPointNotes) showToast(a.qp ? `+${a.qp} Quill Points: ${a.reason}` : a.reason, 'reward'); });
    if (r.awards.length) { triggerConfetti(); playChimeFor('goal'); }
  }, [commitQuests, showToast, triggerConfetti, playChimeFor, awardPoints]);

  const notePlanning = useCallback((reason: string) => {
    const cur = ensureDay(userStatsRef.current.quests ?? newQuestState(), dayKey(), questContextRef.current);
    const t = takePlanAward(cur);
    commitQuests(t.state, 0);
    if (t.qp) awardPoints(t.qp, reason);
    noteQuest({ type: 'plan' });
  }, [commitQuests, awardPoints, noteQuest]);

  // words written count toward challenges; a big jump (a paste or an import) does not
  const wordsSeenRef = useRef<{ id: string; n: number } | null>(null);
  const pendingWordsRef = useRef(0);
  const wordsTimerRef = useRef<number | undefined>(undefined);
  const flushWords = useCallback(() => {
    window.clearTimeout(wordsTimerRef.current);
    const n = pendingWordsRef.current;
    pendingWordsRef.current = 0;
    if (n > 0) noteQuest({ type: 'words', n });
  }, [noteQuest]);
  useEffect(() => {
    const n = project.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
    const seen = wordsSeenRef.current;
    wordsSeenRef.current = { id: project.id, n };
    if (!seen || seen.id !== project.id || n <= seen.n || n - seen.n > 400) return;
    pendingWordsRef.current += n - seen.n;
    window.clearTimeout(wordsTimerRef.current);
    if (pendingWordsRef.current >= 25) flushWords();
    else wordsTimerRef.current = window.setTimeout(flushWords, 2500);
  }, [project.id, project.chapters, flushWords]);
  useEffect(() => () => flushWords(), [flushWords]);

  // what the screen shows: today's challenges, even before anything has happened today
  const quests = useMemo(
    () => ensureDay(userStats.quests ?? newQuestState(), dayKey(), questContext),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userStats.quests, questContext.hasThread, questContext.hasFinding, questContext.hasDraft]
  );
  const streak = liveStreak(quests, dayKey());

  const swapDailyQuest = useCallback((index: number) => {
    const cur = ensureDay(userStatsRef.current.quests ?? newQuestState(), dayKey(), questContextRef.current);
    const next = swapQuest(cur, index, questContextRef.current);
    if (next === cur) { showToast('You can swap one challenge a day.', 'info'); return; }
    commitQuests(next, 0);
  }, [commitQuests, showToast]);

  const buyStreakFreeze = useCallback(() => {
    if (userStatsRef.current.quillPoints < REWARD.freezeCost) { showToast(`A streak freeze costs ${REWARD.freezeCost} Quill Points.`, 'info'); return; }
    const next = buyFreeze(ensureDay(userStatsRef.current.quests ?? newQuestState(), dayKey(), questContextRef.current));
    if (!next) { showToast(`You can hold ${REWARD.freezeMax} freezes.`, 'info'); return; }
    commitQuests(next, -REWARD.freezeCost);
    showToast('Streak freeze saved. It covers a missed day.', 'success');
  }, [commitQuests, showToast]);

  // chapters pay once for being finished or revised, however often the status changes
  const markRewarded = useCallback((key: string) => {
    userStatsRef.current = { ...userStatsRef.current, rewarded: [...(userStatsRef.current.rewarded ?? []), key] };
    setUserStats(prev => ({ ...prev, rewarded: [...(prev.rewarded ?? []), key].slice(-3000) }));
  }, []);

  const noteExport = useCallback((kind: 'manuscript' | 'branching', id: string) => {
    const key = `export:${kind}:${id}`;
    if ((userStatsRef.current.rewarded ?? []).includes(key)) return;
    markRewarded(key);
    awardPoints(kind === 'branching' ? REWARD.branchingFirst : REWARD.exportFirst, kind === 'branching' ? 'Your interactive story is out in the world' : 'Your first export of this book');
  }, [markRewarded, awardPoints]);

  // chapter editing with safety net snapshot protection
  const updateChapterContent = useCallback((chapterId: string, content: string) => {
    setProject(prev => {
      const existing = prev.chapters.find(c => c.id === chapterId);
      const newWords = countWordsFromHtml(content);
      const oldWords = existing?.wordCount ?? (existing ? countWordsFromHtml(existing.content) : 0);

      // safety net check: detect accidental bulk deletion or wipeout
      // if chapter previously had >= 30 words and dropped to <= 5 or lost >= 30 words
      if (oldWords >= 30 && (newWords <= 5 || oldWords - newWords >= 30)) {
        const now = Date.now();
        if (now - lastSnapshotTimeRef.current > 15000 && lastStableProjectRef.current) {
          storageService.createVersionSnapshot(
            lastStableProjectRef.current,
            `Safety Backup before text removal (${existing?.title || 'Chapter'})`,
            'safety_net'
          );
          setVersions(storageService.loadProjectVersions(prev.id));
          lastSnapshotTimeRef.current = now;
          showToast('Safety snapshot saved in Version History before text removal.', 'info');
        }
      }

      const newChapters = prev.chapters.map(c => {
        if (c.id === chapterId) {
          const wordCount = newWords;
          return {
            ...c,
            content,
            wordCount,
            updatedAt: new Date().toISOString()
          };
        }
        return c;
      });
      return { ...prev, chapters: newChapters, updatedAt: new Date().toISOString() };
    });
  }, [showToast]);

  const createChapter = useCallback((title?: string, contentHtml?: string) => {
    if (liveLocked()) { showToast('Chapters cannot be added, moved or removed during a live session.', 'info'); return; }
    const newId = `chap-${Date.now()}`;
    const order = project.chapters.length + 1;
    const newChapter: Chapter = {
      id: newId,
      title: title || `Chapter ${order}: Untitled`,
      order,
      content: contentHtml ?? `<h2>Chapter ${order}</h2><p>Begin writing here...</p>`,
      wordCount: contentHtml ? contentHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 5,
      status: 'draft',
      updatedAt: new Date().toISOString()
    };

    setProject(prev => {
      const newChapters = [...prev.chapters, newChapter];
      return {
        ...prev,
        chapters: newChapters,
        updatedAt: new Date().toISOString()
      };
    });
    setActiveChapterId(newId);
    awardPoints(REWARD.newChapter, 'New Chapter Created');
  }, [project.chapters.length, awardPoints]);

  const deleteChapter = useCallback((chapterId: string) => {
    if (liveLocked()) { showToast('Chapters cannot be added, moved or removed during a live session.', 'info'); return; }
    const target = project.chapters.find(c => c.id === chapterId);
    if (!target) return;
    // whatever goes can come back from version history
    storageService.createVersionSnapshot(project, `Before removing "${target.title}"`, 'safety_net');
    setVersions(storageService.loadProjectVersions(project.id));
    if (project.chapters.length <= 1) {
      // the document always keeps one page to write on, so removing the only chapter empties it
      setProject(prev => ({ ...prev, chapters: prev.chapters.map(c => ({ ...c, content: '<p><br></p>', wordCount: 0, updatedAt: new Date().toISOString() })), updatedAt: new Date().toISOString() }));
      showToast('Emptied the only chapter. The old text is in Version History.', 'info');
      return;
    }
    setProject(prev => {
      const filtered = prev.chapters.filter(c => c.id !== chapterId);
      return { ...prev, chapters: filtered, updatedAt: new Date().toISOString() };
    });
    if (activeChapterId === chapterId) {
      const remaining = project.chapters.filter(c => c.id !== chapterId);
      if (remaining.length > 0) {
        setActiveChapterId(remaining[0].id);
      }
    }
    showToast('Chapter removed. It is saved in Version History.', 'info');
  }, [project, activeChapterId, showToast]);

  const removeScene = useCallback((index: number) => {
    const page = project.chapters[0];
    if (!page) return;
    storageService.createVersionSnapshot(project, 'Before removing a scene', 'safety_net');
    setVersions(storageService.loadProjectVersions(project.id));
    updateChapterContent(page.id, removeSceneHtml(page.content, index));
    showToast('Scene removed. It is saved in Version History.', 'info');
  }, [project, updateChapterContent, showToast]);

  const moveScene = useCallback((index: number, by: -1 | 1) => {
    const page = project.chapters[0];
    if (!page) return;
    updateChapterContent(page.id, moveSceneHtml(page.content, index, by));
  }, [project.chapters, updateChapterContent]);

  const updateChapterTitle = useCallback((chapterId: string, title: string) => {
    setProject(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, title, updatedAt: new Date().toISOString() } : c)
    }));
  }, []);

  const updateChapterStatus = useCallback((chapterId: string, status: 'draft' | 'revised' | 'final') => {
    const chapter = project.chapters.find(c => c.id === chapterId);
    setProject(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, status, updatedAt: new Date().toISOString() } : c)
    }));
    const key = status === 'final' ? `fin:${chapterId}` : status === 'revised' ? `rev:${chapterId}` : '';
    if (!chapter || chapter.status === status || !key || (userStatsRef.current.rewarded ?? []).includes(key)) return;
    markRewarded(key);
    if (status === 'final') {
      awardPoints(chapterFinishReward(chapter.wordCount || 0), `Chapter finished: ${chapter.title}`);
      noteQuest({ type: 'chapter_final' });
    } else {
      awardPoints(REWARD.chapterRevised, `Chapter revised: ${chapter.title}`);
      noteQuest({ type: 'chapter_revised' });
    }
  }, [project.chapters, markRewarded, awardPoints, noteQuest]);

  // split chapter at a specific point into two distinct chapters
  const splitChapter = useCallback((chapterId: string, splitHtmlBefore: string, splitHtmlAfter: string, newTitle?: string) => {
    if (liveLocked()) { showToast('Chapters cannot be added, moved or removed during a live session.', 'info'); return; }
    setProject(prev => {
      const idx = prev.chapters.findIndex(c => c.id === chapterId);
      if (idx === -1) return prev;

      const current = prev.chapters[idx];
      const updatedCurrent: Chapter = {
        ...current,
        content: splitHtmlBefore,
        wordCount: countWordsFromHtml(splitHtmlBefore),
        updatedAt: new Date().toISOString()
      };

      const newChapterId = `chap-${Date.now()}`;
      const newOrder = current.order + 1;
      const createdChapter: Chapter = {
        id: newChapterId,
        title: newTitle || `Chapter ${newOrder}: Continuation`,
        order: newOrder,
        content: splitHtmlAfter || '<p>Continuation...</p>',
        wordCount: countWordsFromHtml(splitHtmlAfter || ''),
        status: 'draft',
        updatedAt: new Date().toISOString()
      };

      const newChapters = [
        ...prev.chapters.slice(0, idx),
        updatedCurrent,
        createdChapter,
        ...prev.chapters.slice(idx + 1).map(c => ({ ...c, order: c.order + 1 }))
      ];
      return { ...prev, chapters: newChapters, updatedAt: new Date().toISOString() };
    });

    awardPoints(20, 'Chapter Separated into Two Scenes');
    showToast('Chapter separated into two consecutive chapters', 'success');
  }, [awardPoints, showToast]);

  // insert a new chapter anywhere in manuscript (e.g. at index 0 for prologue, or between chapters)
  const insertChapterAt = useCallback((targetIndex: number, title?: string) => {
    if (liveLocked()) { showToast('Chapters cannot be added, moved or removed during a live session.', 'info'); return; }
    const newId = `chap-${Date.now()}`;
    const newOrder = targetIndex + 1;

    setProject(prev => {
      const defaultTitle = targetIndex === 0 
        ? (title || 'Prologue: Before the Beginning')
        : (title || `Chapter ${newOrder}: Untitled`);

      const newChapter: Chapter = {
        id: newId,
        title: defaultTitle,
        order: newOrder,
        content: `<h2>${defaultTitle}</h2><p>Begin writing here...</p>`,
        wordCount: 5,
        status: 'draft',
        updatedAt: new Date().toISOString()
      };

      const newChapters = [
        ...prev.chapters.slice(0, targetIndex),
        newChapter,
        ...prev.chapters.slice(targetIndex).map((c, i) => ({ ...c, order: targetIndex + 2 + i }))
      ];
      return { ...prev, chapters: newChapters, updatedAt: new Date().toISOString() };
    });

    setActiveChapterId(newId);
    awardPoints(REWARD.newChapter, 'New Chapter Inserted into Manuscript');
    showToast('New chapter inserted into outline', 'success');
  }, [awardPoints, showToast]);

  // merge chapter with previous chapter
  const mergeChapterWithPrevious = useCallback((chapterId: string) => {
    if (liveLocked()) { showToast('Chapters cannot be added, moved or removed during a live session.', 'info'); return; }
    setProject(prev => {
      const idx = prev.chapters.findIndex(c => c.id === chapterId);
      if (idx <= 0) return prev;

      const prevChapter = prev.chapters[idx - 1];
      const currentChapter = prev.chapters[idx];

      const mergedContent = `${prevChapter.content}<hr/><p><em>[Merged: ${currentChapter.title}]</em></p>${currentChapter.content}`;
      const updatedPrev: Chapter = {
        ...prevChapter,
        content: mergedContent,
        wordCount: countWordsFromHtml(mergedContent),
        updatedAt: new Date().toISOString()
      };

      const newChapters = [
        ...prev.chapters.slice(0, idx - 1),
        updatedPrev,
        ...prev.chapters.slice(idx + 1).map((c, i) => ({ ...c, order: idx + i }))
      ];
      return { ...prev, chapters: newChapters, updatedAt: new Date().toISOString() };
    });

    showToast('Merged chapter with previous chapter', 'info');
  }, [showToast]);

  // open draft vs chaptered mode toggle
  const setDraftMode = useCallback((mode: 'chaptered' | 'open_draft') => {
    setProject(prev => {
      if (prev.draftMode === mode) return prev;

      if (mode === 'open_draft') {
        // consolidate all chapters into one master flowing draft
        if (prev.chapters.length > 1) {
          const combinedHtml = prev.chapters
            .map(c => `<!-- scene-break -->${c.content}`)
            .join('<hr style="border: none; border-top: 1px dashed var(--border-subtle); margin: 32px 0;" /><p style="text-align: center; color: var(--text-muted); font-style: italic; letter-spacing: 0.3em;">* * *</p>');
          
          const masterChapter: Chapter = {
            id: prev.chapters[0].id,
            title: prev.title || 'Continuous Manuscript Draft',
            order: 1,
            content: combinedHtml,
            wordCount: countWordsFromHtml(combinedHtml),
            status: 'draft',
            updatedAt: new Date().toISOString()
          };
          const updated: Project = {
            ...prev,
            draftMode: 'open_draft',
            chapters: [masterChapter],
            updatedAt: new Date().toISOString()
          };
          storageService.saveProject(updated);
          return updated;
        } else {
          const updated: Project = { ...prev, draftMode: 'open_draft' };
          storageService.saveProject(updated);
          return updated;
        }
      } else {
        // switch to chaptered mode
        const updated: Project = { ...prev, draftMode: 'chaptered' };
        storageService.saveProject(updated);
        return updated;
      }
    });

    showToast(
      mode === 'open_draft' 
        ? 'Switched to Open Draft mode: Continuous seamless writing canvas' 
        : 'Switched to Chaptered mode: Discrete chapters and outline',
      'info'
    );
  }, [showToast]);

  useEffect(() => trackCaret(), []);

  const insertSceneBreak = useCallback((endOfChapterId?: string) => {
    const dividerHtml = `${separatorHtml(userStats.activeSeparator, userStats.customSeparators)}<p><br/></p>`;
    // the new editor puts it in itself, at its cursor
    const live = getActiveEditor();
    if (live && !endOfChapterId) {
      insertHtml(live, dividerHtml);
      showToast('Scene break (***) added', 'info');
      return;
    }
    // at the caret if the writer had one in the text, otherwise at the end
    const placed = endOfChapterId ? null : insertDividerAtCaret(dividerHtml);
    const target = (endOfChapterId && project.chapters.find(c => c.id === endOfChapterId)) || activeChapter;
    if (placed) {
      updateChapterContent(placed.chapterId, placed.html);
      showToast('Scene break (***) added', 'info');
    } else if (target) {
      updateChapterContent(target.id, `${target.content}${dividerHtml}`);
      showToast('Scene break (***) added', 'info');
    }
  }, [activeChapter, project.chapters, updateChapterContent, showToast, userStats.activeSeparator, userStats.customSeparators]);

  // project meta
  const updateProjectMeta = useCallback((meta: Partial<Project>) => {
    setProject(prev => {
      const updated = { ...prev, ...meta, updatedAt: new Date().toISOString() };
      storageService.saveProject(updated);
      setAllProjects(all => {
        const updatedList = all.map(p => p.id === updated.id ? updated : p);
        storageService.saveProjectsList(updatedList);
        return updatedList;
      });
      return updated;
    });
  }, []);

  // project library actions
  const createNewProject = useCallback((title?: string, author?: string, tags?: string[], synopsis?: string, folder?: string, draftMode?: 'chaptered' | 'open_draft', templateId?: string) => {
    const newProj = storageService.createNewProject(title, author, tags, synopsis, folder, draftMode, templateId);
    storageService.saveProject(newProj);
    setProject(newProj);
    setActiveChapterId(newProj.chapters[0]?.id || '');
    setAllProjects(prev => {
      const updated = [newProj, ...prev.filter(p => p.id !== newProj.id)];
      storageService.saveProjectsList(updated);
      return updated;
    });
    setViewMode('standard');
    showToast(`Created document: "${newProj.title}"`, 'success');
    awardPoints(REWARD.newDocument, 'Started a new story journey!');
  }, [showToast, awardPoints, setViewMode]);

  // a full copy to try a different version of the story, linked to the original
  const makeAlternateDraft = useCallback((projectId: string) => {
    const source = allProjects.find(p => p.id === projectId);
    if (!source) return;
    const root = source.alternateOf ?? source.id;
    const base = source.title.replace(/ \(draft \d+\)$/, '');
    const taken = allProjects.filter(p => p.alternateOf === root || p.id === root).length;
    const id = `proj-${Date.now()}`;
    const copy: Project = {
      ...JSON.parse(JSON.stringify(source)),
      id,
      title: `${base} (draft ${taken + 1})`,
      alternateOf: root,
      mindMap: { ...source.mindMap, id: `mm-${id}` },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    storageService.saveProject(copy);
    setAllProjects(prev => {
      const updated = [copy, ...prev];
      storageService.saveProjectsList(updated);
      return updated;
    });
    showToast(`Made "${copy.title}". The original is untouched.`, 'success');
  }, [allProjects, showToast]);

  const updateAnyProject = useCallback((projectId: string, updates: Partial<Project>) => {
    setAllProjects(all => {
      const updatedList = all.map(p => {
        if (p.id === projectId) {
          return { ...p, ...updates, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      storageService.saveProjectsList(updatedList);
      return updatedList;
    });
    if (project.id === projectId) {
      setProject(prev => ({ ...prev, ...updates, updatedAt: new Date().toISOString() }));
    }
  }, [project.id]);

  // the writer says the first draft is done: pays once, 1 point per 20 words up to 1,000
  const markDraftComplete = useCallback((projectId: string) => {
    const doc = projectId === project.id ? project : allProjects.find(p => p.id === projectId);
    if (!doc || doc.kind) return;
    if (doc.draftComplete) {
      updateAnyProject(projectId, { draftComplete: false });
      showToast('Draft marked as not finished. Your points stay.', 'info');
      return;
    }
    const qp = doc.draftPaid ? 0 : draftReward(doc.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0));
    if (!doc.draftPaid && qp === 0) { showToast('Write a little more first. A draft pays 1 Quill Point for every 20 words.', 'info'); return; }
    updateAnyProject(projectId, { draftComplete: true, draftPaid: true });
    if (qp > 0) awardPoints(qp, `First draft finished: ${doc.title}`);
    else showToast('Draft marked as finished', 'success');
  }, [project, allProjects, updateAnyProject, awardPoints, showToast]);

  const createDocumentFolder = useCallback((folderName: string) => {
    const clean = folderName.trim();
    if (!clean) return;
    setUserStats(prev => {
      const current = prev.documentFolders || [];
      if (current.includes(clean)) return prev;
      return { ...prev, documentFolders: [...current, clean] };
    });
    showToast(`Created folder "${clean}"`, 'success');
  }, [showToast]);

  const renameDocumentFolder = useCallback((oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    setUserStats(prev => {
      const current = prev.documentFolders || [];
      return {
        ...prev,
        documentFolders: current.map(f => f === oldName ? clean : f)
      };
    });
    setAllProjects(all => {
      const updatedList = all.map(p => {
        if (p.folder === oldName) {
          return { ...p, folder: clean, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      storageService.saveProjectsList(updatedList);
      return updatedList;
    });
    if (project.folder === oldName) {
      setProject(prev => ({ ...prev, folder: clean }));
    }
    showToast(`Renamed folder to "${clean}"`, 'info');
  }, [project.folder, showToast]);

  const deleteDocumentFolder = useCallback((folderName: string) => {
    setUserStats(prev => ({
      ...prev,
      documentFolders: (prev.documentFolders || []).filter(f => f !== folderName)
    }));
    setAllProjects(all => {
      const updatedList = all.map(p => {
        if (p.folder === folderName) {
          return { ...p, folder: undefined, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      storageService.saveProjectsList(updatedList);
      return updatedList;
    });
    if (project.folder === folderName) {
      setProject(prev => ({ ...prev, folder: undefined }));
    }
    showToast(`Deleted folder "${folderName}" (documents preserved in Unfiled)`, 'info');
  }, [project.folder, showToast]);

  const moveProjectToFolder = useCallback((projectId: string, folderName: string | null) => {
    const clean = folderName && folderName.trim() ? folderName.trim() : undefined;
    updateAnyProject(projectId, { folder: clean });
    showToast(clean ? `Moved document to "${clean}"` : 'Moved document to Unfiled', 'info');
  }, [updateAnyProject, showToast]);

  const updateChapterFolder = useCallback((chapterId: string, folderName: string | null) => {
    const clean = folderName && folderName.trim() ? folderName.trim() : undefined;
    setProject(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, folder: clean, updatedAt: new Date().toISOString() } : c)
    }));
  }, []);

  const openProject = useCallback((projectId: string) => {
    const target = allProjects.find(p => p.id === projectId);
    if (target) {
      storageService.saveProject(target);
      setProject(target);
      setActiveChapterId(target.chapters[0]?.id || '');
      showToast(`Switched to manuscript: "${target.title}"`, 'info');
    }
  }, [allProjects, showToast]);

  const deleteExistingProject = useCallback((projectId: string) => {
    const target = allProjects.find(p => p.id === projectId);
    if (!target?.kind && allProjects.filter(p => !p.kind).length <= 1) {
      showToast('You must keep at least one manuscript in your library.', 'info');
      return;
    }
    // what was attached to a deleted manuscript stays, on its own
    const remaining = allProjects.filter(p => p.id !== projectId).map(p => (p.attachedTo === projectId ? { ...p, attachedTo: undefined } : p));
    if (toolDocId === projectId) setToolDocId(null);
    const gone = allProjects.find(p => p.id === projectId);
    let kept = true;
    if (gone) {
      const nextTrash = addToTrash(trash, gone);
      kept = saveTrash(nextTrash);
      if (kept) setTrash(nextTrash);
    }
    setAllProjects(remaining);
    storageService.saveProjectsList(remaining);

    if (project.id === projectId) {
      const nextProj = remaining.find(p => !p.kind) ?? remaining[0];
      setProject(nextProj);
      setActiveChapterId(nextProj.chapters[0]?.id || '');
      storageService.saveProject(nextProj);
    }
    showToast(kept ? 'Moved to Recently deleted. You have 30 days to restore it.' : 'Deleted. There was no room to keep a copy.', 'info');
  }, [allProjects, project.id, toolDocId, trash, showToast]);

  const restoreDeleted = useCallback((projectId: string) => {
    const item = trash.find(t => t.project.id === projectId);
    if (!item) return;
    const list = [item.project, ...allProjects.filter(p => p.id !== projectId)];
    setAllProjects(list);
    storageService.saveProjectsList(list);
    const nextTrash = removeFromTrash(trash, projectId);
    setTrash(nextTrash);
    saveTrash(nextTrash);
    showToast(`Restored "${item.project.title}"`, 'success');
  }, [trash, allProjects, showToast]);

  const deleteForever = useCallback((projectId: string) => {
    const nextTrash = removeFromTrash(trash, projectId);
    setTrash(nextTrash);
    saveTrash(nextTrash);
    // its saved versions go with it
    try { localStorage.removeItem(storageService.getVersionsStorageKey(projectId)); } catch { /* nothing to remove */ }
  }, [trash]);

  // mind maps, stories, characters, scenes and cards are documents of their own. one opened through a
  // manuscript is that manuscript's own; one opened from the library is connected only if attached.
  const toolDoc = useMemo(
    () => (toolDocId ? allProjects.find(p => p.id === toolDocId) ?? project : project),
    [toolDocId, allProjects, project]
  );
  const toolParent = useMemo(() => {
    if (!toolDoc.attachedTo) return null;
    return allProjects.find(p => !p.kind && p.id === toolDoc.attachedTo) ?? null;
  }, [toolDoc, allProjects]);

  const openTool = useCallback((kind: ToolKind, docId?: string) => {
    if (docId) {
      setToolDocId(docId);
      setToolFromDoc(false);
    } else {
      // from inside a manuscript: its attached document, or the map and story it has always had
      setToolDocId(allProjects.find(p => p.kind === kind && p.attachedTo === project.id)?.id ?? null);
      setToolFromDoc(true);
    }
    setViewMode(viewFor(kind));
  }, [project.id, allProjects]);

  const createToolDoc = useCallback((kind: ToolKind, folder?: string) => {
    const doc = storageService.createToolDoc(kind, folder);
    storageService.saveProject(doc);
    setAllProjects(prev => {
      const updated = [doc, ...prev];
      storageService.saveProjectsList(updated);
      return updated;
    });
    setToolDocId(doc.id);
    setToolFromDoc(false);
    setViewMode(viewFor(kind));
    showToast(`Started ${TOOL_NAMES[kind]}`, 'success');
    noteQuest({ type: 'plan' });
  }, [showToast, noteQuest]);

  const updateToolDoc = useCallback((meta: Partial<Project>) => {
    if (toolDoc.id === project.id) updateProjectMeta(meta);
    else updateAnyProject(toolDoc.id, meta);
  }, [toolDoc.id, project.id, updateProjectMeta, updateAnyProject]);

  // attach a tool document to one manuscript (or none). a manuscript has one mind map, story and
  // card deck; characters and scenes can be as many as it likes.
  const attachTool = useCallback((toolId: string, manuscriptId: string | null) => {
    const tool = allProjects.find(p => p.id === toolId);
    if (!tool?.kind) return;
    const single = tool.kind === 'mindmap' || tool.kind === 'branching' || tool.kind === 'cards';
    const updatedList = allProjects.map(p => {
      if (p.id === toolId) return { ...p, attachedTo: manuscriptId ?? undefined, updatedAt: new Date().toISOString() };
      if (single && manuscriptId && p.kind === tool.kind && p.attachedTo === manuscriptId) return { ...p, attachedTo: undefined };
      return p;
    });
    setAllProjects(updatedList);
    storageService.saveProjectsList(updatedList);
  }, [allProjects]);

  const leaveTool = useCallback(() => {
    setViewMode(toolFromDoc ? 'standard' : 'home');
  }, [toolFromDoc]);

  // standalone tool navigation
  const goToTool = useCallback((tab: SidebarTab, standalone: boolean = true) => {
    if (tab === 'mindmap') {
      openTool('mindmap');
    } else if (tab === 'chapters') {
      setViewMode('standard');
      setSidebarTab('chapters');
    } else {
      setSidebarTab(tab);
      if (standalone) {
        setViewMode('tool');
      } else {
        setViewMode('standard');
        setIsSidebarOpen(true);
      }
    }
  }, [openTool]);

  // uploaded fonts and pictures the project uses travel with it when it syncs.
  const fontsRef = useRef<CustomFontConfig[]>([]);
  fontsRef.current = userStats.customFonts || [];
  // the themes and sounds as the sync last left them; kept here so a merge shows at once, before the screen redraws.
  const extrasRef = useRef<Extras>(extrasOf(userStats));
  extrasRef.current = extrasOf(userStats);
  const syncFiles = useMemo(() => localAssets({
    fonts: () => fontsRef.current,
    extras: () => extrasRef.current,
    setExtras: next => {
      extrasRef.current = next;
      setUserStats(prev => ({
        ...prev,
        customThemes: next.themes,
        customSounds: next.sounds,
        themeImages: next.images,
        customSoundscapes: next.scapes,
        customCursors: next.cursors,
        analyzerPreferences: next.prefs,
        extrasStamps: next.stamps,
        ...madeFields(next.made, prev),
        activeChimes: pruneChimes(prev.activeChimes, id => !id.startsWith('custom-') || !!next.made?.chime?.some(c => c.id === id)),
        // a theme or sound deleted on another device must not stay selected here.
        ...(prev.activeCustomThemeId && !next.themes.some(t => t.id === prev.activeCustomThemeId)
          ? { activeCustomThemeId: null, activeTheme: 'parchment' as const } : {}),
        ...(prev.keystrokeSound.startsWith('custom-') && !next.sounds.some(s => s.id === prev.keystrokeSound)
          ? { keystrokeSound: 'typewriter' } : {}),
        ...(prev.ambientSound.startsWith(SCAPE_PREFIX) && !next.scapes.some(s => s.id === prev.ambientSound)
          ? { ambientSound: 'off' } : {}),
        ...(isCursorId(prev.activeCursor) && !next.cursors.some(c => c.id === prev.activeCursor)
          ? { activeCursor: 'default' as const } : {}),
      }));
    },
    addFont: config => setUserStats(prev => ((prev.customFonts || []).some(f => f.family.toLowerCase() === config.family.toLowerCase())
      ? prev
      : { ...prev, customFonts: [...(prev.customFonts || []), config] })),
    // a new object makes the theme effect draw the pictures again.
    imagesChanged: () => setUserStats(prev => ({ ...prev, themeImages: { ...(prev.themeImages || {}) } })),
  }), []);
  // a project from another device goes into the library without being opened
  // a change to a document in the library that is not open (a live session's text arriving while another document is on screen)
  const patchLibraryProject = useCallback((projectId: string, change: (p: Project) => Project) => {
    setAllProjects(all => {
      const next = all.map(p => (p.id === projectId ? change(p) : p));
      storageService.saveProjectsList(next);
      return next;
    });
  }, []);
  const addSyncedProject = useCallback((p: Project) => {
    storageService.saveProject(p);
    setAllProjects(prev => {
      const updated = [p, ...prev.filter(x => x.id !== p.id)];
      storageService.saveProjectsList(updated);
      return updated;
    });
  }, []);
  const libraryRef = useRef<Project[]>(allProjects);
  libraryRef.current = allProjects;
  const findLiveCopy = useCallback((docId: string) => libraryRef.current.find(p => p.liveFrom?.doc === docId), []);
  const liveApi = useLiveSession({ project, setProject, setActiveChapterId, addSyncedProject, patchLibraryProject, findLiveCopy, setViewMode, showToast });
  const sync = useSync(project, setProject, showToast, syncFiles, addSyncedProject, useCallback(() => libraryRef.current, []));

  // export handlers
  const flourish = useMemo(() => { const f = findFlourish(userStats.activeFlourish, userStats.customFlourishes); return { top: f.top, bottom: f.bottom }; }, [userStats.activeFlourish, userStats.customFlourishes]);
  const exportProject = useCallback(async () => {
    const fonts = await collectEmbeddedFonts(project, userStats.customFonts || [], userStats.activeFont);
    storageService.exportProjectAsJson(project, fonts);
    showToast(fonts.length ? `Backup downloaded with ${fonts.length} font${fonts.length === 1 ? '' : 's'} inside` : 'Complete project backup downloaded', 'success');
  }, [project, userStats.customFonts, userStats.activeFont, showToast]);

  // one self-contained web page with the writer's uploaded fonts embedded.
  const exportStandaloneHtml = useCallback(async () => {
    const fonts = await collectEmbeddedFonts(project, userStats.customFonts || [], userStats.activeFont);
    const html = buildStandaloneHtml(project, {
      fonts,
      flourish,
      documentFont: userStats.activeFont,
      fontSize: userStats.fontSize,
      lineHeight: userStats.lineHeight,
      indentParagraphs: userStats.indentParagraphs,
    });
    storageService.downloadTextFile(`${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'manuscript'}.html`, html, 'text/html');
    showToast(fonts.length ? `Exported web page with ${fonts.length} font${fonts.length === 1 ? '' : 's'} embedded` : 'Exported web page', 'success');
    noteExport('manuscript', project.id);
  }, [project, userStats.customFonts, userStats.activeFont, userStats.fontSize, userStats.lineHeight, userStats.indentParagraphs, showToast, noteExport, flourish]);

  // a Word document. Word cannot take a font from us, so it uses the document font only if it is installed there.
  const exportDocx = useCallback(async () => {
    const bytes = buildDocx(prepareManuscript(project), {
      flourish,
      documentFont: userStats.activeFont,
      fontSize: userStats.fontSize,
      lineHeight: userStats.lineHeight,
      indentParagraphs: userStats.indentParagraphs,
    });
    storageService.downloadBytes(`${fileStem(project.title)}.docx`, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    showToast('Exported Word document', 'success');
    noteExport('manuscript', project.id);
  }, [project, userStats.activeFont, userStats.fontSize, userStats.lineHeight, userStats.indentParagraphs, showToast, noteExport, flourish]);

  // an e-book with the writer's uploaded fonts inside it.
  const exportEpub = useCallback(async () => {
    const fonts = await collectEmbeddedFonts(project, userStats.customFonts || [], userStats.activeFont);
    const bytes = buildEpub(prepareManuscript(project), {
      identifier: project.id,
      flourish,
      fonts,
      documentFont: userStats.activeFont,
      lineHeight: userStats.lineHeight,
      indentParagraphs: userStats.indentParagraphs,
    });
    storageService.downloadBytes(`${fileStem(project.title)}.epub`, bytes, 'application/epub+zip');
    showToast(fonts.length ? `Exported e-book with ${fonts.length} font${fonts.length === 1 ? '' : 's'} inside` : 'Exported e-book', 'success');
    noteExport('manuscript', project.id);
  }, [project, userStats.customFonts, userStats.activeFont, userStats.lineHeight, userStats.indentParagraphs, showToast, noteExport, flourish]);

  const exportActiveChapterMd = useCallback(() => {
    if (activeChapter) {
      storageService.exportChapterAsMarkdown(activeChapter, project.title);
      showToast(`Exported "${activeChapter.title}" as Markdown`, 'success');
    }
  }, [activeChapter, project.title, showToast]);

  const exportFullManuscriptMd = useCallback(() => {
    storageService.exportManuscriptAsMarkdown(project);
    showToast('Full manuscript exported as Markdown', 'success');
  }, [project, showToast]);

  // version history handlers
  const createManualSnapshot = useCallback((title?: string, description?: string): DocumentVersion => {
    const snap = storageService.createVersionSnapshot(project, title, 'manual', description);
    const updated = storageService.loadProjectVersions(project.id);
    setVersions(updated);
    showToast(title ? `Version "${title}" saved` : 'Snapshot created in Version History', 'success');
    awardPoints(5, 'Version Snapshot Created');
    return snap;
  }, [project, showToast, awardPoints]);

  const restoreVersion = useCallback((versionId: string) => {
    const targetVer = versions.find(v => v.id === versionId);
    if (!targetVer) {
      showToast('Version not found', 'info');
      return;
    }

    // automatically snapshot current state first so restoring is 100% reversible!
    storageService.createVersionSnapshot(
      project,
      `Backup before restoring "${targetVer.title}"`,
      'milestone'
    );

    // reconstruct chapters from version
    const restoredChapters: Chapter[] = targetVer.chapters.map(c => ({
      id: c.id,
      title: c.title,
      order: c.order,
      content: c.content,
      wordCount: c.wordCount || countWordsFromHtml(c.content),
      status: 'draft',
      updatedAt: new Date().toISOString()
    }));

    setProject(prev => {
      const updatedProj: Project = {
        ...prev,
        chapters: restoredChapters,
        updatedAt: new Date().toISOString()
      };
      storageService.saveProject(updatedProj);
      return updatedProj;
    });

    const refreshedVersions = storageService.loadProjectVersions(project.id);
    setVersions(refreshedVersions);
    setIsVersionHistoryOpen(false);
    showToast(`Restored version from ${new Date(targetVer.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 'success');
    triggerConfetti();
  }, [versions, project, showToast, triggerConfetti]);

  const deleteVersionSnapshot = useCallback((versionId: string) => {
    storageService.deleteVersion(project.id, versionId);
    setVersions(storageService.loadProjectVersions(project.id));
    showToast('Version snapshot removed', 'info');
  }, [project.id, showToast]);

  const renameVersionSnapshot = useCallback((versionId: string, newTitle: string) => {
    storageService.renameVersion(project.id, versionId, newTitle);
    setVersions(storageService.loadProjectVersions(project.id));
    showToast('Version renamed', 'success');
  }, [project.id, showToast]);

  const duplicateVersionAsNewProject = useCallback((versionId: string, copyTitle?: string) => {
    const targetVer = versions.find(v => v.id === versionId);
    if (!targetVer) return;
    const newTitle = copyTitle || `${project.title} (Snapshot from ${new Date(targetVer.createdAt).toLocaleDateString()})`;
    const newProj = storageService.createNewProject(newTitle, project.author, project.tags, project.synopsis, project.folder);
    newProj.chapters = targetVer.chapters.map(c => ({
      ...c,
      status: 'draft',
      updatedAt: new Date().toISOString()
    }));
    storageService.saveProject(newProj);
    setAllProjects(prev => [newProj, ...prev]);
    showToast(`Created new document "${newTitle}"`, 'success');
  }, [versions, project, showToast]);

  // story bible handlers
  const saveCharacter = useCallback((char: CharacterProfile) => {
    setProject(prev => {
      const exists = prev.storyBible.characters.some(c => c.id === char.id);
      const characters = exists
        ? prev.storyBible.characters.map(c => c.id === char.id ? char : c)
        : [...prev.storyBible.characters, char];
      return {
        ...prev,
        storyBible: { ...prev.storyBible, characters }
      };
    });
    showToast(`Saved character: ${char.name}`, 'success');
    notePlanning('Character Dossier Updated');
  }, [showToast, notePlanning]);

  const saveSecret = useCallback((entry: SecretEntry) => {
    setProject(prev => {
      const list = prev.storyBible.secrets ?? [];
      const secrets = list.some(x => x.id === entry.id) ? list.map(x => x.id === entry.id ? entry : x) : [...list, entry];
      return { ...prev, storyBible: { ...prev.storyBible, secrets } };
    });
    showToast('Saved secret', 'success');
  }, [showToast]);

  const deleteSecret = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      storyBible: { ...prev.storyBible, secrets: (prev.storyBible.secrets ?? []).filter(x => x.id !== id) }
    }));
    showToast('Secret removed', 'info');
  }, [showToast]);

  const deleteCharacter = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      storyBible: {
        ...prev.storyBible,
        characters: prev.storyBible.characters.filter(c => c.id !== id)
      }
    }));
    showToast('Character removed from Bible', 'info');
  }, [showToast]);

  const saveLocation = useCallback((loc: LocationProfile) => {
    setProject(prev => {
      const exists = prev.storyBible.locations.some(l => l.id === loc.id);
      const locations = exists
        ? prev.storyBible.locations.map(l => l.id === loc.id ? loc : l)
        : [...prev.storyBible.locations, loc];
      return { ...prev, storyBible: { ...prev.storyBible, locations } };
    });
    showToast(`Saved location: ${loc.name}`, 'success');
  }, [showToast]);

  const deleteLocation = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      storyBible: {
        ...prev.storyBible,
        locations: prev.storyBible.locations.filter(l => l.id !== id)
      }
    }));
    showToast('Location removed', 'info');
  }, [showToast]);

  const saveLore = useCallback((lore: LoreEntry) => {
    setProject(prev => {
      const exists = prev.storyBible.lore.some(l => l.id === lore.id);
      const newLore = exists
        ? prev.storyBible.lore.map(l => l.id === lore.id ? lore : l)
        : [...prev.storyBible.lore, lore];
      return { ...prev, storyBible: { ...prev.storyBible, lore: newLore } };
    });
    showToast(`Saved lore: ${lore.title}`, 'success');
  }, [showToast]);

  const deleteLore = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      storyBible: {
        ...prev.storyBible,
        lore: prev.storyBible.lore.filter(l => l.id !== id)
      }
    }));
    showToast('Lore entry removed', 'info');
  }, [showToast]);

  // foundations cards handlers
  const saveReflection = useCallback((reflection: CardReflection) => {
    setProject(prev => {
      const exists = prev.reflections.some(r => r.id === reflection.id);
      const reflections = exists
        ? prev.reflections.map(r => r.id === reflection.id ? reflection : r)
        : [...prev.reflections, reflection];
      return { ...prev, reflections };
    });
    showToast('Story Foundation reflection saved', 'success');
    notePlanning('Story Foundation Explored');
  }, [showToast, notePlanning]);

  const deleteReflection = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      reflections: prev.reflections.filter(r => r.id !== id)
    }));
    showToast('Reflection removed', 'info');
  }, [showToast]);

  // plot threads handlers
  const savePlotThread = useCallback((thread: PlotThread, options: { quiet?: boolean } = {}) => {
    const wasResolved = project.plotThreads.find(t => t.id === thread.id)?.status === 'resolved';
    // saving also settles or reopens the thread's loop for the analyzer and the coach.
    setProject(prev => saveThread(prev, thread));
    if (!options.quiet) showToast(`Tracked thread: ${thread.title}`, 'success');
    if (thread.status === 'resolved' && !wasResolved) {
      awardPoints(REWARD.thread, 'Plot Mystery Resolved');
      noteQuest({ type: 'thread' });
    }
  }, [project.plotThreads, showToast, awardPoints, noteQuest]);

  const deletePlotThread = useCallback((id: string) => {
    setProject(prev => removeThread(prev, id));
    showToast('Plot thread removed', 'info');
  }, [showToast]);

  // keep linked passages pointing at the right text as the writer edits
  // waits for a pause in typing and saves only when something moved
  useEffect(() => {
    const events = project.timeline ?? [];
    if (!project.plotThreads.length && !events.length) return;
    const timer = window.setTimeout(() => {
      const prepared = prepareChapters(project.chapters);
      const threads = reanchorThreads(project.plotThreads, prepared);
      const timeline = reanchorTimeline(events, prepared);
      if (threads === project.plotThreads && timeline === events) return;
      setProject(prev => ({
        ...prev,
        plotThreads: prev.plotThreads === project.plotThreads ? threads : prev.plotThreads,
        timeline: (prev.timeline ?? []) === events ? timeline : prev.timeline
      }));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [project.chapters, project.plotThreads, project.timeline]);

  // the timeline's checks are analyzer findings. they are rebuilt whenever the timeline changes, so
  // they never lag behind it, and an answer the writer gave carries over.
  useEffect(() => {
    setProject(prev => syncTimelineFindings(prev));
  }, [project.timeline]);

  const trackLoopAsThread = useCallback(async (loopId: string) => {
    // read on the background worker; right after a scan this is already done
    const { coachUnits, index } = await readStory(project);
    const loop = detectOpenLoops(coachUnits, index, {
      knowledge: userStats.coachKnowledge,
      lexicon: getEffectiveLexicon(project.memoryVault)
    }).find(l => l.id === loopId);
    if (!loop) {
      showToast('That passage has changed since the last scan. Scan again and try once more.', 'info');
      return;
    }
    const { created, thread } = trackLoop(project, loop);
    if (created) setProject(prev => trackLoop(prev, loop).project);
    setSidebarTab('threads');
    showToast(created ? `Now tracking: ${thread.title}` : 'You are already tracking that', created ? 'success' : 'info');
  }, [project, userStats.coachKnowledge, userStats.analyzerPreferences, showToast]);

  // goals handlers
  const saveGoal = useCallback((goal: WritingGoal) => {
    setProject(prev => {
      const exists = prev.goals.some(g => g.id === goal.id);
      const goals = exists
        ? prev.goals.map(g => g.id === goal.id ? goal : g)
        : [...prev.goals, goal];
      return { ...prev, goals };
    });
    showToast('Goal updated', 'success');
  }, [showToast]);

  // a goal pays by its size, once, up to a daily limit
  const toggleGoalComplete = useCallback((id: string) => {
    const goal = project.goals.find(g => g.id === id);
    if (!goal) return;
    const willComplete = !goal.completed;
    let paid = false;
    if (willComplete && !goal.rewarded) {
      const cur = ensureDay(userStatsRef.current.quests ?? newQuestState(), dayKey(), questContextRef.current);
      const taken = takeGoalPoints(cur, goalReward(goal.type, goal.target));
      commitQuests(taken.state, 0);
      if (taken.qp > 0) { awardPoints(taken.qp, `Goal Completed: ${goal.title}`); paid = true; }
      else showToast('Goals have paid their limit for today. This one will pay if you finish it tomorrow.', 'info');
    }
    setProject(prev => ({ ...prev, goals: prev.goals.map(g => (g.id === id ? { ...g, completed: willComplete, rewarded: g.rewarded || paid } : g)) }));
  }, [project.goals, commitQuests, awardPoints, showToast]);

  const deleteGoal = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== id)
    }));
    showToast('Goal removed', 'info');
  }, [showToast]);

  // comments & suggestions handlers
  const addComment = useCallback((passageText: string, commentText: string, type: 'comment' | 'suggestion' = 'comment', suggestedText?: string, customId?: string, inChapterId?: string): string => {
    const targetChapterId = inChapterId ?? activeChapterId;
    if (!targetChapterId) return '';
    const authorName = collabSession ? `${collabSession.selfName} (${collabSession.selfRole})` : (type === 'suggestion' ? 'Self-Suggestion' : 'Author Note');
    const commentId = customId || `comm-${Date.now()}`;
    const newComment: DocumentComment = {
      id: commentId,
      chapterId: targetChapterId,
      passageText,
      commentText,
      author: authorName,
      createdAt: new Date().toISOString(),
      resolved: false,
      type,
      suggestedText,
      status: type === 'suggestion' ? 'pending' : undefined
    };
    setProject(prev => {
      // check if comment already exists with this customId to avoid duplication
      const existing = (prev.comments || []).some(c => c.id === commentId);
      const updatedComments = existing
        ? prev.comments.map(c => c.id === commentId ? { ...c, passageText, commentText, suggestedText } : c)
        : [newComment, ...(prev.comments || [])];

      // if this is a comment with passageText, ensure active chapter content wraps it in <mark data-comment-id="...">
      let updatedChapters = prev.chapters;
      if (type === 'comment' && passageText && passageText.trim()) {
        const cleanPassage = passageText.trim();
        updatedChapters = prev.chapters.map(chap => {
          if (chap.id === targetChapterId) {
            if (!chap.content.includes(`data-comment-id="${commentId}"`)) {
              const escaped = cleanPassage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(escaped);
              if (regex.test(chap.content)) {
                return {
                  ...chap,
                  content: chap.content.replace(regex, `<mark class="asterism-comment-highlight active-comment" data-comment-id="${commentId}">${cleanPassage}</mark>`)
                };
              }
            }
          }
          return chap;
        });
      }

      return {
        ...prev,
        comments: updatedComments,
        chapters: updatedChapters
      };
    });
    setActiveCommentId(commentId);

    if (!customId) {
      showToast(type === 'suggestion' ? 'Revision suggestion added' : 'Comment note attached to passage', 'success');
      awardPoints(5, type === 'suggestion' ? 'Revision Suggestion Added' : 'Manuscript Comment Added');
    }
    return commentId;
  }, [activeChapterId, showToast, awardPoints, collabSession]);

  // open the chapter and ask the editor to find and show the quoted passage.
  const jumpToPassage = useCallback((chapterId: string, quote: string) => {
    setViewMode('standard');
    if (chapterId) setActiveChapterId(chapterId);
    setJumpTarget({ chapterId, quote, nonce: Date.now() });
  }, []);

  // turn a detected passage into a comment on that passage, then show it.
  const addCommentAtPassage = useCallback((chapterId: string, passage: string, text: string) => {
    const quote = passage.replace(/…$|\.\.\.$/, '').trim();
    addComment(quote, text, 'comment', undefined, undefined, chapterId);
    setViewMode('standard');
    if (chapterId) setActiveChapterId(chapterId);
  }, [addComment]);

  const updateSuggestionText = useCallback((commentId: string, text: string) => {
    setProject(prev => ({
      ...prev,
      comments: (prev.comments || []).map(c => 
        c.id === commentId 
          ? { ...c, suggestedText: text, commentText: c.passageText ? `Replace "${c.passageText}" with "${text}"` : `Insert: "${text}"` } 
          : c
      )
    }));
  }, []);

  const toggleCommentResolved = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      comments: (prev.comments || []).map(c => c.id === id ? { ...c, resolved: !c.resolved } : c)
    }));
  }, []);

  const deleteComment = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      comments: (prev.comments || []).filter(c => c.id !== id)
    }));
    setActiveCommentId(prev => prev === id ? null : prev);
    showToast('Comment deleted', 'info');
  }, [showToast]);

  const acceptSuggestion = useCallback((commentId: string) => {
    setProject(prev => {
      const comment = (prev.comments || []).find(c => c.id === commentId);
      if (!comment) return prev;

      let updatedChapters = prev.chapters.map(chap => {
        if (chap.id === comment.chapterId) {
          let content = chap.content || '';
          const escapedId = commentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // case 1: check if there is an <ins> tag for this suggestion in content
          const insRegex = new RegExp(`<ins[^>]*data-(?:suggestion|comment)-id=["']?${escapedId}["']?[^>]*>([\\s\\S]*?)<\\/ins>`, 'gi');
          const hasIns = insRegex.test(content);

          // case 2: check if there is a <del> tag for this suggestion in content
          const delRegex = new RegExp(`<del[^>]*data-(?:suggestion|comment)-id=["']?${escapedId}["']?[^>]*>[\\s\\S]*?<\\/del>`, 'gi');
          const hasDel = delRegex.test(content);

          if (hasIns && hasDel) {
            // replacement: delete <del> and unwrap <ins> into text
            content = content.replace(delRegex, '');
            content = content.replace(insRegex, '$1');
          } else if (hasIns) {
            // pure insertion: unwrap <ins> into text
            content = content.replace(insRegex, '$1');
          } else if (hasDel) {
            // deletion or replacement without <ins>:
            if (comment.suggestedText) {
              // replace <del> with suggestedText!
              content = content.replace(delRegex, comment.suggestedText);
            } else {
              // pure deletion: remove <del>
              content = content.replace(delRegex, '');
            }
          } else if (content.includes(`data-comment-id="${commentId}"`)) {
            // mark tag
            const markRegex = new RegExp(`<mark[^>]*data-comment-id=["']?${escapedId}["']?[^>]*>[\\s\\S]*?<\\/mark>`, 'gi');
            content = content.replace(markRegex, comment.suggestedText || '');
          } else if (comment.passageText && comment.suggestedText && content.includes(comment.passageText)) {
            // plain text replacement if passage exists
            const escapedPassage = comment.passageText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            content = content.replace(new RegExp(escapedPassage), comment.suggestedText);
          } else if (comment.suggestedText) {
            // insertion fallback if no tags existed: append suggested text cleanly
            if (content.endsWith('</p>')) {
              content = content.slice(0, -4) + ' ' + comment.suggestedText + '</p>';
            } else {
              content = content + '<p>' + comment.suggestedText + '</p>';
            }
          }

          return {
            ...chap,
            content,
            wordCount: countWordsFromHtml(content)
          };
        }
        return chap;
      });

      const updated = {
        ...prev,
        chapters: updatedChapters,
        comments: (prev.comments || []).map(c => c.id === commentId ? { ...c, resolved: true, status: 'accepted' as const } : c)
      };
      storageService.saveProject(updated);
      return updated;
    });
    showToast('Suggestion accepted & merged into manuscript', 'success');
    awardPoints(10, 'Applied Revision Suggestion');
  }, [showToast, awardPoints]);

  const rejectSuggestion = useCallback((commentId: string) => {
    setProject(prev => {
      const comment = (prev.comments || []).find(c => c.id === commentId);
      if (!comment) return prev;

      let updatedChapters = prev.chapters.map(chap => {
        if (chap.id === comment.chapterId) {
          let content = chap.content || '';
          const escapedId = commentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // rejecting a suggestion:
          // - the <ins> was proposed for insertion -> reject means completely remove the <ins> and its text!
          const insRegex = new RegExp(`<ins[^>]*data-(?:suggestion|comment)-id=["']?${escapedId}["']?[^>]*>[\\s\\S]*?<\\/ins>`, 'gi');
          content = content.replace(insRegex, '');

          // - the <del> was proposed for deletion -> reject means unwrap and keep the original text!
          const delRegex = new RegExp(`<del[^>]*data-(?:suggestion|comment)-id=["']?${escapedId}["']?[^>]*>([\\s\\S]*?)<\\/del>`, 'gi');
          content = content.replace(delRegex, '$1');

          // - legacy mark tags
          if (content.includes(`data-comment-id="${commentId}"`)) {
            const markRegex = new RegExp(`<mark[^>]*data-comment-id=["']?${escapedId}["']?[^>]*>([\\s\\S]*?)<\\/mark>`, 'gi');
            content = content.replace(markRegex, '$1');
          }

          return {
            ...chap,
            content,
            wordCount: countWordsFromHtml(content)
          };
        }
        return chap;
      });

      const updated = {
        ...prev,
        chapters: updatedChapters,
        comments: (prev.comments || []).map(c => c.id === commentId ? { ...c, resolved: true, status: 'rejected' as const } : c)
      };
      storageService.saveProject(updated);
      return updated;
    });
    showToast('Suggestion rejected', 'info');
  }, [showToast]);

  // story analyzer & learning
  const [scansRunning, setScansRunning] = useState(0);
  const isScanning = scansRunning > 0;

  // read the story away from the page and fold what it found into the open project
  // the page stays usable meanwhile: the loading animation moves and typing keeps up
  const scanInto = useCallback(async (target: Project, writerPreferences = userStats.analyzerPreferences) => {
    setScansRunning(n => n + 1);
    try {
      const result = await scanStory(target, { knowledge: userStats.coachKnowledge, writerPreferences });
      // the worker has the reading now; bring a copy to the page so the coach and the rest open at once
      readStory(target).catch(() => undefined);
      setProject(prev => {
        const updated: Project = {
          ...prev,
          findings: result.findings,
          memoryVault: {
            ...prev.memoryVault,
            establishedFacts: result.establishedFacts,
            authorStyleRules: result.authorStyleRules,
            readFacts: result.readFacts,
            readPlaces: result.readPlaces,
            readKnowledge: result.readKnowledge
          }
        };
        storageService.saveProject(updated);
        return updated;
      });
      return result;
    } finally {
      setScansRunning(n => n - 1);
    }
  }, [userStats.coachKnowledge, userStats.analyzerPreferences]);

  // a scan is paid for once per state of the manuscript: running it again on the same text is free, and cannot be spammed for points
  const scanLockRef = useRef(false);
  const lastPaidScanRef = useRef<string>('');
  const manuscriptSignature = (p: Project) => p.chapters.map(c => `${c.id}:${(c.content || '').length}:${c.content || ''}`).join('');

  const runStoryAnalysis = useCallback(() => {
    // the ref closes the gap before state catches up, so a double click cannot start two scans
    if (scanLockRef.current || scansRunning > 0) return;
    scanLockRef.current = true;
    // in a live session the shared text is the truth; the project's own copy can lag behind what others are typing
    let target = project;
    const shared = getSession(project.id);
    if (shared.doc && (shared.mode === 'hosting' || shared.mode === 'joined')) {
      try {
        const texts = new Map(sessionShared(shared.doc).chapters.map(c => [c.id, c.content]));
        target = { ...project, chapters: project.chapters.map(c => (texts.has(c.id) ? { ...c, content: texts.get(c.id)! } : c)) };
      } catch { target = project; }
    }
    const signature = manuscriptSignature(target);
    scanInto(target).then(result => {
      const contradictions = result.findings.filter(f => f.category === 'contradiction').length;
      const droppedThreads = result.findings.filter(f => f.category === 'dropped_thread').length;
      const changed = signature !== lastPaidScanRef.current;
      showToast(
        contradictions > 0 || droppedThreads > 0
          ? `Story Analysis complete: ${contradictions} contradictions & ${droppedThreads} dropped setups flagged!`
          : `Story Analysis complete: ${result.findings.length} narrative insights discovered.`,
        'success'
      );
      if (changed) {
        lastPaidScanRef.current = signature;
        awardPoints(15, 'Story Continuity Scan Performed');
      }
    }, () => showToast('The scan could not finish. Please try again.', 'info')).finally(() => { scanLockRef.current = false; });
  }, [project, scansRunning, scanInto, showToast, awardPoints]);

  // set aside (or bring back) one thing the scan read, then scan again so the findings follow.
  const setStatementIgnored = useCallback((id: string, ignored: boolean) => {
    const current = project.memoryVault.ignoredStatements ?? [];
    const ignoredStatements = ignored ? [...current.filter(x => x !== id), id] : current.filter(x => x !== id);
    const next: Project = { ...project, memoryVault: { ...project.memoryVault, ignoredStatements } };
    setProject(next);
    storageService.saveProject(next);
    scanInto(next).catch(() => showToast('The scan could not finish. Please try again.', 'info'));
    showToast(ignored ? 'Set aside. The checks no longer use it.' : 'Brought back into the checks.', 'info');
  }, [project, scanInto, showToast]);

  // shows a loader around slow work; waits a moment so it is painted before the page gets busy
  const doWork = useCallback(async <T,>(label: string, run: () => Promise<T> | T): Promise<T> => {
    setWorking(label);
    await new Promise(resolve => setTimeout(resolve, 40));
    try { return await run(); } finally { setWorking(null); }
  }, []);

  const importManuscriptFile = useCallback(async (file: File) => {
    try {
      const imported = await readManuscriptFile(file);
      if (imported.projectBackup) {
        // fonts that came inside the backup are installed first, so the text renders right away.
        if (imported.embeddedFonts?.length) {
          const restored = await restoreEmbeddedFonts(imported.embeddedFonts, (userStats.customFonts || []).map(f => f.family), registerFontBlob);
          if (restored.length) setUserStats(prev => ({ ...prev, customFonts: [...(prev.customFonts || []), ...restored] }));
        }
        const restored: Project = withGenreAsTag(imported.projectBackup.draftMode || imported.projectBackup.chapters.length !== 1 ? imported.projectBackup : { ...imported.projectBackup, draftMode: 'open_draft' });
        restored.branching = sanitizeStory(imported.projectBackup.branching) ?? undefined;
        setProject(restored);
        storageService.saveProject(restored);
        if (imported.projectBackup.chapters?.length > 0) {
          setActiveChapterId(imported.projectBackup.chapters[0].id);
        }
        showToast(`Restored document "${imported.projectBackup.title}" from backup`, 'success');
        
        // run analysis on imported project
        scanInto(imported.projectBackup).catch(() => undefined);
        return;
      }

      const detectedDraftMode = imported.draftMode || (imported.chapters.length === 1 ? 'open_draft' : (project.draftMode || 'chaptered'));
      const updatedProj: Project = {
        ...project,
        title: imported.title || project.title,
        chapters: imported.chapters,
        draftMode: detectedDraftMode,
        updatedAt: new Date().toISOString()
      };
      storageService.saveProject(updatedProj);
      setProject(updatedProj);

      if (imported.chapters.length > 0) {
        setActiveChapterId(imported.chapters[0].id);
      }

      // read it away from the page right away, so insights are there when the writer looks
      scanInto(updatedProj).then(() => showToast(
        `Manuscript "${imported.title}" imported (${imported.chapters.length} chapters). Story Analysis complete!`,
        'success'
      ), () => showToast(`Manuscript "${imported.title}" imported.`, 'success'));

      awardPoints(25, 'Manuscript Imported & Analyzed');
    } catch (err) {
      console.error('Failed to import manuscript file', err);
      showToast('Could not parse manuscript file. Please verify format (.txt, .md, .json)', 'info');
    }
  }, [showToast, awardPoints, userStats.customFonts, project, scanInto]);

  // a new item costs MAKE_COST (palettes are a tool, not a cosmetic); editing is free
  const canMake = useCallback((): boolean => {
    const have = userStatsRef.current.quillPoints;
    if (have >= MAKE_COST) return true;
    showToast(`Making your own costs ${MAKE_COST} Quill Points. You need ${MAKE_COST - have} more.`, 'info');
    return false;
  }, [showToast]);

  // pay for a new thing, or say why not. the ref is updated at once so two quick saves cannot spend the same points.
  const payToMake = useCallback((): boolean => {
    if (!canMake()) return false;
    userStatsRef.current = { ...userStatsRef.current, quillPoints: userStatsRef.current.quillPoints - MAKE_COST };
    setUserStats(prev => ({ ...prev, quillPoints: prev.quillPoints - MAKE_COST }));
    return true;
  }, [canMake]);

  // ---- the writer's own keystroke sounds ----
  // imported sounds were made elsewhere, so they are free
  const saveCustomSound = useCallback((sound: CustomSound, imported = false): boolean => {
    const clean = sanitizeCustomSound(sound);
    if (!clean) return false;
    const exists = (userStats.customSounds || []).some(s => s.id === clean.id);
    if (!exists && (userStats.customSounds || []).length >= MAX_CUSTOM_SOUNDS) {
      showToast(`You can keep up to ${MAX_CUSTOM_SOUNDS} custom sounds. Delete one to add another.`, 'info');
      return false;
    }
    if (!exists && !imported && !payToMake()) return false;
    setUserStats(prev => {
      const list = prev.customSounds || [];
      return { ...prev, customSounds: exists ? list.map(s => (s.id === clean.id ? clean : s)) : [...list, clean], extrasStamps: stamped(prev.extrasStamps, soundKey(clean.id)) };
    });
    return true;
  }, [userStats.customSounds, showToast, payToMake]);

  const deleteCustomSound = useCallback((id: string) => {
    setUserStats(prev => ({
      ...prev,
      customSounds: (prev.customSounds || []).filter(s => s.id !== id),
      keystrokeSound: prev.keystrokeSound === id ? 'typewriter' : prev.keystrokeSound,
      extrasStamps: stamped(prev.extrasStamps, soundKey(id), true),
    }));
  }, []);

  // store a recording for use in a sound. returns its id, or null with a message.
  const uploadSoundFile = useCallback(async (file: File): Promise<string | null> => {
    const problem = validateAudioFile(file);
    if (problem) { showToast(problem, 'info'); return null; }
    try {
      const seconds = await ambientAudio.audioDuration(file);
      if (seconds > MAX_AUDIO_SECONDS) {
        showToast(`That recording is ${seconds.toFixed(1)}s. Keep it under ${MAX_AUDIO_SECONDS}s: one key press.`, 'info');
        return null;
      }
      return await putAsset(file, newAssetId('snd'));
    } catch {
      showToast('Could not read that audio file.', 'info');
      return null;
    }
  }, [showToast]);

  // a sound as a shareable file. recordings travel inside it.
  const exportCustomSound = useCallback(async (id: string) => {
    const sound = (userStats.customSounds || []).find(s => s.id === id);
    if (!sound) return;
    const audio: NonNullable<SoundFile['audio']> = {};
    for (const assetId of soundAssetIds([sound])) {
      const blob = await getAsset(assetId);
      if (blob) audio[assetId] = { type: blob.type || 'audio/wav', data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) };
    }
    const file: SoundFile = { asterismSound: 1, sound, audio };
    storageService.downloadTextFile(`${sound.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'sound'}.asterismsound.json`, JSON.stringify(file, null, 2), 'application/json');
  }, [userStats.customSounds]);

  const importSoundFile = useCallback(async (file: File): Promise<boolean> => {
    const parsed = parseSoundFile(await file.text());
    if (!parsed) { showToast('That is not an Asterism sound file.', 'info'); return false; }
    const sound: CustomSound = { ...parsed.sound, id: newSoundId() };
    if (sound.type === 'sample' && sound.sample) {
      // re-store the recordings under new ids and point the sound at them.
      const remap = new Map<string, string>();
      for (const [oldId, a] of Object.entries(parsed.audio || {})) {
        const bytes = base64ToBytes(a.data);
        if (bytes.length > 2 * 1024 * 1024) continue;
        remap.set(oldId, await putAsset(new Blob([bytes as BlobPart], { type: a.type }), newAssetId('snd')));
      }
      const s = sound.sample;
      sound.sample = { ...s, letter: s.letter && remap.get(s.letter), space: s.space && remap.get(s.space), enter: s.enter && remap.get(s.enter), backspace: s.backspace && remap.get(s.backspace) };
    }
    const ok = saveCustomSound(sound, true);
    if (ok) showToast(`Added "${sound.name}"`, 'success');
    return ok;
  }, [saveCustomSound, showToast]);

  // ---- the writer's own soundscapes and cursors ----
  const saveSoundscape = useCallback((scape: CustomSoundscape, imported = false): boolean => {
    const clean = sanitizeSoundscape(scape);
    if (!clean) return false;
    const problem = scapeProblem(clean);
    if (problem) { showToast(problem, 'info'); return false; }
    const list = userStats.customSoundscapes || [];
    const exists = list.some(s => s.id === clean.id);
    if (!exists && list.length >= MAX_SCAPES) {
      showToast(`You can keep up to ${MAX_SCAPES} soundscapes. Delete one to add another.`, 'info');
      return false;
    }
    if (!exists && !imported && !payToMake()) return false;
    setUserStats(prev => {
      const mine = prev.customSoundscapes || [];
      const next = mine.some(s => s.id === clean.id) ? mine.map(s => (s.id === clean.id ? clean : s)) : [...mine, clean];
      return { ...prev, customSoundscapes: next, extrasStamps: stampChanges(prev.extrasStamps, scapeKey, mine, next) };
    });
    if (userStats.ambientSound === clean.id) {
      // it is playing: hear the change.
      ambientAudio.setSoundscapes([...list.filter(s => s.id !== clean.id), clean]);
      ambientAudio.play(clean.id);
    }
    return true;
  }, [userStats.customSoundscapes, userStats.ambientSound, showToast, payToMake]);

  const deleteSoundscape = useCallback((id: string) => {
    if (userStats.ambientSound === id) ambientAudio.stop();
    setUserStats(prev => {
      const mine = prev.customSoundscapes || [];
      const next = mine.filter(s => s.id !== id);
      return { ...prev, customSoundscapes: next, ambientSound: prev.ambientSound === id ? 'off' : prev.ambientSound, extrasStamps: stampChanges(prev.extrasStamps, scapeKey, mine, next) };
    });
  }, [userStats.ambientSound]);

  // store a recording for use in a soundscape. returns its id, or null with a message.
  const uploadScapeFile = useCallback(async (file: File): Promise<string | null> => {
    const problem = validateScapeFile(file);
    if (problem) { showToast(problem, 'info'); return null; }
    try {
      const long = tooLong(await ambientAudio.audioDuration(file));
      if (long) { showToast(long, 'info'); return null; }
      return await putAsset(file, newAssetId('scp'));
    } catch {
      showToast('Could not read that audio file.', 'info');
      return null;
    }
  }, [showToast]);

  const addCustomCursor = useCallback(async (file: File, name: string, size: number, hotspot: Hotspot): Promise<boolean> => {
    if ((userStats.customCursors || []).length >= MAX_CURSORS) {
      showToast(`You can keep up to ${MAX_CURSORS} cursors. Delete one to add another.`, 'info');
      return false;
    }
    if (!canMake()) return false;
    try {
      const { blob, width, height } = await makeCursorImage(file, size);
      const assetId = await putAsset(blob, newAssetId('cur'));
      const point = hotspotAt(hotspot, width, height);
      const cursor = sanitizeCursor({ name, assetId, width, height, hotX: point.x, hotY: point.y });
      if (!cursor) return false;
      if (!payToMake()) return false;
      setUserStats(prev => {
        const mine = prev.customCursors || [];
        const next = [...mine, cursor];
        return { ...prev, customCursors: next, activeCursor: cursor.id, extrasStamps: stampChanges(prev.extrasStamps, cursorKey, mine, next) };
      });
      showToast(`Added "${cursor.name}"`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not use that picture.', 'info');
      return false;
    }
  }, [userStats.customCursors, showToast, canMake, payToMake]);

  const deleteCustomCursor = useCallback((id: string) => {
    const gone = (userStats.customCursors || []).find(c => c.id === id);
    setUserStats(prev => {
      const mine = prev.customCursors || [];
      const next = mine.filter(c => c.id !== id);
      return { ...prev, customCursors: next, activeCursor: prev.activeCursor === id ? 'default' : prev.activeCursor, extrasStamps: stampChanges(prev.extrasStamps, cursorKey, mine, next) };
    });
    if (gone) deleteAsset(gone.assetId).catch(() => undefined);
  }, [userStats.customCursors]);

  const setThemeImages = useCallback((themeId: string, images: ThemeImages | undefined) => {
    setUserStats(prev => {
      const next = { ...(prev.themeImages || {}) };
      if (hasThemeImages(images)) next[themeId] = images!;
      else delete next[themeId];
      return { ...prev, themeImages: next, extrasStamps: stamped(prev.extrasStamps, imagesKey(themeId), !next[themeId]) };
    });
  }, []);

  const setHomeSettings = useCallback((home: Partial<HomeSettings>) => {
    setUserStats(prev => ({ ...prev, home: { showRecent: false, showTools: true, ...prev.home, ...home } }));
  }, []);

  const setPageLayout = useCallback((patch: Partial<PageLayout>) => {
    setUserStats(prev => ({ ...prev, page: normalizePage({ ...normalizePage(prev.page), ...patch }) }));
  }, []);

  const setCoachKnowledge = useCallback((coachKnowledge: CoachKnowledge) => {
    setUserStats(prev => ({ ...prev, coachKnowledge: sanitizeKnowledge(coachKnowledge) }));
  }, []);

  const setCoachSettings = useCallback((coach: CoachSettings) => {
    setUserStats(prev => ({ ...prev, coach }));
  }, []);

  const openFoundationCard = useCallback((cardId: string, characterId?: string) => {
    setFocusedCard({ cardId, characterId });
    setSidebarTab('foundations');
  }, []);
  const clearFocusedCard = useCallback(() => setFocusedCard(null), []);

  const respondToFinding = useCallback((findingId: string, status: AnalysisFinding['status'], authorExplanation?: string) => {
    setProject(prev => {
      const finding = (prev.findings || []).find(f => f.id === findingId);

      if (status !== 'unreviewed' && finding?.status === 'unreviewed') noteQuest({ type: 'finding' });
      if (status === 'confirmed') {
        awardPoints(15, 'Story Fact Confirmed with Analyzer');
      } else if (status === 'explained' && authorExplanation && finding) {
        awardPoints(25, 'Taught Analyzer a Personal Writing Style Pattern');
        showToast('Personal writing style pattern learned!', 'reward');
      } else if (status === 'intentional' && finding) {
        showToast('Marked as deliberate stylistic intention', 'info');
      }

      // the finding, the story memory and the coach's handled list all change together.
      // taking an answer back also takes it out of what the analyzer has learned
      return status === 'unreviewed' ? reopenFinding(prev, findingId) : applyFindingResponse(prev, findingId, status, authorExplanation);
    });
  }, [awardPoints, noteQuest, showToast]);

  // ---- what the analyzer learns from the writer's answers ----
  const applyAll = (next: Project, global: AnalyzerPreference[]): Project =>
    ({ ...next, findings: applyPreferences(next.findings || [], allPreferences(next, global)) });

  const answerFinding = useCallback((findingId: string, verdict: FindingVerdict, options: AnswerOptions = {}) => {
    const global = userStats.analyzerPreferences ?? [];
    const { project: answered, preference, rescan } = applyVerdict(project, findingId, verdict, options);
    const newGlobal = preference?.scope === 'global' ? [...global.filter(g => g.id !== preference.id), preference] : global;
    setProject(applyAll(answered, newGlobal));
    // the cast changed, so read the story again with the new rule, away from the page
    if (rescan) scanInto(answered, newGlobal).catch(() => showToast('The scan could not finish. Please try again.', 'info'));
    if (newGlobal !== global) setUserStats(prev => ({ ...prev, analyzerPreferences: newGlobal, extrasStamps: stampChanges(prev.extrasStamps, prefKey, prev.analyzerPreferences ?? [], newGlobal) }));
    noteQuest({ type: 'finding' });
    if (verdict === 'correct') awardPoints(15, 'Story Fact Confirmed with Analyzer');
    else if (verdict === 'misunderstood' && options.note?.trim()) awardPoints(25, 'Taught Analyzer a Personal Writing Style Pattern');
    if (preference) showToast(`Saved: ${describePreference(preference)}. You can undo this under Your preferences.`, 'success');
    else if (verdict === 'intentional') showToast('Marked as deliberate', 'info');
  }, [project, userStats.analyzerPreferences, scanInto, awardPoints, noteQuest, showToast]);

  // `rescan` is for rules that change who the cast is: the story is read again with them
  const changePreferences = useCallback((change: (own: AnalyzerPreference[], global: AnalyzerPreference[]) => { own: AnalyzerPreference[]; global: AnalyzerPreference[] }, rescan = false) => {
    const { own, global } = change(project.memoryVault.preferences ?? [], userStats.analyzerPreferences ?? []);
    const next = { ...project, memoryVault: { ...project.memoryVault, preferences: own } };
    setProject(applyAll(next, global));
    if (rescan) scanInto(next, global).catch(() => showToast('The scan could not finish. Please try again.', 'info'));
    setUserStats(prev => ({ ...prev, analyzerPreferences: global, extrasStamps: stampChanges(prev.extrasStamps, prefKey, prev.analyzerPreferences ?? [], global) }));
  }, [project, userStats.analyzerPreferences, scanInto, showToast]);

  const changesCast = (id: string) => ['same-person', 'not-character'].includes((project.memoryVault.preferences ?? []).find(x => x.id === id)?.kind ?? '');

  const setPreferenceEnabled = useCallback((id: string, enabled: boolean) => {
    const flip = (list: AnalyzerPreference[]) => list.map(x => (x.id === id ? { ...x, enabled } : x));
    changePreferences((own, global) => ({ own: flip(own), global: flip(global) }), changesCast(id));
  }, [changePreferences, project.memoryVault.preferences]);

  const deletePreference = useCallback((id: string) => {
    changePreferences((own, global) => ({ own: own.filter(x => x.id !== id), global: global.filter(x => x.id !== id) }), changesCast(id));
  }, [changePreferences, project.memoryVault.preferences]);

  // the writer said yes to a suggestion: hide that kind of finding everywhere in this project, or everywhere
  const acceptHideSuggestion = useCallback((check: string, scope: 'project' | 'global') => {
    const made: AnalyzerPreference = { id: `pref-${scope}-${check}-all`, check, scope, enabled: true, createdAt: new Date().toISOString() };
    changePreferences((own, global) => scope === 'global'
      ? { own, global: [...global.filter(x => x.id !== made.id), made] }
      : { own: [...own.filter(x => x.id !== made.id), made], global });
    showToast(`Done. I'll hide ${checkLabel(check)}${scope === 'global' ? ' in every project' : ' in this project'}.`, 'success');
  }, [changePreferences, showToast]);

  const declineSuggestion = useCallback((key: string) => {
    setProject(prev => ({ ...prev, memoryVault: { ...prev.memoryVault, declinedSuggestions: [...(prev.memoryVault.declinedSuggestions ?? []).filter(x => x !== key), key] } }));
  }, []);


  const dismissLoop = useCallback((loopId: string, handled = true) => {
    setProject(prev => applyLoopHandled(prev, loopId, handled));
  }, []);

  const addEstablishedFact = useCallback((fact: EstablishedFact) => {
    setProject(prev => ({
      ...prev,
      memoryVault: {
        ...prev.memoryVault,
        establishedFacts: [fact, ...prev.memoryVault.establishedFacts]
      }
    }));
    showToast('Fact recorded in Story Memory', 'success');
  }, [showToast]);

  const deleteEstablishedFact = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      memoryVault: {
        ...prev.memoryVault,
        establishedFacts: prev.memoryVault.establishedFacts.filter(f => f.id !== id)
      }
    }));
  }, []);

  const addAuthorStyleRule = useCallback((rule: AuthorStyleRule) => {
    setProject(prev => ({
      ...prev,
      memoryVault: {
        ...prev.memoryVault,
        authorStyleRules: [rule, ...prev.memoryVault.authorStyleRules]
      }
    }));
    showToast('Style pattern saved to Author Profile', 'success');
  }, [showToast]);

  const deleteAuthorStyleRule = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      memoryVault: {
        ...prev.memoryVault,
        authorStyleRules: prev.memoryVault.authorStyleRules.filter(r => r.id !== id)
      }
    }));
  }, []);

  // wear something the writer owns
  const equipCosmetic = useCallback((bundle: CosmeticItem) => {
    if (bundle.category === 'pack') {
      (bundle.contains ?? []).forEach(id => {
        // things the writer made are not in the catalog, so they are rebuilt from their id
        const part = CATALOG.find(c => c.id === id) ?? { id, name: id, category: splitId(id).category as CosmeticItem['category'], cost: 0, description: '', unlocked: true };
        equipCosmetic(part);
      });
      return;
    }
    const item = bundle;
    if (item.id.startsWith('workshop-')) return;
    const tail = item.id.slice(item.id.indexOf('-') + 1);
    if (item.category === 'soundscape') { setUserStats(prev => ({ ...prev, ambientSound: tail })); ambientAudio.play(tail); return; }
    if (item.category === 'chime') {
      setUserStats(prev => ({ ...prev, activeChimes: { sprint: tail, goal: tail, badge: tail } }));
      const stats = userStatsRef.current;
      ambientAudio.playChime(chimeFor('sprint', { sprint: tail }, stats.customChimes) ?? PRESET_CHIMES[0], stats.chimeVolume ?? DEFAULT_CHIME_VOLUME);
      return;
    }
    if (item.category === 'theme' && findThemePreset(tail)) {
      // a theme from the shop becomes one of the writer's own, so every part of it can be changed
      const preset = findThemePreset(tail)!;
      setUserStats(prev => {
        const have = (prev.customThemes || []).some(t => t.id === preset.theme.id);
        return {
          ...prev,
          customThemes: have ? prev.customThemes : [...(prev.customThemes || []), presetCopy(preset)],
          activeCustomThemeId: preset.theme.id,
          activeTheme: 'custom',
          extrasStamps: have ? prev.extrasStamps : stamped(prev.extrasStamps, themeKey(preset.theme.id)),
        };
      });
      return;
    }
    if (item.category === 'pairing') {
      const pair = findPairing(tail, userStatsRef.current.customPairings);
      setUserStats(prev => ({ ...prev, activeFont: pair.body, titleFont: pair.heading || undefined }));
      return;
    }
    if (item.category === 'theme') {
      setUserStats(prev => ({ ...prev, activeTheme: tail, activeCustomThemeId: null }));
      return;
    }
    const field = {
      theme: 'activeTheme', cursor: 'activeCursor', keystroke: 'keystrokeSound', loader: 'activeLoader', separator: 'activeSeparator', flourish: 'activeFlourish',
      trail: 'activeTrail', shape: 'activeShape', confetti: 'activeCelebration', skin: 'activeSkin', shelf: 'activeShelf', cover: 'activeCover', texture: 'activeTexture', edge: 'activeEdge',
    }[item.category as 'theme'];
    if (field) setUserStats(prev => ({ ...prev, [field]: tail }));
  }, []);

  // cosmetic shop
  const buyCosmetic =useCallback((item: CosmeticItem): boolean => {
    if (userStats.unlockedCosmetics.includes(item.id)) return true;

    if (!inSeason(item.season)) {
      showToast(`${item.name} is sold in ${SEASONS[item.season!].label.toLowerCase()}.`, 'info');
      return false;
    }

    if (userStats.quillPoints < item.cost) {
      showToast(`Need ${item.cost - userStats.quillPoints} more Quill Points to unlock!`, 'info');
      return false;
    }

    setUserStats(prev => ({
      ...prev,
      quillPoints: prev.quillPoints - item.cost,
      unlockedCosmetics: [...new Set([...prev.unlockedCosmetics, item.id, ...(item.contains ?? [])])]
    }));

    showToast(`Unlocked: ${item.name}!`, 'reward');
    triggerConfetti();
    setThemePreview(null);
    equipCosmetic(item);
    return true;
  }, [userStats.quillPoints, userStats.unlockedCosmetics, showToast, triggerConfetti, equipCosmetic]);

  // everything the writer makes is saved and deleted the same way, and stamped so it syncs
  const saveMade = useCallback((kind: MadeKind, raw: { id: string }, wear = true, free = false) => {
    const item = MADE[kind].clean(raw);
    const { field, worn } = MADE[kind];
    const isNew = !((userStatsRef.current[field] as Array<{ id: string }> | undefined) ?? []).some(x => x.id === item.id);
    const price = isNew && !free && kind !== 'palette' ? MAKE_COST : 0;
    if (price && userStatsRef.current.quillPoints < price) { canMake(); return item; }
    setUserStats(prev => {
      const mine = (prev[field] as Array<{ id: string }> | undefined) ?? [];
      const next = mine.some(x => x.id === item.id) ? mine.map(x => (x.id === item.id ? item : x)) : [...mine, item];
      return {
        ...prev,
        quillPoints: prev.quillPoints - (mine.some(x => x.id === item.id) ? 0 : price),
        [field]: next,
        ...(wear && worn ? { [worn.field]: item.id } : {}),
        extrasStamps: stampChanges(prev.extrasStamps, id => madeKey(kind, id), mine, next),
      };
    });
    showToast(price ? `Saved ${(item as { name?: string }).name ?? 'it'} for ${price} Quill Points` : `Saved ${(item as { name?: string }).name ?? 'it'}`, 'success');
    return item;
  }, [showToast, canMake]);

  const deleteMade = useCallback((kind: MadeKind, id: string) => {
    const { field, worn } = MADE[kind];
    setUserStats(prev => {
      const mine = (prev[field] as Array<{ id: string }> | undefined) ?? [];
      const next = mine.filter(x => x.id !== id);
      const wearing = !!worn && (prev as unknown as Record<string, unknown>)[worn.field] === id;
      return {
        ...prev,
        [field]: next,
        ...(wearing && worn ? { [worn.field]: worn.fallback } : {}),
        ...(kind === 'chime' ? { activeChimes: pruneChimes(prev.activeChimes, c => c !== id) } : {}),
        extrasStamps: stampChanges(prev.extrasStamps, key => madeKey(kind, key), mine, next),
      };
    });
  }, []);

  const saveCustomLoader = useCallback((raw: Partial<LoaderConfig> & { id: string }) => { saveMade('loader', raw); }, [saveMade]);
  const deleteCustomLoader = useCallback((id: string) => deleteMade('loader', id), [deleteMade]);
  const saveCustomSeparator = useCallback((raw: Partial<CustomSeparator> & { id: string }) => { saveMade('separator', raw); }, [saveMade]);
  const deleteCustomSeparator = useCallback((id: string) => deleteMade('separator', id), [deleteMade]);
  const saveCustomFlourish = useCallback((raw: Partial<CustomFlourish> & { id: string }) => { saveMade('flourish', raw); }, [saveMade]);
  const deleteCustomFlourish = useCallback((id: string) => deleteMade('flourish', id), [deleteMade]);
  const saveCustomTrail = useCallback((raw: Partial<TrailConfig> & { id: string }) => { saveMade('trail', raw); }, [saveMade]);
  const deleteCustomTrail = useCallback((id: string) => deleteMade('trail', id), [deleteMade]);
  const saveCustomChime = useCallback((raw: Partial<ChimeConfig> & { id: string }) => { saveMade('chime', raw, false); }, [saveMade]);
  const deleteCustomChime = useCallback((id: string) => deleteMade('chime', id), [deleteMade]);
  const saveCustomShape = useCallback((raw: Partial<ShapeConfig> & { id: string }) => { saveMade('shape', raw); }, [saveMade]);
  const deleteCustomShape = useCallback((id: string) => deleteMade('shape', id), [deleteMade]);
  const saveCustomCover = useCallback((raw: Partial<CustomCover> & { id: string }) => { saveMade('cover', raw, false); }, [saveMade]);
  const deleteCustomCover = useCallback((id: string) => deleteMade('cover', id), [deleteMade]);
  const saveCustomCelebration = useCallback((raw: Partial<CelebrationConfig> & { id: string }) => { saveMade('celebration', raw); }, [saveMade]);
  const deleteCustomCelebration = useCallback((id: string) => deleteMade('celebration', id), [deleteMade]);
  // the same for the kinds without a wrapper of their own: fonts, textures, margins, skins, shelves, bundles
  const makeMine = useCallback((kind: MadeKind, raw: { id: string; name?: string }) => { saveMade(kind, raw, kind !== 'bundle' && kind !== 'pairing'); }, [saveMade]);
  // something another writer shared: it was made elsewhere, so it is free to add
  const importMine = useCallback((kind: MadeKind, raw: { id: string; name?: string }) => { saveMade(kind, raw, false, true); }, [saveMade]);
  const removeMine = useCallback((kind: MadeKind, id: string) => deleteMade(kind, id), [deleteMade]);
  const setNoPointNotes = useCallback((hide: boolean) => setUserStats(prev => ({ ...prev, noPointNotes: hide })), []);
  const setQuietWriting = useCallback((quiet: boolean) => setUserStats(prev => ({ ...prev, quietWriting: quiet })), []);
  const savePalette = useCallback((p: Palette) => {
    const isNew = !(userStatsRef.current.customPalettes ?? []).some(x => x.id === p.id);
    if (isNew && (userStatsRef.current.customPalettes ?? []).length >= MAX_PALETTES) { showToast(`You can keep ${MAX_PALETTES} palettes. Delete one to save another.`, 'info'); return; }
    saveMade('palette', p, false);
  }, [saveMade, showToast]);
  const deletePalette = useCallback((id: string) => deleteMade('palette', id), [deleteMade]);

  const previewChime = useCallback((c: ChimeConfig) => {
    ambientAudio.playChime(c, userStatsRef.current.chimeVolume ?? DEFAULT_CHIME_VOLUME);
  }, []);

  const setChimeFor = useCallback((event: ChimeEvent, id: string) => {
    setUserStats(prev => ({ ...prev, activeChimes: { ...(prev.activeChimes ?? {}), [event]: id } }));
  }, []);

  const setChimeVolume = useCallback((v: number) => {
    setUserStats(prev => ({ ...prev, chimeVolume: Math.min(1, Math.max(0, v)) }));
  }, []);

  const setDocCover = useCallback((docId: string | null, coverId: string) => {
    if (docId === null) setUserStats(prev => ({ ...prev, activeCover: coverId }));
    else updateAnyProject(docId, { coverStyle: coverId });
  }, [updateAnyProject]);

  // the shop is a page of its own; closing it goes back to wherever it was opened from
  const openShop = useCallback(() => {
    setShopReturn(prev => (viewMode === 'shop' ? prev : viewMode));
    setViewMode('shop');
  }, [viewMode]);

  const closeShop = useCallback(() => {
    setViewMode(shopReturn);
  }, [shopReturn]);

  // appearance & sensory
  const setTheme = useCallback((theme: ThemeMode) => {
    setUserStats(prev => ({ ...prev, activeTheme: theme, ...(theme === 'custom' ? {} : { activeCustomThemeId: null }) }));
  }, []);

  const setCursor = useCallback((cursor: CursorStyle) => {
    setUserStats(prev => ({ ...prev, activeCursor: cursor }));
  }, []);

  const setLoader = useCallback((loader: string) => {
    setUserStats(prev => ({ ...prev, activeLoader: loader }));
  }, []);

  const setFont = useCallback((font: EditorFont) => {
    setUserStats(prev => ({ ...prev, activeFont: font }));
  }, []);

  const setFontSize = useCallback((fontSize: number) => {
    setUserStats(prev => ({ ...prev, fontSize }));
  }, []);

  const setLineHeight = useCallback((lineHeight: number) => {
    setUserStats(prev => ({ ...prev, lineHeight }));
  }, []);

  const toggleIndentParagraphs = useCallback(() => {
    setUserStats(prev => ({ ...prev, indentParagraphs: !prev.indentParagraphs }));
  }, []);

  const toggleTypewriterMode = useCallback(() => {
    setUserStats(prev => ({ ...prev, typewriterMode: !prev.typewriterMode }));
  }, []);

  const setCornerRoundness = useCallback((roundness: number) => {
    setUserStats(prev => ({ ...prev, cornerRoundness: roundness }));
  }, []);

  const saveCustomTheme = useCallback((theme: CustomThemeConfig): boolean => {
    const isNew = !(userStats.customThemes || []).some(t => t.id === theme.id);
    if (isNew && userStats.quillPoints < CUSTOM_THEME_COST) {
      showToast(`A new theme costs ${CUSTOM_THEME_COST} Quill Points. You need ${CUSTOM_THEME_COST - userStats.quillPoints} more.`, 'info');
      return false;
    }
    setUserStats(prev => {
      const existing = prev.customThemes || [];
      const updated = existing.some(t => t.id === theme.id)
        ? existing.map(t => (t.id === theme.id ? theme : t))
        : [...existing, theme];
      return {
        ...prev,
        quillPoints: isNew ? prev.quillPoints - CUSTOM_THEME_COST : prev.quillPoints,
        customThemes: updated,
        activeCustomThemeId: theme.id,
        activeTheme: 'custom',
        extrasStamps: stamped(prev.extrasStamps, themeKey(theme.id)),
      };
    });
    showToast(isNew ? `Created "${theme.name}" for ${CUSTOM_THEME_COST} Quill Points` : `Saved "${theme.name}"`, 'success');
    return true;
  }, [showToast, userStats.customThemes, userStats.quillPoints]);

  const deleteCustomTheme = useCallback((themeId: string) => {
    setUserStats(prev => {
      const updated = (prev.customThemes || []).filter(t => t.id !== themeId);
      const isCurrent = prev.activeCustomThemeId === themeId;
      return {
        ...prev,
        customThemes: updated,
        activeCustomThemeId: isCurrent ? null : prev.activeCustomThemeId,
        activeTheme: isCurrent ? 'parchment' : prev.activeTheme,
        extrasStamps: stamped(prev.extrasStamps, themeKey(themeId), true),
      };
    });
    showToast('Deleted custom theme', 'info');
  }, [showToast]);

  const applyCustomTheme = useCallback((themeId: string | null) => {
    setUserStats(prev => {
      if (!themeId) {
        return { ...prev, activeCustomThemeId: null, activeTheme: 'parchment' };
      }
      return { ...prev, activeCustomThemeId: themeId, activeTheme: 'custom' };
    });
  }, []);

  const importCustomFont = useCallback((font: CustomFontConfig, activate = true) => {
    if (font.source === 'google') {
      fontLoader.loadGoogleFont(font.family);
    } else if (font.source === 'url' && font.url) {
      fontLoader.loadFontFromUrl(font.url, font.family);
    }
    setUserStats(prev => {
      const existing = prev.customFonts || [];
      const updated = existing.some(f => f.id === font.id || f.family.toLowerCase() === font.family.toLowerCase())
        ? existing
        : [...existing, font];
      return { ...prev, customFonts: updated, ...(activate ? { activeFont: font.family } : {}) };
    });
  }, []);

  // add a font from a file on the writer's computer. returns its family name, or null on failure.
  const uploadFontFile = useCallback(async (file: File, family?: string, activate = false): Promise<string | null> => {
    try {
      const { config, family: name } = await addFontFile(file, (userStats.customFonts || []).map(f => f.family), family);
      importCustomFont(config, activate);
      showToast(`Added font "${name}"`, 'success');
      return name;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not add that font.', 'info');
      return null;
    }
  }, [userStats.customFonts, importCustomFont, showToast]);

  const deleteCustomFont = useCallback((fontId: string) => {
    const font = (userStats.customFonts || []).find(f => f.id === fontId);
    if (font?.assetId) deleteAsset(font.assetId).catch(() => undefined);
    setUserStats(prev => ({
      ...prev,
      customFonts: (prev.customFonts || []).filter(f => f.id !== fontId),
      activeFont: font && prev.activeFont === font.family ? 'Lora' : prev.activeFont
    }));
  }, [userStats.customFonts]);

  const setStoryTheme = useCallback((config: { activeTheme?: ThemeMode; customTheme?: CustomThemeConfig; cornerRoundness?: number; activeFont?: string; useStoryTheme: boolean }) => {
    setProject(prev => {
      const updated: Project = {
        ...prev,
        useStoryTheme: config.useStoryTheme,
        storyTheme: {
          activeTheme: config.activeTheme,
          customTheme: config.customTheme,
          cornerRoundness: config.cornerRoundness,
          activeFont: config.activeFont
        },
        updatedAt: new Date().toISOString()
      };
      storageService.saveProject(updated);
      setAllProjects(all => all.map(p => p.id === updated.id ? updated : p));
      return updated;
    });
    showToast(config.useStoryTheme ? 'Theme saved for this document' : 'Using your main theme', 'info');
  }, [showToast]);

  const setAmbientSound = useCallback((sound: string) => {
    setUserStats(prev => ({ ...prev, ambientSound: sound }));
    ambientAudio.play(sound);
  }, []);

  const setAmbientVolume = useCallback((vol: number) => {
    setUserStats(prev => ({ ...prev, ambientVolume: vol }));
    ambientAudio.setVolume(vol);
  }, []);

  // keystrokes & procedural audio
  const setKeystrokeSound = useCallback((sound: KeystrokeSound) => {
    setUserStats(prev => ({ ...prev, keystrokeSound: sound }));
  }, []);

  const setKeystrokeVolume = useCallback((vol: number) => {
    setUserStats(prev => ({ ...prev, keystrokeVolume: vol }));
    ambientAudio.setKeystrokeVolume(vol);
  }, []);

  const playKeystroke = useCallback((key: string, soundOverride?: KeystrokeSound) => {
    ambientAudio.playKeystroke(key, soundOverride || userStats.keystrokeSound || 'thocky');
  }, [userStats.keystrokeSound]);

  // Calliope companion & mood
  const setCalliopeMood = useCallback((mood: CalliopeMood) => {
    setUserStats(prev => ({ ...prev, calliopeMood: mood }));
    const info = CALLIOPE_MOODS[mood];
    showToast(`Calliope is feeling ${info.label.toLowerCase()}: "${info.statusLine}"`, 'info');
  }, [showToast]);

  const shakeCalliopeJar = useCallback((): string => {
    const currentMood = userStats.calliopeMood || 'sparkly';
    const info = CALLIOPE_MOODS[currentMood];
    const quote = info.shakeQuotes[Math.floor(Math.random() * info.shakeQuotes.length)];
    showToast(`Calliope (${info.label}): "${quote}"`, 'info');
    return quote;
  }, [userStats.calliopeMood, showToast]);

  // badges system
  const unlockBadge = useCallback((badgeId: string) => {
    setBadges(prev => prev.map(b => {
      if (b.id === badgeId && !b.unlocked) {
        showToast(`Achievement Unlocked: ${b.name}!`, 'reward');
        triggerConfetti();
        playChimeFor('badge');
        return { ...b, unlocked: true, unlockedAt: new Date().toISOString() };
      }
      return b;
    }));
    setUserStats(prev => {
      const current = prev.unlockedBadges || [];
      if (!current.includes(badgeId)) {
        return { ...prev, unlockedBadges: [...current, badgeId] };
      }
      return prev;
    });
  }, [showToast, triggerConfetti, playChimeFor]);
  unlockBadgeRef.current = unlockBadge;

  const checkBadgeMilestones = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 23 || hour <= 4) {
      unlockBadge('badge-midnight-weaver');
    }
    if (userStats.totalWordsWritten >= 5000) {
      unlockBadge('badge-words-5k');
    }
    if (userStats.totalWordsWritten >= 25000) {
      unlockBadge('badge-words-25k');
    }
    if (userStats.totalWordsWritten >= 50000) {
      unlockBadge('badge-words-50k');
    }
    if (userStats.totalWordsWritten >= 100000) {
      unlockBadge('badge-words-100k');
    }
    if ((userStats.sprintsCompleted || 0) >= 1) {
      unlockBadge('badge-first-sprint');
    }
    if ((userStats.sprintsCompleted || 0) >= 5) {
      unlockBadge('badge-sprint-veteran');
    }
    if (project.reflections.length >= 3) {
      unlockBadge('badge-deep-autopsy');
    }
  }, [userStats.totalWordsWritten, userStats.sprintsCompleted, project.reflections.length, unlockBadge]);

  // streak milestones earn a badge, and the badge earns a keepsake in the shop
  useEffect(() => {
    const best = Math.max(quests.best, streak);
    if (best >= 7) unlockBadge('badge-streak-7');
    if (best >= 30) unlockBadge('badge-streak-30');
    if (best >= 100) unlockBadge('badge-streak-100');
  }, [quests.best, streak, unlockBadge]);

  const toggleShowcase = useCallback((badgeId: string) => {
    setUserStats(prev => {
      const now = prev.showcase ?? [];
      if (now.includes(badgeId)) return { ...prev, showcase: now.filter(id => id !== badgeId) };
      return { ...prev, showcase: [...now, badgeId].slice(-3) };
    });
  }, []);

  // writing sprints engine
  const startSprint = useCallback((config: SprintConfig) => {
    const durationSeconds = config.durationMinutes * 60;
    const currentTotalWords = project.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    setActiveSprint({
      isActive: true,
      startTime: new Date().toISOString(),
      durationSeconds,
      remainingSeconds: durationSeconds,
      startWordCount: currentTotalWords,
      currentWordCount: currentTotalWords,
      wordsWritten: 0,
      targetWords: config.targetWords,
      promptText: config.promptText,
      config
    });
    setIsSprintModalOpen(false);

    const moodInfo = CALLIOPE_MOODS[userStats.calliopeMood || 'sparkly'];
    const cheer = moodInfo.sprintStartQuotes[Math.floor(Math.random() * moodInfo.sprintStartQuotes.length)];
    showToast(`Sprint Started (${config.durationMinutes}m)! Calliope: "${cheer}"`, 'info');
  }, [project.chapters, userStats.calliopeMood, showToast]);

  const cancelSprint = useCallback(() => {
    setActiveSprint(null);
    showToast('Writing sprint ended early.', 'info');
  }, [showToast]);

  const completeSprint = useCallback(() => {
    if (!activeSprint) return;
    const currentTotalWords = project.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    const wordsWritten = Math.max(0, currentTotalWords - activeSprint.startWordCount);

    const basePoints = activeSprint.config.basePoints || 20;
    const bonusPoints = Math.floor((wordsWritten / 100) * (activeSprint.config.bonusPointsPer100Words || 5));
    const hitTargetBonus = (activeSprint.targetWords > 0 && wordsWritten >= activeSprint.targetWords) ? REWARD.sprintTargetBonus : 0;
    const totalEarnedPoints = basePoints + bonusPoints + hitTargetBonus;

    awardPoints(totalEarnedPoints, `Writing Sprint finished (${wordsWritten} words)!`);
    // the sprint's own chime goes first, so a challenge it completes does not talk over it
    playChimeFor('sprint');
    noteQuest({ type: 'sprint' });
    triggerConfetti();

    setUserStats(prev => ({
      ...prev,
      sprintsCompleted: (prev.sprintsCompleted || 0) + 1
    }));
    updateProjectMeta({ sprints: addSprint(project.sprints, { minutes: Math.round(activeSprint.durationSeconds / 60), words: wordsWritten, target: activeSprint.targetWords || undefined }) });

    if (activeSprint.durationSeconds >= 1200) {
      unlockBadge('badge-hourglass');
    }
    unlockBadge('badge-first-sprint');
    if (activeSprint.promptText) {
      unlockBadge('badge-calliope-chosen');
    }

    const moodInfo = CALLIOPE_MOODS[userStats.calliopeMood || 'sparkly'];
    const praise = moodInfo.sprintFinishQuotes[Math.floor(Math.random() * moodInfo.sprintFinishQuotes.length)];
    showToast(`Sprint Complete! +${totalEarnedPoints} Quill Points. Calliope: "${praise}"`, 'reward');
    setActiveSprint(null);
  }, [activeSprint, project.chapters, awardPoints, triggerConfetti, unlockBadge, userStats.calliopeMood, showToast, playChimeFor, noteQuest, updateProjectMeta, project.sprints]);

  // sprint ticking timer
  useEffect(() => {
    if (!activeSprint || !activeSprint.isActive) return;

    const interval = setInterval(() => {
      setActiveSprint(prev => {
        if (!prev || !prev.isActive) return null;
        if (prev.remainingSeconds <= 1) {
          clearInterval(interval);
          completeSprint();
          return null;
        }

        const currentTotalWords = project.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
        const wordsWritten = Math.max(0, currentTotalWords - prev.startWordCount);

        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1,
          currentWordCount: currentTotalWords,
          wordsWritten
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSprint?.isActive, completeSprint, project.chapters]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const value = {
    project,
    allProjects,
    activeChapterId,
    activeChapter,
    userStats,
    sidebarTab,
    isSidebarOpen,
    viewMode,
    toasts,
    cosmeticShop,
    badges,
    checkBadgeMilestones,
    isSprintModalOpen,
    setIsSprintModalOpen,
    sprintPresetPrompt,
    setSprintPresetPrompt,
    activeSprint,
    startSprint,
    cancelSprint,
    completeSprint,
    setKeystrokeSound,
    setKeystrokeVolume,
    playKeystroke,
    setCalliopeMood,
    shakeCalliopeJar,
    setActiveChapterId,
    setSidebarTab,
    focusedCard,
    openFoundationCard,
    clearFocusedCard,
    setIsSidebarOpen,
    toggleSidebar,
    setViewMode,
    goToTool,
    editorScrollMode,
    setEditorScrollMode,
    editorReviewMode,
    setEditorReviewMode,
    activeCommentId,
    setActiveCommentId,
    jumpTarget,
    promptLabTool,
    setPromptLabTool,
    jumpToPassage,
    addCommentAtPassage,
    quests,
    streak,
    swapDailyQuest,
    buyStreakFreeze,
    notePlanning,
    markDraftComplete,
    toolDoc,
    toolParent,
    toolFromDoc,
    openTool,
    createToolDoc,
    updateToolDoc,
    attachTool,
    leaveTool,
    createNewProject,
    makeAlternateDraft,
    openProject,
    deleteExistingProject,
    trash,
    restoreDeleted,
    deleteForever,
    updateAnyProject,
    createDocumentFolder,
    renameDocumentFolder,
    deleteDocumentFolder,
    moveProjectToFolder,
    updateChapterFolder,
    updateChapterContent,
    createChapter,
    deleteChapter,
    removeScene,
    moveScene,
    updateChapterTitle,
    updateChapterStatus,
    splitChapter,
    insertChapterAt,
    mergeChapterWithPrevious,
    setDraftMode,
    insertSceneBreak,
    collabSession,
    isCollabModalOpen,
    setIsCollabModalOpen,
    live,
    liveSessions,
    liveApi,
    updateProjectMeta,
    working,
    exportProject: () => doWork('Preparing your backup…', exportProject),
    exportStandaloneHtml: () => doWork('Building your web page…', exportStandaloneHtml),
    exportDocx: () => doWork('Building your Word document…', exportDocx),
    exportEpub: () => doWork('Building your e-book…', exportEpub),
    sync,
    exportActiveChapterMd,
    exportFullManuscriptMd,
    saveCharacter,
    deleteCharacter,
    saveSecret,
    deleteSecret,
    saveLocation,
    deleteLocation,
    saveLore,
    deleteLore,
    saveReflection,
    deleteReflection,
    savePlotThread,
    deletePlotThread,
    trackLoopAsThread,
    saveGoal,
    toggleGoalComplete,
    deleteGoal,
    awardPoints,
    buyCosmetic,
    equipCosmetic,
    saveCustomLoader,
    deleteCustomLoader,
    saveCustomSeparator,
    deleteCustomSeparator,
    saveCustomFlourish,
    deleteCustomFlourish,
    saveCustomTrail,
    deleteCustomTrail,
    saveCustomChime,
    deleteCustomChime,
    saveCustomShape,
    deleteCustomShape,
    saveCustomCover,
    deleteCustomCover,
    saveCustomCelebration,
    deleteCustomCelebration,
    setQuietWriting,
    setNoPointNotes,
    makeMine,
    removeMine,
    importMine,
    canMake,
    previewCelebration,
    savePalette,
    deletePalette,
    previewChime,
    setChimeFor,
    setChimeVolume,
    setDocCover,
    toggleShowcase,
    noteExport,
    openShop,
    closeShop,
    addComment,
    updateSuggestionText,
    toggleCommentResolved,
    deleteComment,
    acceptSuggestion,
    rejectSuggestion,
    runStoryAnalysis,
    isScanning,
    setStatementIgnored,
    importManuscriptFile: (file: File) => doWork('Reading your file…', () => importManuscriptFile(file)),
    respondToFinding,
    answerFinding,
    setPreferenceEnabled,
    deletePreference,
    acceptHideSuggestion,
    declineSuggestion,
    dismissLoop,
    setCoachSettings,
    setCoachKnowledge,
    setPageLayout,
    setHomeSettings,
    isTourOpen,
    setIsTourOpen,
    setThemeImages,
    saveCustomSound,
    deleteCustomSound,
    saveSoundscape,
    deleteSoundscape,
    uploadScapeFile,
    addCustomCursor,
    deleteCustomCursor,
    uploadSoundFile,
    exportCustomSound,
    importSoundFile,
    addEstablishedFact,
    deleteEstablishedFact,
    addAuthorStyleRule,
    deleteAuthorStyleRule,
    updateProject: (updates: Partial<Project>) => {
      setProject(prev => {
        const updated = { ...prev, ...updates, updatedAt: new Date().toISOString() };
        storageService.saveProject(updated);
        return updated;
      });
    },
    setTheme,
    themePreview,
    previewTheme,
    setCursor,
    setLoader,
    setFont,
    setFontSize,
    setLineHeight,
    toggleIndentParagraphs,
    toggleTypewriterMode,
    setAmbientSound,
    setAmbientVolume,
    setCornerRoundness,
    saveCustomTheme,
    deleteCustomTheme,
    applyCustomTheme,
    importCustomFont,
    uploadFontFile,
    deleteCustomFont,
    setStoryTheme,
    triggerConfetti,
    showToast,
    versions,
    isVersionHistoryOpen,
    setIsVersionHistoryOpen,
    createManualSnapshot,
    restoreVersion: (id: string) => { void doWork('Restoring that version…', () => restoreVersion(id)); },
    deleteVersionSnapshot,
    renameVersionSnapshot,
    duplicateVersionAsNewProject: (id: string, title?: string) => { void doWork('Making a copy…', () => duplicateVersionAsNewProject(id, title)); },
    lastAutosaveTime
  };

  return <AsterismContext.Provider value={value}>{children}</AsterismContext.Provider>;
};

export const useAsterism = () => {
  const context = useContext(AsterismContext);
  if (!context) {
    throw new Error('useAsterism must be used within an AsterismProvider');
  }
  return context;
};
