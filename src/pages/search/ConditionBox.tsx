import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { getConditions } from '../../lib/conditionApi';
import { conditionSummary, extractedExtras } from '../../lib/conditionFormat';
import type { ConditionView, ExtractedConditions, SavedCondition } from '../../types/search';

// 11 "함께 정한 조건". 확정한 조건(COND-02)이 있으면 그것을, 없으면 최근 분석이 대화에서 뽑은 초안(draft)을 보여준다.
// 지역·목적지·편의시설은 확정 조건에 없는 항목이라 최근 분석 결과(extracted)에서 덧붙인다.
export default function ConditionBox({
  workspaceId,
  extracted,
}: {
  workspaceId: number;
  extracted: ExtractedConditions | null;
}) {
  const [view, setView] = useState<ConditionView | null>(null);

  const load = useCallback(() => getConditions(workspaceId).then(setView), [workspaceId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useWorkspaceMessages((message) => {
    switch (message.type) {
      // 확정·수정하면 바뀐 조건 전체가 온다.
      case 'CONDITION_UPDATED':
        setView((current) => ({ condition: message.data as SavedCondition, draft: current?.draft ?? null }));
        return;
      // 초안이 바뀐다: 새 분석 결과, 조건 제안 수락(REC-03)
      case 'RECOMMENDATION_COMPLETED':
      case 'CONDITION_SUGGESTION_ACCEPTED':
        load().catch(() => {});
    }
  });

  useWorkspaceReconnect(() => {
    load().catch(() => {});
  });

  const confirmed = view?.condition ?? null;
  const base = confirmed ?? view?.draft ?? null;
  const items = [
    ...(base ? conditionSummary(base) : []),
    ...(extracted ? extractedExtras(extracted) : []),
  ];

  return (
    <section className="condition-box" aria-labelledby="condition-box-title">
      <div className="condition-box__head">
        <h2 id="condition-box-title" className="condition-box__title">
          함께 정한 조건
        </h2>
        {items.length > 0 && <span className="condition-box__tag">{confirmed ? '확정' : '대화 분석'}</span>}
      </div>
      {items.length > 0 ? (
        <ul className="condition-box__chips">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="condition-box__empty">대화를 나눈 뒤 [대화 분석하기]를 누르면 여기에 조건을 정리해요.</p>
      )}
    </section>
  );
}
