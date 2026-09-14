import { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, FlaskConical } from 'lucide-react';
import NavTabs from '../components/NavTabs';
import Workbench from '../components/blend/Workbench';
import ResultPanel from '../components/blend/ResultPanel';
import RecipeCard from '../components/blend/RecipeCard';
import IngredientPicker from '../components/blend/IngredientPicker';
import { useMemoryStore } from '../store/memoryStore';
import { useBlendStore } from '../store/blendStore';
import { toast } from '../store/toastStore';
import type { SmellMemory } from '../utils/constants';
import type { BlendIngredient, BlendRecipe, BlendVersion } from '../utils/blend';
import {
  MAX_INGREDIENTS,
  RATIO_TOTAL,
  computeBlend,
  evenSplit,
  getCurrentVersion,
  refreshSnapshots,
  resolveLive,
  toBlendIngredient,
  validateIngredients,
} from '../utils/blend';

interface EditingCtx {
  recipeId: string;
  name: string;
  baseVersion: number;
}

type PickerState = { mode: 'add' } | { mode: 'swap'; memoryId: string } | null;

const cloneIngredients = (ings: BlendIngredient[]): BlendIngredient[] =>
  ings.map((i) => ({ ...i, snapshot: { ...i.snapshot } }));

export default function Blender() {
  const { memories, initIfEmpty } = useMemoryStore();
  const {
    recipes,
    saveNewRecipe,
    saveNewVersion,
    revertToVersion,
    renameRecipe,
    deleteRecipe,
  } = useBlendStore();

  const [draft, setDraft] = useState<BlendIngredient[]>([]);
  const [editing, setEditing] = useState<EditingCtx | null>(null);
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [name, setName] = useState('');
  const [picker, setPicker] = useState<PickerState>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ recipeId: string; versionId: string } | null>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  const resolved = useMemo(() => resolveLive(draft, memories), [draft, memories]);
  const result = useMemo(() => computeBlend(resolved), [resolved]);

  useEffect(() => {
    if (!highlightId) return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-recipe-id="${highlightId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [highlightId]);

  /* ---------- 工作台操作 ---------- */

  const addIngredient = (memory: SmellMemory) => {
    if (draft.length >= MAX_INGREDIENTS) {
      toast.error(`最多选择 ${MAX_INGREDIENTS} 种原料`);
      return;
    }
    if (draft.some((d) => d.memoryId === memory.id)) {
      toast.info('该原料已在调香台上');
      return;
    }
    setDraft((prev) => {
      if (prev.length === 0) return [toBlendIngredient(memory, RATIO_TOTAL)];
      const ing = toBlendIngredient(memory, 10);
      const idx = prev.reduce((mi, cur, i, arr) => (cur.ratio > arr[mi].ratio ? i : mi), 0);
      const next = prev.map((d, i) =>
        i === idx && d.ratio > 10 ? { ...d, ratio: d.ratio - 10 } : d,
      );
      return [...next, ing];
    });
  };

  const setRatio = (memoryId: string, ratio: number) => {
    const v = Number.isFinite(ratio) ? Math.round(ratio) : 1;
    const clamped = Math.max(1, Math.min(99, v));
    setDraft((prev) => prev.map((d) => (d.memoryId === memoryId ? { ...d, ratio: clamped } : d)));
  };

  const removeIngredient = (memoryId: string) => {
    setDraft((prev) => {
      const target = prev.find((d) => d.memoryId === memoryId);
      const rest = prev.filter((d) => d.memoryId !== memoryId);
      if (!target || rest.length === 0) return rest;
      const idx = rest.reduce((mi, cur, i, arr) => (cur.ratio > arr[mi].ratio ? i : mi), 0);
      return rest.map((d, i) => (i === idx ? { ...d, ratio: d.ratio + target.ratio } : d));
    });
  };

  const swapIngredient = (oldId: string, memory: SmellMemory) => {
    if (draft.some((d) => d.memoryId === memory.id)) {
      toast.info('该原料已在调香台上');
      return;
    }
    setDraft((prev) =>
      prev.map((d) => (d.memoryId === oldId ? toBlendIngredient(memory, d.ratio) : d)),
    );
  };

  const handleEvenSplit = () => {
    setDraft((prev) => {
      const shares = evenSplit(prev.length);
      return prev.map((d, i) => ({ ...d, ratio: shares[i] ?? d.ratio }));
    });
  };

  const clearWorkbench = () => {
    setDraft([]);
    setEditing(null);
    setSaveAsNew(false);
    setName('');
  };

  const handlePickerSelect = (memory: SmellMemory) => {
    if (picker?.mode === 'swap') {
      swapIngredient(picker.memoryId, memory);
    } else {
      addIngredient(memory);
    }
    setPicker(null);
  };

  /* ---------- 配方操作 ---------- */

  const openExisting = (recipe: BlendRecipe, matchedVersion?: BlendVersion) => {
    const current = getCurrentVersion(recipe);
    setEditing({ recipeId: recipe.id, name: recipe.name, baseVersion: current.version });
    setSaveAsNew(false);
    setHighlightId(recipe.id);
    // 命中的是历史版本时，展开该配方的历史并高亮对应版本
    if (matchedVersion && matchedVersion.id !== recipe.currentVersionId) {
      setReveal({ recipeId: recipe.id, versionId: matchedVersion.id });
    } else {
      setReveal(null);
    }
  };

  const loadVersion = (recipe: BlendRecipe, version: BlendVersion) => {
    setDraft(cloneIngredients(version.ingredients));
    setEditing({ recipeId: recipe.id, name: recipe.name, baseVersion: version.version });
    setSaveAsNew(false);
    toast.info(`已载入「${recipe.name}」v${version.version}，保存修改会生成新版本`);
    workbenchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSave = () => {
    const err = validateIngredients(draft);
    if (err) {
      toast.error(`还不能保存：${err}`);
      return;
    }
    // 保存瞬间刷新快照：档案还在的取当前值，已移除的保留最后已知快照
    const fresh = refreshSnapshots(draft, memories);

    if (editing && !saveAsNew) {
      const res = saveNewVersion(editing.recipeId, fresh);
      if (res.status === 'created') {
        const v = getCurrentVersion(res.recipe);
        toast.success(`已保存为「${res.recipe.name}」的 v${v.version}`);
        setEditing({ recipeId: res.recipe.id, name: res.recipe.name, baseVersion: v.version });
        setHighlightId(res.recipe.id);
        setReveal(null);
      } else if (res.status === 'unchanged') {
        toast.info('与当前版本完全相同，未生成新版本');
      } else if (res.status === 'duplicate') {
        toast.info(`与配方「${res.recipe.name}」的 v${res.version.version} 相同，已为你打开它`);
        openExisting(res.recipe, res.version);
      } else {
        toast.error(res.message); // 写盘失败等：不改动任何编辑状态，可修复后重试
      }
      return;
    }

    if (!name.trim()) {
      toast.error('先给配方起个名字吧');
      return;
    }
    const res = saveNewRecipe(name, fresh);
    if (res.status === 'created') {
      toast.success(`配方「${res.recipe.name}」已封存`);
      setEditing({ recipeId: res.recipe.id, name: res.recipe.name, baseVersion: 1 });
      setSaveAsNew(false);
      setName('');
      setHighlightId(res.recipe.id);
      setReveal(null);
    } else if (res.status === 'duplicate') {
      toast.info(`已存在相同配方「${res.recipe.name}」（v${res.version.version}），已为你打开`);
      openExisting(res.recipe, res.version);
    } else if (res.status === 'error') {
      toast.error(res.message);
    }
  };

  const handleRevert = (recipe: BlendRecipe, version: BlendVersion) => {
    const res = revertToVersion(recipe.id, version.id);
    if (res.status === 'created') {
      const v = getCurrentVersion(res.recipe);
      toast.success(`已按 v${version.version} 的内容生成新版本 v${v.version}，历史已保留`);
      setHighlightId(recipe.id);
      setReveal(null);
      if (editing?.recipeId === recipe.id) {
        setEditing({ recipeId: recipe.id, name: res.recipe.name, baseVersion: v.version });
        setDraft(cloneIngredients(v.ingredients));
      }
    } else if (res.status === 'unchanged') {
      toast.info('当前版本已与该版本一致，无需回退');
    } else if (res.status === 'error') {
      toast.error(res.message);
    } else {
      toast.error('回退失败，请重试');
    }
  };

  const handleRename = (recipeId: string, newName: string) => {
    if (!newName.trim()) {
      toast.error('名字不能为空');
      return;
    }
    const err = renameRecipe(recipeId, newName);
    if (err) {
      toast.error(err);
      return;
    }
    if (editing?.recipeId === recipeId) {
      setEditing({ ...editing, name: newName.trim() });
    }
    toast.success('已重命名');
  };

  const handleDeleteRecipe = (recipe: BlendRecipe) => {
    const ok = window.confirm(
      `确认删除配方「${recipe.name}」吗？全部 ${recipe.versions.length} 个版本的历史也会一并删除。`,
    );
    if (!ok) return;
    const err = deleteRecipe(recipe.id);
    if (err) {
      toast.error(err);
      return;
    }
    if (editing?.recipeId === recipe.id) setEditing(null);
    toast.info('配方已删除');
  };

  /* ---------- 渲染 ---------- */

  return (
    <div className="min-h-screen">
      <header className="relative pt-10 pb-2 md:pt-14">
        <div className="container max-w-6xl">
          <div className="relative">
            <div className="absolute -left-2 -top-7 text-6xl md:text-7xl opacity-10 select-none pointer-events-none font-serif text-ochre-500">
              调
            </div>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-ink-800 leading-tight relative z-10 flex items-center gap-3">
              调香台
              <FlaskConical className="w-7 h-7 md:w-9 md:h-9 text-ochre-500" />
            </h1>
            <p className="mt-2 font-hand text-lg md:text-xl text-ink-700/70 pl-1 relative z-10">
              把几段气味按配方调和，看看它们会变成什么
            </p>
          </div>
          <NavTabs />
          <div
            className="mt-6 h-px w-full"
            style={{ background: 'linear-gradient(90deg, transparent 0%, #CBB993 20%, #CBB993 80%, transparent 100%)' }}
          />
        </div>
      </header>

      <main className="container max-w-6xl pb-20 pt-6">
        <div ref={workbenchRef} className="grid lg:grid-cols-[1fr_360px] gap-6 items-start scroll-mt-4">
          <Workbench
            draft={draft}
            editingName={editing && !saveAsNew ? editing.name : null}
            baseVersion={editing?.baseVersion ?? null}
            onSetRatio={setRatio}
            onRemove={removeIngredient}
            onRequestSwap={(memoryId) => setPicker({ mode: 'swap', memoryId })}
            onRequestAdd={() => setPicker({ mode: 'add' })}
            onEvenSplit={handleEvenSplit}
            onClear={clearWorkbench}
          />

          <div className="space-y-4 lg:sticky lg:top-4">
            <ResultPanel result={result} />

            <section className="bg-paper-50/80 backdrop-blur rounded-3xl border border-paper-300 shadow-card p-5">
              {editing && !saveAsNew ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-700/70">
                    正在编辑 <b className="text-ink-800">「{editing.name}」</b>
                    <span className="text-ink-700/50">（基于 v{editing.baseVersion}）</span>
                  </p>
                  <button onClick={handleSave} className="btn-primary w-full">
                    保存为新版本
                  </button>
                  <button onClick={() => setSaveAsNew(true)} className="btn-secondary w-full text-sm">
                    另存为新配方
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="给配方起个名字，如：梅雨季的书房"
                    className="scent-input"
                    maxLength={30}
                  />
                  <button onClick={handleSave} className="btn-primary w-full">
                    封存配方
                  </button>
                  {editing && (
                    <button onClick={() => setSaveAsNew(false)} className="btn-ghost w-full text-sm">
                      返回「{editing.name}」的版本编辑
                    </button>
                  )}
                </div>
              )}
              <p className="mt-3 text-[11px] text-ink-700/45 leading-relaxed">
                配方保存后不可改写：再次编辑或回退都会生成新版本，历史全部保留。相同的原料和比例重复保存时，会直接打开已有配方。
              </p>
            </section>
          </div>
        </div>

        <section className="mt-10">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <BookMarked className="w-5 h-5" />
              配方簿
            </h2>
            <span className="text-xs text-ink-700/50">
              {recipes.length} 个配方 · 保存于本机，下次打开仍在
            </span>
          </div>

          {recipes.length === 0 ? (
            <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-16 text-center">
              <div className="text-5xl mb-3 select-none">🧪</div>
              <h3 className="font-serif text-xl text-ink-800 mb-1">还没有配方</h3>
              <p className="text-sm text-ink-700/60 max-w-sm mx-auto">
                在上方调好原料和比例，封存第一瓶调和气味
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 items-start">
              {recipes.map((r) => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  revealVersionId={reveal?.recipeId === r.id ? reveal.versionId : null}
                  onLoad={loadVersion}
                  onRevert={handleRevert}
                  onRename={handleRename}
                  onDelete={handleDeleteRecipe}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="pb-10 pt-4 text-center text-xs text-ink-700/40 font-hand text-lg">
        <p>每一次调和，都是一场小小的炼金术 · Scent Blender</p>
      </footer>

      <IngredientPicker
        isOpen={picker !== null}
        title={picker?.mode === 'swap' ? '换入其他原料' : '选择一种原料'}
        memories={memories}
        excludeIds={draft.map((d) => d.memoryId)}
        onSelect={handlePickerSelect}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}
