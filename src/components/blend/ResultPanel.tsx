import { getSeasonInfo, getEmotionInfo } from '../../utils/constants';
import type { BlendResult } from '../../utils/blend';
import { humidityLabel } from '../../utils/blend';

interface Props {
  result: BlendResult | null;
}

export default function ResultPanel({ result }: Props) {
  return (
    <section className="bg-paper-50/80 backdrop-blur rounded-3xl border border-paper-300 shadow-card p-5">
      <h3 className="font-hand text-xl text-moss-600 mb-4">调和结果</h3>

      {!result ? (
        <p className="text-sm text-ink-700/50 py-6 text-center">
          加入原料后，这里会实时显示调和结果
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl border-2 border-paper-50 shadow-card shrink-0 transition-colors duration-300"
              style={{ backgroundColor: result.color }}
            />
            <div className="min-w-0">
              <div className="font-mono text-lg font-semibold text-ink-800">{result.color}</div>
              <div className="text-xs text-ink-700/55 mt-0.5">按比例调和出的颜色</div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-ink-700/60 mb-1">
                <span>加权强度</span>
                <span className="font-semibold text-ochre-600">{result.intensity} / 10</span>
              </div>
              <div className="h-2 bg-paper-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${result.intensity * 10}%`,
                    background: 'linear-gradient(90deg, #D4B487 0%, #8B5A2B 60%, #5C3A1D 100%)',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-ink-700/60 mb-1">
                <span>湿度感</span>
                <span className="font-semibold text-moss-600">
                  {result.humidity} / 10 · {humidityLabel(result.humidity)}
                </span>
              </div>
              <div className="h-2 bg-paper-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${result.humidity * 10}%`,
                    background: 'linear-gradient(90deg, #CFDBD3 0%, #7DA08C 60%, #3D5A4A 100%)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {(() => {
                const season = getSeasonInfo(result.season.value);
                const emotion = getEmotionInfo(result.emotion.value);
                return (
                  <>
                    <div className="rounded-xl bg-paper-100/70 border border-paper-200 px-3 py-2.5 text-center">
                      <div className="text-2xl leading-none">{season.emoji}</div>
                      <div className="mt-1 text-sm font-medium text-ink-800">{season.label}季</div>
                      <div className="text-[11px] text-ink-700/55">
                        占比 {Math.round((result.season.share / result.total) * 100)}%
                      </div>
                    </div>
                    <div className="rounded-xl bg-paper-100/70 border border-paper-200 px-3 py-2.5 text-center">
                      <div className="text-2xl leading-none">{emotion.emoji}</div>
                      <div className="mt-1 text-sm font-medium text-ink-800">{emotion.label}</div>
                      <div className="text-[11px] text-ink-700/55">
                        占比 {Math.round((result.emotion.share / result.total) * 100)}%
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
