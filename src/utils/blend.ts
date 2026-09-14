import type { SmellMemory, Season, Emotion } from './constants';
import { SEASONS, EMOTIONS } from './constants';
import { hexToRgb } from './helpers';

export const MIN_INGREDIENTS = 2;
export const MAX_INGREDIENTS = 5;
export const RATIO_TOTAL = 100;

/** 保存配方时为原料拍下的快照：档案被移除后，历史版本依然可读、可计算 */
export interface IngredientSnapshot {
  location: string;
  intensity: number;
  humidity: number;
  season: Season;
  emotion: Emotion;
  color: string;
}

export interface BlendIngredient {
  memoryId: string;
  /** 正整数，全部原料之和须为 100 */
  ratio: number;
  snapshot: IngredientSnapshot;
}

export interface BlendVersion {
  id: string;
  version: number;
  ingredients: BlendIngredient[];
  /** 版本备注，例如「回退自 v2」「修复：换入新原料」 */
  label?: string;
  created_at: string;
}

export interface BlendRecipe {
  id: string;
  name: string;
  /** 只增不改，历史全部保留 */
  versions: BlendVersion[];
  currentVersionId: string;
  created_at: string;
  updated_at: string;
}

export function toBlendIngredient(memory: SmellMemory, ratio: number): BlendIngredient {
  return {
    memoryId: memory.id,
    ratio,
    snapshot: {
      location: memory.location,
      intensity: memory.intensity,
      humidity: memory.humidity,
      season: memory.season,
      emotion: memory.emotion,
      color: memory.color_association,
    },
  };
}

/** 原料 + 比例的指纹：用于「相同配方重复保存时打开已有配方」 */
export function fingerprint(ingredients: BlendIngredient[]): string {
  return ingredients
    .map((i) => `${i.memoryId}:${i.ratio}`)
    .sort()
    .join('|');
}

export function getCurrentVersion(recipe: BlendRecipe): BlendVersion {
  return (
    recipe.versions.find((v) => v.id === recipe.currentVersionId) ??
    recipe.versions[recipe.versions.length - 1]
  );
}

export function sumRatios(ingredients: { ratio: number }[]): number {
  return ingredients.reduce((s, i) => s + i.ratio, 0);
}

/** 返回 null 表示可以保存，否则为具体原因 */
export function validateIngredients(ingredients: BlendIngredient[]): string | null {
  if (ingredients.length < MIN_INGREDIENTS) return `至少选择 ${MIN_INGREDIENTS} 种原料`;
  if (ingredients.length > MAX_INGREDIENTS) return `最多选择 ${MAX_INGREDIENTS} 种原料`;
  if (ingredients.some((i) => !Number.isInteger(i.ratio) || i.ratio < 1)) {
    return '每种原料的比例须为正整数';
  }
  const total = sumRatios(ingredients);
  if (total !== RATIO_TOTAL) {
    return total < RATIO_TOTAL
      ? `比例总和还差 ${RATIO_TOTAL - total}`
      : `比例总和超出 ${total - RATIO_TOTAL}`;
  }
  return null;
}

