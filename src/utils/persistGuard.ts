import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage 写入可能失败（隐私模式、配额已满、存储被禁用），
 * 而 zustand persist 默认只在控制台告警、不向外抛错。
 * 这里包一层记录失败次数，让保存流程能明确感知「这次写盘没有成功」，
 * 从而回滚内存状态并提示用户，而不是假装保存完成。
 */
let failureCount = 0;

export function getPersistFailureCount(): number {
  return failureCount;
}

/** 比较动作前后的失败计数，判断这次动作期间是否发生了写盘失败 */
export function persistFailedSince(before: number): boolean {
  return failureCount > before;
}

export const PERSIST_ERROR_MESSAGE =
  '保存失败：浏览器本地存储不可用，内容不会被保留。请检查存储空间或隐私模式设置后重试。';

export const guardedStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // 只计数不外抛：zustand persist 的 .catch 只处理异步 rejection，
      // 同步抛出会直接穿透 store 动作。失败由计数器告知保存流程。
      failureCount++;
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      failureCount++;
    }
  },
};
