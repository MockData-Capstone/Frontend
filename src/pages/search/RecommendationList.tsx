import type { Recommendation } from '../../types/search';

// 분석이 찾은 추천 위치 (REC-02). 번호는 지도의 회색 마커와 같다.
// [후보지로 추가]하면(CAND-01) 지도에서는 후보지 마커(A·B·C)로 바뀐다.
export default function RecommendationList({
  items,
  activeId,
  adding,
  onHover,
  onAdd,
}: {
  items: Recommendation[];
  // 강조할 recommendationId (지도 마커에 올렸을 때)
  activeId: number | null;
  adding: number[];
  onHover: (recommendationId: number, hovering: boolean) => void;
  onAdd: (recommendationId: number) => void;
}) {
  return (
    <section className="recommendations" aria-labelledby="recommendations-title">
      <h2 id="recommendations-title" className="recommendations__title">
        추천 위치 {items.length}곳
      </h2>
      <ul className="recommendations__list">
        {items.map((item, i) => {
          const busy = adding.includes(item.recommendationId);
          return (
            <li
              key={item.recommendationId}
              className={`recommendation-card${activeId === item.recommendationId ? ' is-active' : ''}`}
              onMouseEnter={() => onHover(item.recommendationId, true)}
              onMouseLeave={() => onHover(item.recommendationId, false)}
            >
              <span className="recommendation-card__badge" aria-hidden="true">
                {i + 1}
              </span>
              <div className="recommendation-card__body">
                <p className="recommendation-card__name">{item.placeName}</p>
                <p className="recommendation-card__reason" title={item.reason}>
                  {item.reason}
                </p>
                {item.latitude === null && (
                  <p className="recommendation-card__note">위치를 찾지 못해 지도에는 표시하지 않았어요.</p>
                )}
                {item.addedAsCandidate ? (
                  <span className="recommendation-card__added">후보지에 추가됨</span>
                ) : (
                  <button
                    type="button"
                    className="button button--secondary recommendation-card__add"
                    onClick={() => onAdd(item.recommendationId)}
                    disabled={busy}
                  >
                    {busy ? '추가하는 중...' : '후보지로 추가'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
