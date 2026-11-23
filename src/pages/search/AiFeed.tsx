import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { countConditions } from '../../lib/conditionFormat';
import { formatExactTime } from '../../lib/relativeTime';
import type { Analysis, Recommendation, Suggestion } from '../../types/search';
import RecommendationList from './RecommendationList';

// 06-A ZIPFIT AI 탭 (UI v0.4.3, REC-01~03). 공유 분석 결과를 대화처럼 보여준다:
// 분석 요청 → 추출 조건 → 추천 이유(추천 위치) → 추가 제안([제안 수락]/[나중에]) → 다음 단계(추출 조건 검토 / 대화로 보충)
// 분석 중·실패·대화 없음·추출 조건 없음·추천 위치 없음은 "AI 분석 상태·예외" 카드로 보여준다.
export default function AiFeed({
  analysis,
  items,
  suggestions,
  hasChat,
  inProgress,
  conditionsPath,
  adding,
  activeId,
  onHover,
  onAdd,
  onAccept,
  onLater,
  accepting,
  onRequest,
  onGoChat,
}: {
  analysis: Analysis | null;
  items: Recommendation[];
  suggestions: Suggestion[];
  hasChat: boolean;
  inProgress: boolean;
  conditionsPath: string;
  adding: number[];
  activeId: number | null;
  onHover: (recommendationId: number, hovering: boolean) => void;
  onAdd: (recommendationId: number) => void;
  onAccept: (type: Suggestion['type']) => void;
  onLater: (type: Suggestion['type']) => void;
  accepting: Suggestion['type'] | null;
  onRequest: () => void;
  onGoChat: () => void;
}) {
  if (inProgress) {
    return (
      <StateCard title="분석 중" lines={['대화에서 조건을 추출하고 있어요.', '위치 검색·검증 후 추천 이유를 만들어요.', '분석 중에는 중복 요청을 받지 않아요.']}>
        <button type="button" className="button button--secondary button--block" disabled>
          분석 중…
        </button>
      </StateCard>
    );
  }
  if (!analysis) {
    return hasChat ? (
      <StateCard
        title="아직 분석하지 않았어요"
        lines={['멤버들과 나눈 대화로 집 조건을 정리하고', '조건에 맞는 위치를 추천해 드려요.', '대화는 닉네임 없이 AI 분석 서버로 보내요.']}
      >
        <button type="button" className="button button--primary button--block" onClick={onRequest}>
          대화 분석하기
        </button>
      </StateCard>
    ) : (
      <StateCard title="대화 기록 없음" lines={['아직 분석할 대화가 없어요.', '멤버들과 집 조건을 이야기해 주세요.', '분석 요청은 시작되지 않았어요.']}>
        <button type="button" className="button button--primary button--block" onClick={onGoChat}>
          멤버 대화로 이동
        </button>
      </StateCard>
    );
  }
  if (analysis.status === 'FAILED') {
    return (
      <StateCard
        title="분석 실패"
        lines={[analysis.failureMessage ?? '분석을 완료하지 못했어요.', '다시 요청해 주세요.', '기존 후보지는 그대로 유지돼요.']}
      >
        <button type="button" className="button button--primary button--block" onClick={onRequest} disabled={!hasChat}>
          다시 분석 요청
        </button>
      </StateCard>
    );
  }

  const conditionCount = countConditions(analysis.conditions);
  const pending = suggestions.filter((s) => !s.accepted);
  const time = formatExactTime(analysis.completedAt ?? analysis.requestedAt);

  if (conditionCount === 0) {
    return (
      <StateCard title="추출 조건 없음" lines={['집 찾기 조건을 찾지 못했어요.', '지역·예산·방 구조 등을 대화에 보충하고', '다시 분석을 요청해 주세요.']}>
        <button type="button" className="button button--primary button--block" onClick={onGoChat}>
          조건 보충하러 가기
        </button>
      </StateCard>
    );
  }

  return (
    <div className="ai-feed">
      <ol className="ai-feed__list">
        <li className="ai-feed__entry">
          <p className="ai-feed__who">ZIPFIT AI · 추출 조건</p>
          <div className="ai-feed__row">
            <p className="ai-feed__bubble is-ai">
              <strong>조건 {conditionCount}개를 정리했어요.</strong>
              <br />
              검토 후 확정할 수 있어요.
            </p>
            <time className="ai-feed__time">{time}</time>
          </div>
        </li>
        {items.length > 0 ? (
          <li className="ai-feed__entry">
            <p className="ai-feed__who">ZIPFIT AI · 추천 이유</p>
            <RecommendationList items={items} activeId={activeId} adding={adding} onHover={onHover} onAdd={onAdd} />
          </li>
        ) : (
          <li className="ai-feed__entry">
            <p className="ai-feed__who">ZIPFIT AI · 추천 위치 없음</p>
            <p className="ai-feed__bubble is-ai">
              조건에 맞는 위치를 찾지 못했어요. 지도 핀을 임의로 만들지 않아요. 조건을 보충한 뒤 다시 요청해 주세요.
            </p>
          </li>
        )}
        {pending.map((s) => (
          <li key={s.type} className="ai-feed__entry">
            <p className="ai-feed__who">ZIPFIT AI · 추가 제안</p>
            <p className="ai-feed__bubble is-ai">
              <strong>{s.message}</strong>
              {s.evidence.length > 0 && (
                <>
                  <br />
                  {s.evidence.map((e) => `${e.candidateName} ${e.detail}`).join(' · ')}
                </>
              )}
            </p>
            <div className="ai-feed__choices">
              <button type="button" className="button button--outline" onClick={() => onAccept(s.type)} disabled={accepting !== null}>
                {accepting === s.type ? '넣는 중…' : '제안 수락'}
              </button>
              <button type="button" className="button button--outline" onClick={() => onLater(s.type)} disabled={accepting !== null}>
                나중에
              </button>
            </div>
          </li>
        ))}
      </ol>
      <p className="ai-feed__shared">공유 분석 · 모든 멤버가 같은 결과를 확인해요</p>
      <div className="ai-feed__next">
        <p className="ai-feed__next-title">다음 · 추출 조건 검토</p>
        <p className="ai-feed__next-desc">검토·수정한 뒤 그룹 조건으로 확정해요</p>
        <Link to={conditionsPath} className="button button--primary button--lg button--block">
          추출 조건 검토
        </Link>
        <button type="button" className="button button--outline button--block" onClick={onGoChat}>
          멤버 대화에 조건 보충
        </button>
      </div>
    </div>
  );
}

function StateCard({ title, lines, children }: { title: string; lines: string[]; children: ReactNode }) {
  return (
    <section className="ai-state" aria-label={title}>
      <h2 className="ai-state__title">{title}</h2>
      {lines.map((line) => (
        <p key={line} className="ai-state__line">
          {line}
        </p>
      ))}
      <div className="ai-state__action">{children}</div>
    </section>
  );
}
