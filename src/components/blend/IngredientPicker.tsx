import { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { SmellMemory } from '../../utils/constants';
import { getSmellTypeInfo } from '../../utils/constants';

interface Props {
  isOpen: boolean;
  title: string;
  memories: SmellMemory[];
  excludeIds: string[];
  onSelect: (memory: SmellMemory) => void;
  onClose: () => void;
}

export default function IngredientPicker({ isOpen, title, memories, excludeIds, onSelect, onClose }: Props) {
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (isOpen) setKeyword('');
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const candidates = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return memories.filter((m) => {
      if (excludeIds.includes(m.id)) return false;
      if (!kw) return true;
      return (
        m.location.toLowerCase().includes(kw) ||
        m.source_guess.toLowerCase().includes(kw)
      );
    });
  }, [memories, excludeIds, keyword]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      />
      <div className="relative w-full sm:max-w-lg bg-paper-50 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-paper-300 animate-slideDown max-h-[82vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-paper-200">
          <h2 className="font-serif text-xl font-bold text-ink-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-700/60 hover:text-ink-800 hover:bg-paper-200 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-700/40" />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索地点或来源…"
              className="scent-input pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pt-3 space-y-2">
          {candidates.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-700/50">
              {memories.length === 0
                ? '档案库里还没有气味，先去「气味档案」封存几段吧'
                : excludeIds.length >= memories.length
                  ? '所有档案都已经在调香台上了'
                  : '没有匹配的档案'}
            </div>
          ) : (
            candidates.map((m) => {
              const stype = getSmellTypeInfo(m.smell_type);
              return (
                <button
                  key={m.id}
                  onClick={() => onSelect(m)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-paper-200 bg-paper-100/60 hover:bg-paper-100 hover:border-paper-300 transition-colors text-left"
                >
                  <span
                    className="w-9 h-9 rounded-xl shrink-0 border-2 border-paper-50 shadow-sm"
                    style={{ backgroundColor: m.color_association }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-serif font-semibold text-ink-800 truncate">
                      {m.location}
                    </span>
                    <span className="block text-xs text-ink-700/60 truncate">
                      {stype.emoji} {m.source_guess || stype.label} · 强度 {m.intensity} · 湿度 {m.humidity}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
