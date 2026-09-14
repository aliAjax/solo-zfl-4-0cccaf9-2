import { Plus, Minus, X, RefreshCw, AlertTriangle, FlaskConical, Trash2 } from 'lucide-react';
import type { BlendIngredient } from '../../utils/blend';
import {
  MAX_INGREDIENTS,
  MIN_INGREDIENTS,
  RATIO_TOTAL,
  resolveLive,
  sumRatios,
  validateIngredients,
} from '../../utils/blend';
import { useMemoryStore } from '../../store/memoryStore';

interface Props {
  draft: BlendIngredient[];
  editingName: string | null;
  baseVersion: number | null;
  onSetRatio: (memoryId: string, ratio: number) => void;
  onRemove: (memoryId: string) => void;
  onRequestSwap: (memoryId: string) => void;
  onRequestAdd: () => void;
  onEvenSplit: () => void;
  onClear: () => void;
}

export default function Workbench({
  draft,
  editingName,
  baseVersion,
  onSetRatio,
  onRemove,
  onRequestSwap,
  onRequestAdd,
  onEvenSplit,
  onClear,
}: Props) {
  const memories = useMemoryStore((s) => s.memories);
  const resolved = resolveLive(draft, memories);
  const total = sumRatios(draft);
  const error = validateIngredients(draft);
  const missingCount = resolved.filter((r) => r.missing).length;

  return (
    <section className="bg-paper-50/80 backdrop-blur rounded-3xl border border-paper-300 shadow-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            调香工作台
          </h2>
          <p className="text-xs text-ink-700/55 mt-1">
            {editingName
              ? `正在编辑「${editingName}」 · 基于 v${baseVersion}，保存将生成新版本`
              : `选 ${MIN_INGREDIENTS}~${MAX_INGREDIENTS} 种气味档案作原料，比例为正整数、总和 ${RATIO_TOTAL}`}
          </p>
        </div>
        {draft.length > 0 && (
          <button
            onClick={onClear}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ink-700/60 hover:text-brick-500 hover:bg-brick-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> 清空
          </button>
        )}
      </div>

      {missingCount > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-brick-500/10 border border-brick-400/40 px-3 py-2.5 text-xs text-brick-600">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            有 {missingCount} 种原料的档案已被移除。点「换料」换入其他档案，或移除该原料，保存后配方即修复。
          </span>
        </div>
      )}

      <div className="space-y-3">
        {resolved.map((ing) => (
          <div
            key={ing.memoryId}
            className={`rounded-2xl border p-3 transition-colors ${
              ing.missing
                ? 'border-dashed border-brick-400/60 bg-brick-500/5'
                : 'border-paper-300 bg-paper-100/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 rounded-full shrink-0 border border-paper-50 shadow-sm"
                style={{ backgroundColor: ing.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`font-serif font-semibold text-sm truncate ${ing.missing ? 'text-brick-500' : 'text-ink-800'}`}>
                    {ing.location}
                  </span>
                  {ing.missing && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-brick-500/15 text-brick-600 text-[10px] font-medium">
                      <AlertTriangle className="w-3 h-3" /> 档案已移除
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-700/50">
                  强度 {ing.intensity} · 湿度 {ing.humidity}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onSetRatio(ing.memoryId, ing.ratio - 1)}
                  disabled={ing.ratio <= 1}
                  className="w-8 h-8 rounded-lg bg-paper-200 hover:bg-paper-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-ink-700 transition-colors"
                  aria-label="减少比例"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={ing.ratio}
                    onChange={(e) => onSetRatio(ing.memoryId, Number(e.target.value))}
                    className="scent-input w-16 px-1.5 py-1.5 text-center font-semibold"
                    aria-label={`${ing.location} 的比例`}
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-700/40 pointer-events-none">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSetRatio(ing.memoryId, ing.ratio + 1)}
                  className="w-8 h-8 rounded-lg bg-paper-200 hover:bg-paper-300 flex items-center justify-center text-ink-700 transition-colors"
                  aria-label="增加比例"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onRequestSwap(ing.memoryId)}
                  className={`p-2 rounded-lg transition-colors ${
                    ing.missing
                      ? 'text-brick-500 hover:bg-brick-500/10'
                      : 'text-ink-700/50 hover:text-ochre-600 hover:bg-ochre-100'
                  }`}
                  title="换入其他原料"
                  aria-label="换入其他原料"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(ing.memoryId)}
                  className="p-2 rounded-lg text-ink-700/50 hover:text-brick-500 hover:bg-brick-500/10 transition-colors"
                  title="移除该原料"
                  aria-label="移除该原料"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <input
              type="range"
              min={1}
              max={99}
              step={1}
              value={ing.ratio}
              onChange={(e) => onSetRatio(ing.memoryId, Number(e.target.value))}
              className="scent-slider mt-2.5"
              aria-label={`${ing.location} 的比例滑杆`}
            />
          </div>
        ))}
      </div>

      {draft.length < MAX_INGREDIENTS && (
        <button
          type="button"
          onClick={onRequestAdd}
          className="mt-3 w-full py-3 rounded-2xl border-2 border-dashed border-paper-400 text-ink-700/60 hover:text-ochre-600 hover:border-ochre-300 hover:bg-ochre-50 transition-colors inline-flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          添加原料（{draft.length}/{MAX_INGREDIENTS}）
        </button>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${
            total === RATIO_TOTAL
              ? 'bg-moss-100 text-moss-600 border-moss-200'
              : 'bg-brick-500/10 text-brick-600 border-brick-400/40'
          }`}
        >
          已分配 {total} / {RATIO_TOTAL}
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-brick-500">{error}</span>}
          {draft.length >= 2 && (
            <button
              type="button"
              onClick={onEvenSplit}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-paper-200 hover:bg-paper-300 text-ink-700 transition-colors"
            >
              平均分配
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
