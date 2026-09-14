import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import type { ToastType } from '../store/toastStore';

const STYLE: Record<ToastType, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'bg-moss-500 text-paper-50' },
  error: { icon: AlertCircle, cls: 'bg-brick-500 text-paper-50' },
  info: { icon: Info, cls: 'bg-ink-800 text-paper-50' },
};

export default function Toasts() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-5 z-[80] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => {
        const { icon: Icon, cls } = STYLE[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 max-w-md w-auto rounded-2xl px-4 py-3 shadow-paper-hover text-sm font-medium animate-fadeInUp ${cls}`}
            role="alert"
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="leading-snug">{t.text}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-1 p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
              aria-label="关闭提示"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
