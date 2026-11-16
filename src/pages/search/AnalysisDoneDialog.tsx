import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { countConditions, formatAreaRange, formatManwonRange, roomTypeLabel } from '../../lib/conditionFormat';
import type { ExtractedConditions, Recommendation } from '../../types/search';

const NONE = '미언급';

// 06-B 대화 분석 완료 → 추천 · 제안 확인 (UI v0.4.3, REC-01·02).
// 이 화면에서 분석을 지켜보다가 완료되면 한 번 띄운다. 추출 조건은 검토 화면의 초기값이며 아직 확정 조건이 아니다.
export default function AnalysisDoneDialog({
  conditions,
  items,
  onShow,
  onClose,
}: {
  conditions: ExtractedConditions | null;
  items: Recommendation[];
  onShow: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const panel = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.showModal();
    return () => {
      panel?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const c = conditions;
  const rows: [string, string][] = c
    ? [
        ['지역', c.region ?? NONE],
        ['보증금', withSuffix(formatManwonRange(c.depositMin, c.depositMax))],
        ['월세', withSuffix(formatManwonRange(c.monthlyRentMin, c.monthlyRentMax))],
        [
          '면적 · 방 구조',
          [c.roomType ? roomTypeLabel(c.roomType) : null, formatAreaRange(c.areaMin, c.areaMax) ?? '㎡ 미언급']
            .filter(Boolean)
            .join(' · '),
        ],
        ['편의시설', c.facilities?.length ? c.facilities.join(', ') : NONE],
        ['목적지', c.destinations?.length ? c.destinations.join(', ') : NONE],
        ['경사 조건', c.avoidSlope ? '오르막 피하기' : NONE],
        ['차량 조건', c.needVehicleAccess ? '차량 진입 필요' : NONE],
      ]
    : [];

  return createPortal(
    <dialog
      ref={dialog}
      className="analysis-done"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className="analysis-done__title">
        대화 분석 완료
      </h2>
      <p className="analysis-done__summary">
        조건 {countConditions(c)}개 · 추천 {items.length}곳을 찾았어요.
      </p>
      <dl className="analysis-done__table">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="analysis-done__note">
        추출 조건은 검토 화면의 초기값이에요.
        <br />
        아직 최종 확정된 조건은 아니에요.
      </p>
      {items.length > 0 && (
        <ul className="analysis-done__places">
          {items.slice(0, 3).map((item, i) => (
            <li key={item.recommendationId}>
              <strong>
                {i + 1} · {item.placeName}
              </strong>
              <span>{item.reason}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="analysis-done__keep">이번 분석 결과와 관계없이 이미 추가해 둔 후보지는 목록에 남아 있어요.</p>
      <div className="analysis-done__actions">
        <button type="button" className="button button--primary button--lg button--block" onClick={onShow}>
          추천 · 추가 제안 보기
        </button>
        <button type="button" className="button button--outline button--block" onClick={onClose}>
          닫기
        </button>
      </div>
    </dialog>,
    document.body,
  );
}

// "~60만" → "60만 원 이하", "500만~" → "500만 원 이상", "30~60만" → "30~60만 원"
function withSuffix(range: string | null) {
  if (!range) return NONE;
  if (range.startsWith('~')) return `${range.slice(1)} 원 이하`;
  if (range.endsWith('~')) return `${range.slice(0, -1)} 원 이상`;
  return `${range} 원`;
}
