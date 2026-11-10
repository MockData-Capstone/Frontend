import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../pages/Features.css';

export function FeaturePage({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="feature-page"><header className="feature-heading"><h1>{title}</h1>{description && <p>{description}</p>}</header>{children}</div>;
}
export function ErrorNotice({ message, retry }: { message: string | null; retry?: () => void }) {
  return message ? <div role="alert" className="feature-error"><p>{message}</p>{retry && <button type="button" className="button button--secondary" onClick={retry}>다시 시도</button>}</div> : null;
}
export function WorkspaceLinks({ id }: { id: number }) {
  return <nav className="feature-links" aria-label="집 찾기 단계">{[
    ['search', '대화·추천'], ['candidates', '후보지'], ['comparisons', '비교'], ['votes', '투표'], ['conditions', '조건'], ['listings', '매물 찾기'],
  ].map(([path, label]) => <Link key={path} to={`/workspaces/${id}/${path}`}>{label}</Link>)}</nav>;
}