/** 把 100 尽量均匀地分给 n 份，例如 3 → [34, 33, 33] */
export function evenSplit(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(RATIO_TOTAL / n);
  const extra = RATIO_TOTAL - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export interface ResolvedIngredient extends IngredientSnapshot {
  memoryId: string;
  ratio: number;
  /** 原料档案已被移除，展示与计算回退到快照 */
  missing: boolean;
}

/** 工作台草稿：档案还在就用实时数据（所见即所调），被移除则回退到快照 */
export function resolveLive(
  ingredients: BlendIngredient[],
  memories: SmellMemory[],
): ResolvedIngredient[] {
  return ingredients.map((ing) => {
    const mem = memories.find((m) => m.id === ing.memoryId);
    if (mem) {
      return {
        memoryId: ing.memoryId,
        ratio: ing.ratio,
        missing: false,
        location: mem.location,
        intensity: mem.intensity,
        humidity: mem.humidity,
        season: mem.season,
        emotion: mem.emotion,
        color: mem.color_association,
      };
    }
    return { memoryId: ing.memoryId, ratio: ing.ratio, missing: true, ...ing.snapshot };
  });
}

/**
 * 已保存的版本：始终按保存时的快照显示和计算。
 * 原始档案之后的编辑不影响历史，只有「档案被移除」这一事实需要实时判断。
 */
export function resolveSnapshots(
  ingredients: BlendIngredient[],
  memories: SmellMemory[],
): ResolvedIngredient[] {
  return ingredients.map((ing) => ({
    memoryId: ing.memoryId,
    ratio: ing.ratio,
    missing: !memories.some((m) => m.id === ing.memoryId),
    ...ing.snapshot,
  }));
}

/** 保存瞬间刷新快照：档案还在的取当前值，已移除的保留最后已知快照——所见即所存 */
export function refreshSnapshots(
  ingredients: BlendIngredient[],
  memories: SmellMemory[],
): BlendIngredient[] {
  return ingredients.map((ing) => {
    const mem = memories.find((m) => m.id === ing.memoryId);
    return mem ? toBlendIngredient(mem, ing.ratio) : ing;
  });
}

/** 在全部配方的全部历史版本中查找相同原料和比例（当前版本优先命中） */
export function findDuplicateVersion(
  recipes: BlendRecipe[],
  ingredients: BlendIngredient[],
  excludeRecipeId?: string,
): { recipe: BlendRecipe; version: BlendVersion } | null {
  const fp = fingerprint(ingredients);
  const candidates = recipes.filter((r) => r.id !== excludeRecipeId);
  for (const recipe of candidates) {
    const current = getCurrentVersion(recipe);
    if (fingerprint(current.ingredients) === fp) return { recipe, version: current };
  }
  for (const recipe of candidates) {
    for (const version of recipe.versions) {
      if (fingerprint(version.ingredients) === fp) return { recipe, version };
    }
  }
  return null;
}

export interface BlendResult {
  total: number;
  intensity: number;
  humidity: number;
  season: { value: Season; share: number };
  emotion: { value: Emotion; share: number };
  color: string;
}

function topOf<T extends string>(weights: Map<T, number>, order: readonly T[]): { value: T; share: number } {
  let best = order[0];
  let bestV = -1;
  for (const key of order) {
    const v = weights.get(key) ?? 0;
    if (v > bestV) {
      bestV = v;
      best = key;
    }
  }
  return { value: best, share: bestV };
}

/** 按比例实时调和：加权强度/湿度、占比最高的季节与情绪、加权混色 */
export function computeBlend(ingredients: ResolvedIngredient[]): BlendResult | null {
  const total = sumRatios(ingredients);
  if (ingredients.length === 0 || total <= 0) return null;

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const intensity = ingredients.reduce((s, i) => s + i.intensity * i.ratio, 0) / total;
  const humidity = ingredients.reduce((s, i) => s + i.humidity * i.ratio, 0) / total;

  const seasonWeights = new Map<Season, number>();
  const emotionWeights = new Map<Emotion, number>();
  let r = 0;
  let g = 0;
  let b = 0;
  for (const ing of ingredients) {
    seasonWeights.set(ing.season, (seasonWeights.get(ing.season) ?? 0) + ing.ratio);
    emotionWeights.set(ing.emotion, (emotionWeights.get(ing.emotion) ?? 0) + ing.ratio);
    const c = hexToRgb(ing.color);
    r += c.r * ing.ratio;
    g += c.g * ing.ratio;
    b += c.b * ing.ratio;
  }
  const channel = (v: number) =>
    Math.round(v / total)
      .toString(16)
      .padStart(2, '0');

  return {
    total,
    intensity: round1(intensity),
    humidity: round1(humidity),
    season: topOf(seasonWeights, SEASONS.map((s) => s.value)),
    emotion: topOf(emotionWeights, EMOTIONS.map((e) => e.value)),
    color: `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase(),
  };
}

export function humidityLabel(v: number): string {
  if (v <= 3) return '偏干';
  if (v <= 6) return '适中';
  return '偏湿';
}
