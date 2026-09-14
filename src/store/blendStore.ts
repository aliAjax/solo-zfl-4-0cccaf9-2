import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BlendIngredient, BlendRecipe, BlendVersion } from '../utils/blend';
import { findDuplicateVersion, fingerprint, getCurrentVersion } from '../utils/blend';
import {
  PERSIST_ERROR_MESSAGE,
  getPersistFailureCount,
  guardedStorage,
  persistFailedSince,
} from '../utils/persistGuard';
import { generateId } from '../utils/helpers';

export type SaveResult =
  | { status: 'created'; recipe: BlendRecipe }
  | { status: 'duplicate'; recipe: BlendRecipe; version: BlendVersion }
  | { status: 'unchanged'; recipe: BlendRecipe }
  | { status: 'error'; message: string };

interface BlendStore {
  recipes: BlendRecipe[];
  /** 新建配方；若任意配方的任意历史版本有相同原料和比例，返回 duplicate 并指向它 */
  saveNewRecipe: (name: string, ingredients: BlendIngredient[]) => SaveResult;
  /** 给已有配方追加新版本（配方本体不可改写）；与当前版本相同则不新增 */
  saveNewVersion: (recipeId: string, ingredients: BlendIngredient[], label?: string) => SaveResult;
  /** 回退到历史版本：以旧内容追加一个新版本，历史不丢 */
  revertToVersion: (recipeId: string, versionId: string) => SaveResult;
  /** 返回 null 表示成功，否则为失败原因（写盘失败会回滚） */
  renameRecipe: (recipeId: string, name: string) => string | null;
  deleteRecipe: (recipeId: string) => string | null;
}

export const useBlendStore = create<BlendStore>()(
  persist(
    (set, get) => ({
      recipes: [],

      saveNewRecipe: (name, ingredients) => {
        const dup = findDuplicateVersion(get().recipes, ingredients);
        if (dup) return { status: 'duplicate', recipe: dup.recipe, version: dup.version };

        const now = new Date().toISOString();
        const v1: BlendVersion = { id: generateId(), version: 1, ingredients, created_at: now };
        const recipe: BlendRecipe = {
          id: generateId(),
          name: name.trim() || '未命名配方',
          versions: [v1],
          currentVersionId: v1.id,
          created_at: now,
          updated_at: now,
        };
        const prev = get().recipes;
        const failBefore = getPersistFailureCount();
        set({ recipes: [recipe, ...prev] });
        if (persistFailedSince(failBefore)) {
          set({ recipes: prev }); // 写盘失败：回滚，不假装保存完成
          return { status: 'error', message: PERSIST_ERROR_MESSAGE };
        }
        return { status: 'created', recipe };
      },

      saveNewVersion: (recipeId, ingredients, label) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return { status: 'error', message: '配方不存在或已被删除' };

        if (fingerprint(ingredients) === fingerprint(getCurrentVersion(recipe).ingredients)) {
          return { status: 'unchanged', recipe };
        }
        const dup = findDuplicateVersion(get().recipes, ingredients, recipeId);
        if (dup) return { status: 'duplicate', recipe: dup.recipe, version: dup.version };

        const now = new Date().toISOString();
        const next: BlendVersion = {
          id: generateId(),
          version: recipe.versions.length + 1,
          ingredients,
          label,
          created_at: now,
        };
        const updated: BlendRecipe = {
          ...recipe,
          versions: [...recipe.versions, next],
          currentVersionId: next.id,
          updated_at: now,
        };
        const prev = get().recipes;
        const failBefore = getPersistFailureCount();
        set({ recipes: prev.map((r) => (r.id === recipeId ? updated : r)) });
        if (persistFailedSince(failBefore)) {
          set({ recipes: prev });
          return { status: 'error', message: PERSIST_ERROR_MESSAGE };
        }
        return { status: 'created', recipe: updated };
      },

      revertToVersion: (recipeId, versionId) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return { status: 'error', message: '配方不存在或已被删除' };
        const target = recipe.versions.find((v) => v.id === versionId);
        if (!target) return { status: 'error', message: '找不到这个历史版本' };

        if (fingerprint(target.ingredients) === fingerprint(getCurrentVersion(recipe).ingredients)) {
          return { status: 'unchanged', recipe };
        }

        const now = new Date().toISOString();
        const next: BlendVersion = {
          id: generateId(),
          version: recipe.versions.length + 1,
          ingredients: target.ingredients.map((i) => ({ ...i, snapshot: { ...i.snapshot } })),
          label: `回退自 v${target.version}`,
          created_at: now,
        };
        const updated: BlendRecipe = {
          ...recipe,
          versions: [...recipe.versions, next],
          currentVersionId: next.id,
          updated_at: now,
        };
        const prev = get().recipes;
        const failBefore = getPersistFailureCount();
        set({ recipes: prev.map((r) => (r.id === recipeId ? updated : r)) });
        if (persistFailedSince(failBefore)) {
          set({ recipes: prev });
          return { status: 'error', message: PERSIST_ERROR_MESSAGE };
        }
        return { status: 'created', recipe: updated };
      },

      renameRecipe: (recipeId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return '名字不能为空';
        const prev = get().recipes;
        const failBefore = getPersistFailureCount();
        set({
          recipes: prev.map((r) =>
            r.id === recipeId ? { ...r, name: trimmed, updated_at: new Date().toISOString() } : r,
          ),
        });
        if (persistFailedSince(failBefore)) {
          set({ recipes: prev });
          return PERSIST_ERROR_MESSAGE;
        }
        return null;
      },

      deleteRecipe: (recipeId) => {
        const prev = get().recipes;
        const failBefore = getPersistFailureCount();
        set({ recipes: prev.filter((r) => r.id !== recipeId) });
        if (persistFailedSince(failBefore)) {
          set({ recipes: prev });
          return PERSIST_ERROR_MESSAGE;
        }
        return null;
      },
    }),
    {
      name: 'scent-blend-storage',
      storage: createJSONStorage(() => guardedStorage),
    },
  ),
);

/** 当前版本用到了某段档案的配方（用于档案被移除后标记「待修复」） */
export function recipesUsingMemory(recipes: BlendRecipe[], memoryId: string): BlendRecipe[] {
  return recipes.filter((r) =>
    getCurrentVersion(r).ingredients.some((i) => i.memoryId === memoryId),
  );
}
