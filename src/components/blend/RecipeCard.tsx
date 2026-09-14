import { useState } from 'react';
import {
  FlaskConical,
  History,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import type { BlendRecipe, BlendVersion } from '../../utils/blend';
import { computeBlend, getCurrentVersion, resolveIngredients } from '../../utils/blend';
import { getSeasonInfo, getEmotionInfo } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import { useMemoryStore } from '../../store/memoryStore';

interface Props {
  recipe: BlendRecipe;
  onLoad: (recipe: BlendRecipe, version: BlendVersion) => void;
  onRevert: (recipe: BlendRecipe, version: BlendVersion) => void;
  onRename: (recipeId: string, name: string) => void;
  onDelete: (recipe: BlendRecipe) => void;
}

export default function RecipeCard({ recipe, onLoad, onRevert, onRename, onDelete }: Props) {
  const memories = useMemoryStore((s) => s.memories);
  const [showHistory, setShowHistory] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(recipe.name);

  const current = getCurrentVersion(recipe);
  const resolved = resolveIngredients(current.ingredients, memories);
  const result = computeBlend(resolved);
  const missingCount = resolved.filter((r) => r.missing).length;
  const broken = missingCount > 0;

  const season = result ? getSeasonInfo(result.season.value) : null;
  const emotion = result ? getEmotionInfo(result.emotion.value) : null;

  const commitRename = () => {
    setRenaming(false);
    if (nameDraft.trim() && nameDraft.trim() !== recipe.name) {
      onRename(recipe.id, nameDraft);
    } else {
      setNameDraft(recipe.name);
    }
  };

  return (
    <article
      data-recipe-id={recipe.id}
      className={`bg-paper-50/80 backdrop-blur rounded-3xl border shadow-card p-5 transition-colors ${
        broken ? 'border-brick-400/50' : 'border-paper-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-2xl border-2 border-paper-50 shadow-sm shrink-0"
          style={{ backgroundColor: result?.color ?? '#E0D1B3' }}
          title={result?.color}
        />
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setNameDraft(recipe.name); setRenaming(false); }
                }}
                className="scent-input px-2.5 py-1.5 text-sm font-semibold flex-1 min-w-0"
              />
              <button onClick={commitRename} className="p-1.5 rounded-lg text-moss-500 hover:bg-moss-100" aria-label="确认重命名">
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setNameDraft(recipe.name); setRenaming(false); }}
                className="p-1.5 rounded-lg text-ink-700/50 hover:bg-paper-200"
                aria-label="取消重命名"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-lg font-semibold text-ink-800 truncate">{recipe.name}</h3>
              <span className="px-2 py-0.5 rounded-full bg-ochre-100 text-ochre-600 text-[11px] font-semibold">
                v{current.version}
              </span>
              {broken && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brick-500/15 text-brick-600 text-[11px] font-semibold">
                  <AlertTriangle className="w-3 h-3" /> 待修复
                </span>
              )}
            </div>
          )}
          <p className="text-[11px] text-ink-700/50 mt-1">
            更新于 {formatDate(recipe.updated_at)} · 共 {recipe.versions.length} 个版本
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {resolved.map((ing) => (
          <span
            key={ing.memoryId}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
              ing.missing
                ? 'border-dashed border-brick-400/60 bg-brick-500/5 text-brick-600'
                : 'border-paper-200 bg-paper-100 text-ink-700'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ing.color }} />
            {ing.location} {ing.ratio}%
          </span>
        ))}
      </div>

      {result && season && emotion && (
        <p className="mt-3 text-xs text-ink-700/65">
          强度 {result.intensity} · 湿度 {result.humidity} · {season.emoji}{season.label}季 · {emotion.emoji}{emotion.label}
        </p>
      )}

      {broken && (
        <p className="mt-2 text-xs text-brick-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {missingCount} 种原料的档案已移除，载入调香台换入其他原料即可修复
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-paper-200/80 flex items-center gap-1 flex-wrap">
        <button
          onClick={() => onLoad(recipe, current)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-paper-50 bg-ochre-500 hover:bg-ochre-600 transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          {broken ? '载入并修复' : '载入调香台'}
        </button>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-paper-200 transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          历史
          {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <button
          onClick={() => { setNameDraft(recipe.name); setRenaming(true); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-paper-200 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          重命名
        </button>
        <button
          onClick={() => onDelete(recipe)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-brick-500 hover:bg-brick-500/10 transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </button>
      </div>

      {showHistory && (
        <div className="mt-3 rounded-2xl bg-paper-100/70 border border-paper-200 divide-y divide-paper-200/80 overflow-hidden animate-expand">
          {[...recipe.versions].reverse().map((v) => {
            const isCurrent = v.id === recipe.currentVersionId;
            return (
              <div key={v.id} className="flex items-center gap-2 px-3 py-2.5 text-xs">
                <span className={`shrink-0 px-2 py-0.5 rounded-full font-semibold ${
                  isCurrent ? 'bg-ochre-500 text-paper-50' : 'bg-paper-200 text-ink-700'
                }`}>
                  v{v.version}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-ink-700/80 truncate">
                    {v.ingredients.map((i) => `${i.snapshot.location} ${i.ratio}%`).join(' + ')}
                  </div>
                  <div className="text-ink-700/45 mt-0.5">
                    {formatDate(v.created_at)}
                    {v.label ? ` · ${v.label}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isCurrent ? (
                    <span className="text-ochre-600 font-medium px-1">当前</span>
                  ) : (
                    <>
                      <button
                        onClick={() => onLoad(recipe, v)}
                        className="px-2 py-1 rounded-lg text-ochre-600 hover:bg-ochre-100 font-medium transition-colors"
                      >
                        载入
                      </button>
                      <button
                        onClick={() => onRevert(recipe, v)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-moss-500 hover:bg-moss-100 font-medium transition-colors"
                        title="以此版本内容生成新版本"
                      >
                        <RotateCcw className="w-3 h-3" />
                        回退
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
