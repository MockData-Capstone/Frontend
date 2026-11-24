import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import {
  indexOf,
  lastIndex,
  pyeongText,
  rangeText,
  tickMarks,
  valueAt,
  valueText,
  type ScaleKind,
  type Thumb,
} from './rangeScale';

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// 최소~최대 두 손잡이 슬라이더 (조건 칩의 월세·보증금·면적). 눈금은 rangeScale에 있다.
// 손잡이를 직접 그려서, 두 손잡이가 한 칸에 겹쳐도 처음 끄는 방향으로 알맞은 손잡이가 움직인다.
export default function RangeSlider({
  kind,
  title,
  min,
  max,
  onChange,
}: {
  kind: ScaleKind;
  title: string;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLSpanElement>(null);
  const maxRef = useRef<HTMLSpanElement>(null);
  const focusThumb = (thumb: Thumb) => (thumb === 'min' ? minRef : maxRef).current?.focus();
  const last = lastIndex(kind);
  const lo = indexOf(kind, min, 'min');
  const hi = indexOf(kind, max, 'max');
  const percent = (index: number) => `${(index / last) * 100}%`;
  const pyeong = kind === 'area' ? pyeongText(min, max) : null;

  // 최소는 '무제한' 칸에, 최대는 맨 왼쪽 칸에 갈 수 없고, 서로 지나치지 않는다.
  const setThumb = (thumb: Thumb, index: number) => {
    if (thumb === 'min') {
      const next = clamp(index, 0, Math.min(hi, last - 1));
      if (next !== lo) onChange(valueAt(kind, next, 'min'), max);
    } else {
      const next = clamp(index, Math.max(lo, 1), last);
      if (next !== hi) onChange(min, valueAt(kind, next, 'max'));
    }
  };

  const indexAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.round(clamp((clientX - rect.left) / rect.width, 0, 1) * last);
  };

  // 누른 곳에서 가까운 손잡이를 옮기고, 놓을 때까지 따라간다. 두 손잡이가 겹쳐 있으면 처음 움직이는 방향으로 정한다.
  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const start = indexAt(e.clientX);
    let thumb: Thumb | null =
      start < lo ? 'min' : start > hi ? 'max' : lo === hi ? null : start - lo <= hi - start ? 'min' : 'max';
    if (thumb) {
      setThumb(thumb, start);
      focusThumb(thumb);
    }
    const move = (ev: globalThis.PointerEvent) => {
      const index = indexAt(ev.clientX);
      if (!thumb) {
        if (index === start) return;
        thumb = index < start ? 'min' : 'max';
        focusThumb(thumb);
      }
      setThumb(thumb, index);
    };
    const stop = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
  };

  const onKey = (thumb: Thumb) => (e: KeyboardEvent<HTMLSpanElement>) => {
    const current = thumb === 'min' ? lo : hi;
    const next: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      PageDown: current - 5,
      PageUp: current + 5,
      Home: 0,
      End: last,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    setThumb(thumb, next[e.key]);
  };

  const thumbProps = (thumb: Thumb) => {
    const index = thumb === 'min' ? lo : hi;
    return {
      role: 'slider',
      tabIndex: 0,
      className: `range-slider__thumb range-slider__thumb--${thumb}`,
      style: { left: percent(index) },
      'aria-label': `${thumb === 'min' ? '최소' : '최대'} ${title}`,
      'aria-valuemin': 0,
      'aria-valuemax': last,
      'aria-valuenow': index,
      'aria-valuetext': valueText(kind, thumb === 'min' ? min : max, thumb),
      onKeyDown: onKey(thumb),
    };
  };

  return (
    <div className="range-slider">
      <p className="range-slider__value" aria-live="polite">
        <strong>{rangeText(kind, min, max)}</strong>
        {pyeong && <span>{pyeong}</span>}
      </p>
      <div
        className="range-slider__control"
        style={{ '--lo': percent(lo), '--hi': percent(hi) } as CSSProperties}
        onPointerDown={startDrag}
      >
        <div ref={trackRef} className="range-slider__track">
          <span className="range-slider__fill" />
        </div>
        <span ref={minRef} {...thumbProps('min')} />
        <span ref={maxRef} {...thumbProps('max')} />
      </div>
      <div className="range-slider__ticks" aria-hidden="true">
        {tickMarks(kind).map((tick) => (
          <span key={tick.index} style={{ left: percent(tick.index) }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
