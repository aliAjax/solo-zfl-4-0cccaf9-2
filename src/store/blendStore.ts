import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BlendIngredient, BlendRecipe, BlendVersion } from '../utils/blend';
import { fingerprint, getCurrentVersion } from '../utils/blend';
import { generateId } from '../utils/helpers';

export type SaveResult =
  | { status: 'created'; recipe: BlendRecipe }
  | { status: 'duplicate'; recipe: BlendRecipe }
  | { status: 'unchanged'; recipe: BlendRecipe }
  | { status: 'error'; message: string };

interface BlendStore {
  recipes: BlendRecipe[];
  /** 新建配方；若已有相同原料和比例的配方，返回 duplicate 并指向它 */
  saveNewRecipe: (name: string, ingredients: BlendIngredient[]) => SaveResult;
  /** 给已有配方追加新版本（配方本体不可改写）；与当前版本相同则不新增 */
  saveNewVersion: (recipeId: string, ingredients: BlendIngredient[], label?: string) => SaveResult;
  /** 回退到历史版本：以旧内容追加一个新版本，历史不丢 */
  revertToVersion: (recipeId: string, versionId: string) => SaveResult;
  renameRecipe: (recipeId: string, name: string) => void;
  deleteRecipe: (recipeId: string) => void;
}

function findByFingerprint(recipes: BlendRecipe[], fp: string, excludeId?: string) {
  return recipes.find(
    (r) => r.id !== excludeId && fingerprint(getCurrentVersion(r).ingredients) === fp,
  );
}

export const useBlendStore = create<BlendStore>()(
  persist(
    (set, get) => ({
      recipes: [],

      saveNewRecipe: (name, ingredients) => {
        const fp = fingerprint(ingredients);
        const dup = findByFingerprint(get().recipes, fp);
        if (dup) return { status: 'duplicate', recipe: dup };

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
        set({ recipes: [recipe, ...get().recipes] });
        return { status: 'created', recipe };
      },

      saveNewVersion: (recipeId, ingredients, label) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return { status: 'error', message: '配方不存在或已被删除' };

        const fp = fingerprint(ingredients);
        if (fp === fingerprint(getCurrentVersion(recipe).ingredients)) {
          return { status: 'unchanged', recipe };
        }
        const dup = findByFingerprint(get().recipes, fp, recipeId);
        if (dup) return { status: 'duplicate', recipe: dup };

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
        set({ recipes: get().recipes.map((r) => (r.id === recipeId ? updated : r)) });
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
        set({ recipes: get().recipes.map((r) => (r.id === recipeId ? updated : r)) });
        return { status: 'created', recipe: updated };
      },

      renameRecipe: (recipeId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set({
          recipes: get().recipes.map((r) =>
            r.id === recipeId ? { ...r, name: trimmed, updated_at: new Date().toISOString() } : r,
          ),
        });
      },

      deleteRecipe: (recipeId) => {
        set({ recipes: get().recipes.filter((r) => r.id !== recipeId) });
      },
    }),
    {
      name: 'scent-blend-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** 当前版本用到了某段档案的配方（用于档案被移除后标记「待修复」） */
export function recipesUsingMemory(recipes: BlendRecipe[], memoryId: string): BlendRecipe[] {
  return recipes.filter((r) =>
    getCurrentVersion(r).ingredients.some((i) => i.memoryId === memoryId),
  );
}
