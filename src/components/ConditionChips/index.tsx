import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatAreaRange, formatManwon, roomTypeLabel } from '../../lib/conditionFormat';
import type { HouseCondition, RoomType } from '../../types/search';
import RangeSlider from './RangeSlider';
import './ConditionChips.css';

type Key = 'rent' | 'deposit' | 'room' | 'area' | 'vehicle';

const RANGES = {
  rent: { min: 'monthlyRentMin', max: 'monthlyRentMax', title: '월세', hint: '손잡이를 끌어 월세 범위를 정해요.' },
  deposit: { min: 'depositMin', max: 'depositMax', title: '보증금', hint: '손잡이를 끌어 보증금 범위를 정해요.' },
  area: { min: 'areaMin', max: 'areaMax', title: '면적', hint: '손잡이를 끌어 면적 범위를 정해요. 1평은 약 3.3㎡예요.' },
} as const;

const ROOMS: RoomType[] = ['ONE_ROOM', 'TWO_ROOM', 'THREE_ROOM_OR_MORE'];

// 상단 조건 칩 (UI v0.4.3 01·06 상단, 07-02~05 팝오버). 칩을 누르면 범위·선택 팝오버가 열리고 [적용]하면 onApply로 넘긴다.
// 월세·보증금·면적은 최소~최대 두 손잡이 슬라이더로 고른다(RangeSlider).
// 그룹 화면에서는 그룹 조건(COND-01)을 저장하고, 첫 화면(01)에서는 지도 둘러보기 필터로만 쓴다.
export default function ConditionChips({
  value,
  onApply,
  disabled = false,
}: {
  value: HouseCondition;
  onApply: (next: HouseCondition) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<Key | null>(null);
  const rootRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const apply = async (next: HouseCondition) => {
    await onApply(next);
    setOpen(null);
  };

  const chips: { key: Key; label: string; on: boolean }[] = [
    { key: 'rent', label: rangeLabel('월세', value.monthlyRentMin, value.monthlyRentMax, money), on: value.monthlyRentMax !== null || value.monthlyRentMin !== null },
    { key: 'deposit', label: rangeLabel('보증', value.depositMin, value.depositMax, money), on: value.depositMax !== null || value.depositMin !== null },
    { key: 'room', label: value.roomType ? roomTypeLabel(value.roomType) : '방 구조', on: value.roomType !== null },
    { key: 'area', label: formatAreaRange(value.areaMin, value.areaMax) ?? '면적', on: value.areaMin !== null || value.areaMax !== null },
    { key: 'vehicle', label: value.needVehicleAccess ? '차량 진입 가능' : '차량 진입', on: value.needVehicleAccess === true },
  ];

  return (
    <ul ref={rootRef} className="condition-chips" aria-label="조건">
      {chips.map((chip) => (
        <li key={chip.key} className="condition-chips__item">
          <button
            type="button"
            className={`condition-chips__chip${chip.on ? ' is-on' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={open === chip.key}
            onClick={() => setOpen((current) => (current === chip.key ? null : chip.key))}
            disabled={disabled}
          >
            {chip.label}
            <Caret />
          </button>
          {open === chip.key &&
            (chip.key === 'room' ? (
              <RoomPopover value={value} onApply={apply} onClose={() => setOpen(null)} />
            ) : chip.key === 'vehicle' ? (
              <VehiclePopover value={value} onApply={apply} onClose={() => setOpen(null)} />
            ) : (
              <RangePopover kind={chip.key} value={value} onApply={apply} onClose={() => setOpen(null)} />
            ))}
        </li>
      ))}
    </ul>
  );
}

const money = (v: number) => formatManwon(v);

function rangeLabel(title: string, min: number | null, max: number | null, fmt: (v: number) => string) {
  if (min !== null && max !== null) return `${title} ${fmt(min)}~${fmt(max)}`;
  if (max !== null) return `${title} ${fmt(max)} 이하`;
  if (min !== null) return `${title} ${fmt(min)} 이상`;
  return title === '보증' ? '보증금' : title;
}

function Popover({
  title,
  hint,
  children,
  onClose,
  onReset,
  onApply,
  error,
  busy,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  error: string | null;
  busy: boolean;
}) {
  return (
    <div className="condition-pop" role="dialog" aria-label={title}>
      <div className="condition-pop__head">
        <h3>{title}</h3>
        <button type="button" className="condition-pop__close" onClick={onClose}>
          닫기
        </button>
      </div>
      <p className="condition-pop__hint">{hint}</p>
      {children}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <div className="condition-pop__actions">
        <button type="button" className="button button--outline" onClick={onReset} disabled={busy}>
          초기화
        </button>
        <button type="button" className="button button--primary" onClick={onApply} disabled={busy}>
          {busy ? '적용 중…' : '적용'}
        </button>
      </div>
    </div>
  );
}

function useApply(onApply: (next: HouseCondition) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (next: HouseCondition) => {
    setBusy(true);
    setError(null);
    try {
      await onApply(next);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : '적용하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function RangePopover({
  kind,
  value,
  onApply,
  onClose,
}: {
  kind: 'rent' | 'deposit' | 'area';
  value: HouseCondition;
  onApply: (next: HouseCondition) => Promise<void>;
  onClose: () => void;
}) {
  const spec = RANGES[kind];
  const [min, setMin] = useState<number | null>(value[spec.min]);
  const [max, setMax] = useState<number | null>(value[spec.max]);
  const { busy, error, run } = useApply(onApply);
  // 슬라이더로는 엇갈릴 수 없지만, 저장된 값이 이미 엇갈려 있으면 손잡이를 옮기기 전까지 막는다.
  const invalid = min !== null && max !== null && min > max ? '최솟값이 최댓값보다 커요. 손잡이를 다시 맞춰 주세요.' : null;

  return (
    <Popover
      title={spec.title}
      hint={spec.hint}
      onClose={onClose}
      onReset={() => {
        setMin(null);
        setMax(null);
      }}
      onApply={() => {
        if (!invalid) void run({ ...value, [spec.min]: min, [spec.max]: max });
      }}
      error={invalid ?? error}
      busy={busy}
    >
      <RangeSlider
        kind={kind}
        title={spec.title}
        min={min}
        max={max}
        onChange={(nextMin, nextMax) => {
          setMin(nextMin);
          setMax(nextMax);
        }}
      />
    </Popover>
  );
}

function RoomPopover({
  value,
  onApply,
  onClose,
}: {
  value: HouseCondition;
  onApply: (next: HouseCondition) => Promise<void>;
  onClose: () => void;
}) {
  const [room, setRoom] = useState<RoomType | null>(value.roomType);
  const { busy, error, run } = useApply(onApply);
  return (
    <Popover
      title="방 구조"
      hint="찾을 방 구조를 하나 골라 주세요."
      onClose={onClose}
      onReset={() => setRoom(null)}
      onApply={() => void run({ ...value, roomType: room })}
      error={error}
      busy={busy}
    >
      <div className="condition-pop__options">
        <button type="button" aria-pressed={room === null} className="segmented__item" onClick={() => setRoom(null)}>
          전체
        </button>
        {ROOMS.map((r) => (
          <button key={r} type="button" aria-pressed={room === r} className="segmented__item" onClick={() => setRoom(r)}>
            {roomTypeLabel(r)}
          </button>
        ))}
      </div>
    </Popover>
  );
}

function VehiclePopover({
  value,
  onApply,
  onClose,
}: {
  value: HouseCondition;
  onApply: (next: HouseCondition) => Promise<void>;
  onClose: () => void;
}) {
  const [need, setNeed] = useState(value.needVehicleAccess === true);
  const { busy, error, run } = useApply(onApply);
  return (
    <Popover
      title="차량 진입"
      hint="차가 들어갈 수 있는지 확인해요."
      onClose={onClose}
      onReset={() => setNeed(false)}
      onApply={() => void run({ ...value, needVehicleAccess: need ? true : null })}
      error={error}
      busy={busy}
    >
      <div className="condition-pop__options condition-pop__options--stack">
        <button type="button" aria-pressed={!need} className="segmented__item" onClick={() => setNeed(false)}>
          전체 지역
        </button>
        <button type="button" aria-pressed={need} className="segmented__item" onClick={() => setNeed(true)}>
          차가 들어갈 수 있는 곳
        </button>
      </div>
      <p className="condition-pop__note">추정 가능 여부는 다른 조건과 함께 봐요.</p>
    </Popover>
  );
}

function Caret() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
