import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion } from '../utils/constants';
import {
  getPersistFailureCount,
  guardedStorage,
  persistFailedSince,
} from '../utils/persistGuard';
import { generateId } from '../utils/helpers';
import { mockMemories } from '../data/mockData';

export interface MemoryInput {
  location: string;
  source_guess: string;
  intensity: number;
  humidity: number;
  season: Season;
  smell_type: SmellType;
  memory_text: string;
  color_association: string;
  emotion: Emotion;
  want_again: boolean;
}

interface MemoryStore {
  memories: SmellMemory[];
  /** 返回 false 表示本地存储写入失败，已回滚，调用方应提示用户 */
  addMemory: (input: MemoryInput) => boolean;
  updateMemory: (id: string, input: MemoryInput) => boolean;
  deleteMemory: (id: string) => boolean;
  initIfEmpty: () => void;
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...input,
          created_at: now,
          updated_at: now,
        };
        const prev = get().memories;
        const failBefore = getPersistFailureCount();
        set({ memories: [newMem, ...prev] });
        if (persistFailedSince(failBefore)) {
          set({ memories: prev });
          return false;
        }
        return true;
      },
      updateMemory: (id, input) => {
        const prev = get().memories;
        const failBefore = getPersistFailureCount();
        set({
          memories: prev.map((m) =>
            m.id === id
              ? { ...m, ...input, updated_at: new Date().toISOString() }
              : m,
          ),
        });
        if (persistFailedSince(failBefore)) {
          set({ memories: prev });
          return false;
        }
        return true;
      },
      deleteMemory: (id) => {
        const prev = get().memories;
        const failBefore = getPersistFailureCount();
        set({ memories: prev.filter((m) => m.id !== id) });
        if (persistFailedSince(failBefore)) {
          set({ memories: prev });
          return false;
        }
        return true;
      },
      initIfEmpty: () => {
        if (get().memories.length === 0) {
          set({ memories: mockMemories });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => guardedStorage),
    },
  ),
);
