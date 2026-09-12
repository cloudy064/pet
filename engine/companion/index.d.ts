import { PipiEngine, AssetManifest, ActionDefinition, PlaybackOptions, PlaybackResult } from '../index';

export type CompanionMode = 'home' | 'learning' | 'care' | 'rest' | 'hidden';
export type CompanionLocale = 'zh-CN' | 'en';
export interface CompanionRules {
  minHeight?: number;
  maxHeight?: number;
  growthEase?: number;
  growthCap?: number;
  feedCost?: number;
  feedGain?: number;
  bathCost?: number;
  hungerPerHour?: number;
  dirtPerHour?: number;
  maxOfflineHours?: number;
  requestBelow?: number;
  requestCooldownMs?: number;
  requestDelayMs?: number;
  eyeBreakMs?: number;
  historyLimit?: number;
}
export interface CareOperation {
  id: string;
  kind: 'feed' | 'bath';
  cost: number;
  gain: number;
}
export interface BathState {
  id: string;
  phase: 'soap' | 'rinse';
  cells: number[];
}
export interface CompanionState {
  version: 1;
  revision: number;
  growthPoints: number;
  satiation: number;
  cleanliness: number;
  updatedAt: number;
  lastRequestAt: number;
  requestCursor: number;
  eventRevision: number;
  walletRevision: number;
  recentEvents: string[];
  recentCare: string[];
  pendingCare: CareOperation | null;
  bath: BathState | null;
  welcomedSession: string | null;
}
export interface CompanionStorage {
  load(): Promise<CompanionState | null>;
  /** Atomically compare persisted revision and write, or throw StorageConflictError. */
  save(state: CompanionState, options: { expectedRevision: number }): Promise<void>;
}
export interface WalletReceipt {
  operationId: string;
  status: 'committed' | 'declined';
  revision: number;
}
export interface CompanionWallet {
  /** Idempotent: retries of the same operationId must return the same receipt. Revisions are monotonic. */
  spend(input: { operationId: string; amount: number; reason: 'feed' | 'bath' }): Promise<WalletReceipt>;
}
export interface DialogueEntry {
  text: string;
  en?: string;
  gesture: string;
}
export interface CompanionVoice {
  play(input: { text: string; locale: CompanionLocale }): {
    finished: Promise<{ status: string }>;
    cancel(): void;
    pause(): void;
    resume(): void;
  };
}
export interface CompanionOptions {
  rules?: CompanionRules;
  mode?: CompanionMode;
  storage?: CompanionStorage;
  wallet?: CompanionWallet;
  clock?: () => number;
  random?: () => number;
  muted?: boolean;
  locale?: CompanionLocale;
  careZoom?: number;
  interaction?: 'legacy' | 'companion';
  freeActions?: string[];
  freeWeights?: Record<string, number>;
  dialogue?: Record<string, DialogueEntry>;
  audioCatalog?: Partial<Record<CompanionLocale, Record<string, string>>>;
  voice?: CompanionVoice;
}
export interface LearningEvent {
  id: string;
  type: 'taskCompleted' | 'knowledgeMastered' | 'gameCompleted';
  /** Strictly increasing per-pet sequence, delivered in order. Required for replay protection. */
  revision: number;
  knowledgeId?: string;
  displayName?: string;
  confirmedGrowthPoints?: number;
}
export interface CompanionSnapshot {
  mode: CompanionMode;
  muted: boolean;
  locale: CompanionLocale;
  state: CompanionState | null;
  targetHeight: number;
  request: { type: string; createdAt: number } | null;
  bath: (BathState & { coverage: number }) | null;
  foregroundMs: number;
  eyeBreakPending: boolean;
  careKind: 'pet' | 'scratch' | 'bath' | null;
  bathClosing: boolean;
}
export interface CompanionResult {
  status: string;
  reason?: string;
  growthPoints?: number;
  targetHeight?: number;
  state?: CompanionState;
  receipt?: WalletReceipt;
  bath?: BathState & { coverage: number };
  coverage?: number;
  phase?: 'soap' | 'rinse';
}
export class PetCompanion {
  constructor(engine: PipiEngine, options?: CompanionOptions);
  readonly engine: PipiEngine;
  readonly ready: Promise<PetCompanion>;
  readonly state: CompanionState | null;
  readonly mode: CompanionMode;
  readonly destroyed: boolean;
  on(type: string, listener: (event: any) => void): () => void;
  once(type: string, listener: (event: any) => void): () => void;
  off(type: string, listener: (event: any) => void): void;
  snapshot(): CompanionSnapshot;
  exportState(): CompanionState;
  setMode(mode: CompanionMode): this;
  setMuted(muted: boolean): this;
  setLocale(locale: CompanionLocale): this;
  handleEvent(event: LearningEvent): Promise<CompanionResult>;
  welcome(sessionId: string): Promise<CompanionResult>;
  /** Foreground milliseconds. Normally driven by engine frames; use for a manual clock only. */
  tick(milliseconds: number): void;
  refreshNeeds(): Promise<CompanionSnapshot>;
  requestEyeBreak(): boolean;
  dismissRequest(): this;
  respondToRequest(): Promise<CompanionResult | PlaybackResult>;
  playAction(id: string, options?: PlaybackOptions): Promise<PlaybackResult>;
  sing(track: {
    audioURL: string;
    title?: string;
    locale?: CompanionLocale;
    gesture?: string;
    timeout?: number;
  }): Promise<PlaybackResult>;
  pace(options?: { distance?: number }): Promise<PlaybackResult>;
  feed(options: { operationId: string; count?: number }): Promise<CompanionResult>;
  recoverCare(): Promise<CompanionResult>;
  beginBath(operationId: string): Promise<CompanionResult>;
  wash(point: { x: number; y: number }): Promise<CompanionResult>;
  bathCoverage(): number;
  rinse(): Promise<CompanionResult>;
  cancelBath(): this;
  beginPetting(kind?: 'pet' | 'scratch'): Promise<CompanionResult>;
  stroke(point: { x: number; y: number }): CompanionResult;
  endPetting(): this;
  destroy(): void;
}
export const DEFAULT_RULES: Readonly<Required<CompanionRules>>;
export const BATH_CELLS: readonly number[];
export const COMPANION_DIALOGUE: Readonly<Record<string, DialogueEntry>>;
export const COMPANION_ACTION_LABELS: Readonly<Record<string, string>>;
export function growthHeight(points: number, rules?: CompanionRules): number;
export function createMemoryStore(initial?: CompanionState | null): CompanionStorage;
export function createWebStore(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void },
  key?: string,
  options?: { locks?: { request<T>(name: string, callback: () => Promise<T>): Promise<T> } }
): CompanionStorage;
export function createWechatStore(
  wx: { getStorage(options: any): void; setStorage(options: any): void },
  key?: string
): CompanionStorage;
export function createBrowserVoice(host: any): CompanionVoice;
export interface CompanionManifest extends AssetManifest {
  actions: ActionDefinition[];
}
export function installCompanionAnimations(
  engine: PipiEngine,
  manifest: CompanionManifest,
  options?: { baseURL?: string }
): PipiEngine;

export class StorageConflictError extends Error {
  readonly code: 'COMPANION_STORAGE_CONFLICT';
  constructor(message?: string);
}
