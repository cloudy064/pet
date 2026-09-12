/** Coordinates and sizes use logical canvas pixels; time values use milliseconds. */
export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export interface Point {
  x: number;
  y: number;
}
export interface PointerPoint extends Point {
  id: number | string;
}
export interface Rect extends Point {
  w: number;
  h: number;
}
export interface AtlasPage {
  file: string;
  width: number;
  height: number;
  md5?: string;
  bytes?: number;
}
export interface AssetDefinition {
  pages: AtlasPage[];
  tiles: [number, number, number, number, number][];
  /** Optional per-tile placement in virtual asset coordinates, for globally shared tight frames. */
  tileRects?: Rect[];
  /** Reconstruct original raster bounds before filtering to preserve exact subpixel sampling. */
  tileSampling?: { width: number; height: number; rect: Rect }[];
  frameMap: number[];
  durations: number[];
  anchor: Point;
  crop: Rect;
  subjectHeight: number;
  restFrames?: number[];
  patch?: boolean;
}
export interface AssetManifest {
  version: 1;
  /** Single keeps the complete shared image resident through the idle lease. */
  layout?: 'single' | 'paged';
  assets: Record<string, AssetDefinition>;
}
export interface PlaybackOptions {
  queue?: boolean;
  speed?: number;
  loop?: boolean | number;
  sustain?: boolean;
  holdMs?: number;
  to?: Point;
  direction?: Direction;
  distance?: number;
  stride?: number;
  lift?: number;
  scale?: number;
  duration?: number;
  [custom: string]: unknown;
}
export interface ActionDefinition {
  id: string;
  type: 'clip' | 'wave' | 'point' | 'walk' | 'flight' | 'grow' | 'sequence' | (string & {});
  label?: string;
  enabled?: boolean;
  allowSpeech?: boolean;
  speed?: number;
  asset?: string;
  frames?: number[];
  durations?: number[];
  loop?: boolean | number;
  holdMs?: number;
  loopFrames?: number[];
  loopDurations?: number[];
  side?: 'left' | 'right';
  stride?: number;
  duration?: number;
  steps?: Array<{ action: string; repeat?: number; options?: PlaybackOptions }>;
  [custom: string]: unknown;
}
export interface ActionLibrary {
  version: 1;
  actions: ActionDefinition[];
}
export interface Project extends ActionLibrary, AssetManifest {
  settings: { size: number; scale: number; speed: number };
}
export interface CanvasLike {
  width: number;
  height: number;
  clientWidth?: number;
  clientHeight?: number;
  getContext(type: '2d'): any;
}
export interface ImageLike {
  width: number;
  height: number;
  naturalWidth?: number;
  naturalHeight?: number;
}
export interface WechatCanvas extends CanvasLike {
  createImage(): any;
  requestAnimationFrame(callback: (time: number) => void): number;
  cancelAnimationFrame(id: number): void;
}
export interface AudioHandle {
  play(): void | Promise<void>;
  pause(): void;
  stop(): void;
  dispose(): void;
}
/** Structural AbortSignal subset, also usable without DOM types. */
export interface AssetLoadSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}
export interface PredownloadProgress {
  loaded: number;
  total: number;
  bytes: number;
  totalBytes: number;
}
export interface PredownloadOptions {
  signal?: AssetLoadSignal;
  onProgress?: (progress: PredownloadProgress) => void;
}
export interface Adapter {
  canvas: CanvasLike;
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
  resize(width: number, height: number, dpr: number): void;
  createCanvas?(width: number, height: number): CanvasLike;
  loadImage(
    page: AtlasPage & { url: string },
    baseURL?: string,
    options?: { signal?: AssetLoadSignal }
  ): Promise<ImageLike>;
  prefetchImage?(
    page: AtlasPage & { url: string },
    options?: { signal?: AssetLoadSignal }
  ): Promise<{ size: number }>;
  releaseImage(image: ImageLike): void;
  fetchManifest(baseURL: string): Promise<AssetManifest>;
  createAudio(source: string, callbacks: { ended: () => void; error: (error: Error) => void }): AudioHandle;
  bind?(engine: PipiEngine, options: { interactive: boolean }): () => void;
  clearCache?(): Promise<void>;
}
/** Structural subset; compatible with the official miniprogram-api-typings wx object. */
export interface WechatAPI {
  env: { USER_DATA_PATH: string };
  getFileSystemManager(): any;
  getStorageSync(key: string): any;
  setStorageSync(key: string, data: any): void;
  request(options: any): any;
  downloadFile(options: any): any;
  createInnerAudioContext(): any;
  createOffscreenCanvas(options: any): any;
  getWindowInfo?(): any;
  getSystemInfoSync?(): any;
}
export interface EngineOptions {
  width?: number;
  height?: number;
  size?: number;
  scale?: number;
  speed?: number;
  dpr?: number;
  padding?: number;
  position?: Point;
  /** Build output directory. Loads manifest and bundled actions before ready; exclusive with assetBaseURL/manifest/assets. */
  assetPack?: string;
  assetBaseURL?: string;
  manifest?: AssetManifest;
  preset?: boolean;
  assets?: AssetManager;
  actions?: ActionRegistry;
  autoTick?: boolean;
  autoBlink?: boolean;
  interactive?: boolean;
  interactionAudio?: string;
  interactionMode?: 'legacy' | 'events';
  interactionLocked?: boolean;
  random?: () => number;
  maxMemoryBytes?: number;
}
export interface CacheStats {
  definitions: number;
  decoded: number;
  pages: number;
  pending: number;
  bytes: number;
  budget: number;
  tileBytes?: number;
}
export interface EngineSnapshot {
  status: string;
  action: string;
  position: Point;
  size: number;
  scale: number;
  speed: number;
  paused: boolean;
  visible: boolean;
  speaking: boolean;
  frame: number;
  elapsed: number;
  duration: number;
  queue: string[];
  free: boolean;
  cache: CacheStats;
}
export interface PlaybackResult {
  action?: string;
  status: 'finished' | 'cancelled' | 'failed';
  reason?: string;
  error?: Error;
}
declare class Events {
  on(type: string, listener: (detail: any) => void): () => void;
  once(type: string, listener: (detail: any) => void): () => void;
  off(type: string, listener: (detail: any) => void): void;
  emit(type: string, detail: any): void;
  removeAllListeners(): void;
}
export class ActionRegistry extends Events {
  constructor(actions?: ActionDefinition[]);
  readonly version: number;
  assetResolver?: (id: string) => AssetDefinition;
  addType(type: string, validate: (action: ActionDefinition) => void): this;
  validate(action: ActionDefinition): Readonly<ActionDefinition>;
  register(action: ActionDefinition, options?: { replace?: boolean }): this;
  update(id: string, patch: Partial<ActionDefinition>): this;
  remove(id: string): boolean;
  get(id: string): Readonly<ActionDefinition>;
  has(id: string): boolean;
  list(options?: { enabledOnly?: boolean }): Readonly<ActionDefinition>[];
  export(): ActionLibrary;
  import(document: ActionLibrary | string, options?: { replace?: boolean }): this;
}
export interface AssetLease {
  assets: Map<string, { key: string; definition: AssetDefinition; images: ImageLike[] }>;
  release(): void;
}
export class AssetManager extends Events {
  constructor(adapter: Adapter, options?: { maxBytes?: number });
  readonly maxBytes: number;
  define(id: string, asset: AssetDefinition, options?: { baseURL?: string }): this;
  import(manifest: AssetManifest, options?: { baseURL?: string; replace?: boolean }): this;
  has(id: string): boolean;
  get(id: string): AssetDefinition;
  list(): string[];
  export(): AssetManifest;
  refresh(baseURL: string, options?: { replace?: boolean }): Promise<AssetManifest>;
  acquire(ids: string[], options?: { signal?: AssetLoadSignal }): Promise<AssetLease>;
  trim(options?: { all?: boolean }): void;
  stats(): CacheStats;
  progress(ids: string[]): { total: number; loaded: number };
  predownload(ids: string[], options?: PredownloadOptions): Promise<PredownloadProgress>;
  dispose(): void;
}
export function validateAsset(id: string, definition: AssetDefinition): AssetDefinition;
export interface Layer {
  asset: string;
  frame: number;
  region?: Rect;
  replace?: boolean;
}
export interface AnimationSample {
  layers: Layer[];
  frame?: number;
  asset?: string;
  x?: number;
  y?: number;
  altitude?: number;
  scale?: number;
  pulse?: number;
  phase?: string;
  direction?: Direction;
  [extra: string]: unknown;
}
export class AnimationPlan {
  duration: number;
  assetIds: string[];
  destination?: Point;
  targetScale?: number;
  sample(elapsed: number): AnimationSample;
  release(elapsed: number): void;
}
export interface TimelineSegment {
  asset: string;
  frames?: number[];
  durations?: number[];
  repeat?: number;
  speed?: number;
  [extra: string]: unknown;
}
export class Timeline extends AnimationPlan {
  constructor(segments: TimelineSegment[], assets: AssetManager);
  readonly segments: Array<TimelineSegment & { cycle: number; duration: number }>;
}
export class SustainPlan extends AnimationPlan {
  constructor(
    options: {
      open: TimelineSegment;
      loop: TimelineSegment;
      close: TimelineSegment;
      holdMs?: number;
      sustain?: boolean;
    },
    assets: AssetManager
  );
  readonly open: Timeline;
  readonly loop: Timeline;
  readonly close: Timeline;
  readonly closeAt: number;
}
export class CombinedPlan extends AnimationPlan {
  constructor(plans: AnimationPlan[]);
  readonly plans: AnimationPlan[];
}
export class GrowPlan extends AnimationPlan {
  constructor(from: number, to: number, duration?: number);
}
export class MotionPlan extends Timeline {
  constructor(
    segments: TimelineSegment[],
    assets: AssetManager,
    options: { from: Point; to: Point; lift?: number; direction: Direction; mode: 'walk' | 'flight' }
  );
  readonly direction: Direction;
}
export interface PlanContext {
  assets: AssetManager;
  actions: ActionRegistry;
  position: Point;
  scale: number;
  size: number;
  baseSize: number;
  destination(options: PlaybackOptions, action: ActionDefinition, from?: Point): Point;
}
export type PlanBuilder = (
  action: ActionDefinition,
  options: PlaybackOptions,
  context: PlanContext
) => AnimationPlan;
export class PlanFactory {
  register(type: string, builder: PlanBuilder): this;
  build(action: ActionDefinition, options: PlaybackOptions, context: PlanContext): AnimationPlan;
}
export class Playback implements PromiseLike<PlaybackResult> {
  readonly action: string;
  readonly options: PlaybackOptions;
  readonly status: string;
  readonly elapsed: number;
  readonly duration: number;
  readonly ready: Promise<{ action: string; status: 'ready' } | PlaybackResult>;
  readonly finished: Promise<PlaybackResult>;
  readonly result?: PlaybackResult;
  readonly plan?: AnimationPlan;
  cancel(): this;
  release(): this;
  then<TResult1 = PlaybackResult, TResult2 = never>(
    onfulfilled?: ((value: PlaybackResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
}
export interface FreeOptions {
  actions?: string[];
  minDelay?: number;
  maxDelay?: number;
  weights?: Record<string, number>;
  avoidRepeat?: boolean;
}
export class PipiEngine extends Events {
  constructor(options: EngineOptions & { adapter: Adapter });
  readonly ready: Promise<this>;
  readonly destroyed: boolean;
  readonly current: Playback | null;
  readonly position: Point;
  readonly scale: number;
  readonly size: number;
  readonly baseSize: number;
  readonly speed: number;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly paused: boolean;
  readonly visible: boolean;
  readonly actions: ActionRegistry;
  readonly assets: AssetManager;
  readonly plans: PlanFactory;
  readonly renderer: CanvasRenderer;
  snapshot(): EngineSnapshot;
  context(): PlanContext;
  bounds(options?: { lift?: number }): { left: number; right: number; top: number; bottom: number };
  constrain(point: Point, options?: { lift?: number }): Point;
  play(id: string, options?: PlaybackOptions): Playback;
  moveTo(point: Point, options?: PlaybackOptions & { mode?: 'walk' | 'flight' }): Playback;
  growTo(scale: number, options?: PlaybackOptions): Playback;
  stop(options?: { clearQueue?: boolean; reason?: string }): this;
  release(playback?: Playback | null): this;
  pause(): this;
  resume(): this;
  seek(milliseconds: number): this;
  stepFrame(offset?: 1 | -1): this;
  update(milliseconds: number): void;
  setPosition(point: Point): this;
  setPosition(x: number, y: number): this;
  setScale(scale: number): this;
  setSpeed(speed: number): this;
  setVisible(visible: boolean): this;
  resize(width: number, height: number, dpr?: number): this;
  setSpeaking(speaking: boolean): this;
  speak(
    source: string,
    options?: PlaybackOptions & { gesture?: string; timeout?: number }
  ): Promise<PlaybackResult>;
  celebrate(options?: { audio?: string; scale?: number }): Promise<PlaybackResult>;
  startFree(options?: FreeOptions): this;
  stopFree(options?: { cancel?: boolean }): this;
  hitTest(point: Point): boolean;
  /** Approximate Pipi body regions; coordinates use the logical canvas size. */
  hitTestPart(point: Point): 'head' | 'belly' | 'feet' | 'wings' | null;
  pointerDown(point: PointerPoint): boolean | undefined;
  pointerMove(point: PointerPoint): void;
  pointerUp(point: PointerPoint): void;
  pointerCancel(): void;
  registerType(
    type: string,
    handlers: { validate: (action: ActionDefinition) => void; create: PlanBuilder }
  ): this;
  use(plugin: { install(engine: PipiEngine): void | (() => void) }): this;
  exportProject(): Project;
  importProject(project: Project | string, options?: { baseURL?: string }): Promise<this>;
  /** Web: download compressed images without decoding. Cache lasts for this adapter instance. */
  predownload(actions: string[], options?: PredownloadOptions): Promise<PredownloadProgress>;
  preload(actions: string[]): Promise<CacheStats>;
  refreshAssets(baseURL?: string): Promise<this>;
  clearCache(): Promise<CacheStats>;
  destroy(): void;
}
export class CanvasRenderer {
  constructor(adapter: Adapter);
  readonly tileBytes: number;
  resize(width: number, height: number, dpr?: number): void;
  draw(
    state: AnimationSample & { x: number; y: number; size: number },
    assets: AssetLease['assets']
  ): boolean;
  clear(): void;
}
export class WebAdapter implements Adapter {
  constructor(
    canvas: CanvasLike,
    options?: { fetch?: any; window?: any; imageTimeoutMs?: number; imageStallTimeoutMs?: number }
  );
  canvas: CanvasLike;
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
  resize(width: number, height: number, dpr: number): void;
  createCanvas(width: number, height: number): CanvasLike;
  loadImage(
    page: AtlasPage & { url: string },
    baseURL?: string,
    options?: { signal?: AssetLoadSignal }
  ): Promise<ImageLike>;
  prefetchImage(
    page: AtlasPage & { url: string },
    options?: { signal?: AssetLoadSignal }
  ): Promise<{ size: number }>;
  downloadStats(): { pages: number; bytes: number; budget: number };
  releaseImage(image: ImageLike): void;
  fetchManifest(baseURL: string): Promise<AssetManifest>;
  createAudio(source: string, callbacks: { ended: () => void; error: (error: Error) => void }): AudioHandle;
  bind(engine: PipiEngine, options?: { interactive?: boolean }): () => void;
  clearCache(): Promise<void>;
}
export class WechatAdapter implements Adapter {
  constructor(canvas: WechatCanvas, wxApi: WechatAPI);
  canvas: WechatCanvas;
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
  resize(width: number, height: number, dpr: number): void;
  createCanvas(width: number, height: number): CanvasLike;
  loadImage(page: AtlasPage & { url: string }, baseURL?: string): Promise<ImageLike>;
  releaseImage(image: ImageLike): void;
  fetchManifest(baseURL: string): Promise<AssetManifest>;
  createAudio(source: string, callbacks: { ended: () => void; error: (error: Error) => void }): AudioHandle;
  bind(): () => void;
  clearCache(): Promise<void>;
}
export function createWebPet(
  canvas: CanvasLike,
  options?: EngineOptions & { web?: { fetch?: any; window?: any } }
): PipiEngine;
export function createWechatPet(canvas: WechatCanvas, wxApi: WechatAPI, options?: EngineOptions): PipiEngine;
export function createWechatComponent(wxApi: WechatAPI, defaults?: EngineOptions): any;
export const DIRECTIONS: Readonly<Record<Direction, readonly [number, number]>>;
export const DEFAULT_ACTIONS: ActionDefinition[];
export const DEFAULT_ASSET_BASE: string;
export const DEFAULT_AUDIO_BASE: string;
export function installPipiAssets(manager: AssetManager, baseURL?: string): void;
