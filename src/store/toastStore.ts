import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  text: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (type: ToastType, text: string) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToastStore = create<ToastStore>()((set, get) => ({
  toasts: [],
  push: (type, text) => {
    const id = seq++;
    set({ toasts: [...get().toasts, { id, type, text }] });
    // 错误提示停留更久，确保用户看得到
    setTimeout(() => get().dismiss(id), type === 'error' ? 6000 : 3600);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** 非组件环境也能用：toast.success('...') */
export const toast = {
  success: (text: string) => useToastStore.getState().push('success', text),
  error: (text: string) => useToastStore.getState().push('error', text),
  info: (text: string) => useToastStore.getState().push('info', text),
};
