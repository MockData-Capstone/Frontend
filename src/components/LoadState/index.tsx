import './LoadState.css';

// 영역별 로딩·실패 표시 (Guidelines 3절). 실패하면 그 영역에만 보여주고 나머지 영역은 그대로 둔다.
export default function LoadState({
  status,
  onRetry,
}: {
  status: 'loading' | 'error';
  onRetry?: () => void;
}) {
  if (status === 'loading') {
    return (
      <div className="load-state" role="status">
        <span className="load-state__spinner" aria-hidden="true" />
        <p className="load-state__text">불러오는 중...</p>
      </div>
    );
  }
  return (
    <div className="load-state" role="alert">
      <p className="load-state__text">정보를 불러오지 못했어요</p>
      {onRetry && (
        <button type="button" className="button button--secondary" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
