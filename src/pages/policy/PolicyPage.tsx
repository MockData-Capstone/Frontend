import { useEffect } from 'react';
import { Navigate, NavLink, useLocation, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import PolicyFooter from '../../components/PolicyFooter';
import { isPolicyDoc, POLICY_DOCS, POLICY_INFO, type PolicyDoc } from '../../lib/policy';
import { PolicyHighlights, PrivacyPolicy, TermsOfService } from './documents';
import './Policy.css';

const DOCS = Object.keys(POLICY_DOCS) as PolicyDoc[];

// 약관 및 정책 (/policy/terms, /policy/privacy). 직방·다방·호갱노노의 하단 약관 링크와 호갱노노의 약관 탭 페이지를 참고했다.
// 로그인하지 않아도 볼 수 있다. 주소 끝 #조항 id로 오면 그 조항으로 내려간다 (예: AI 분석 안내 → #privacy-ai).
export default function PolicyPage() {
  const { doc } = useParams();
  const { hash } = useLocation();

  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [doc, hash]);

  if (!isPolicyDoc(doc)) return <Navigate to={POLICY_DOCS.terms.path} replace />;

  return (
    <div className="page policy-page">
      <Header />
      <main className="policy-page__main">
        <h1 className="policy-page__title">약관 및 정책</h1>
        <nav className="policy-tabs" aria-label="약관 종류">
          {DOCS.map((key) => (
            <NavLink key={key} to={POLICY_DOCS[key].path} className="policy-tabs__tab" replace>
              {POLICY_DOCS[key].title}
            </NavLink>
          ))}
        </nav>
        <section className="policy-page__summary" aria-label="한눈에 보기">
          <h2>한눈에 보기</h2>
          <PolicyHighlights />
        </section>
        <article className="policy-page__doc" aria-labelledby="policy-doc-title">
          <header className="policy-page__doc-head">
            <h2 id="policy-doc-title">ZIPFIT {POLICY_DOCS[doc].title}</h2>
            <p>
              버전 {POLICY_INFO.version} · 시행일 {POLICY_INFO.effectiveDate}
            </p>
          </header>
          {doc === 'terms' ? <TermsOfService /> : <PrivacyPolicy />}
        </article>
      </main>
      <PolicyFooter />
    </div>
  );
}
