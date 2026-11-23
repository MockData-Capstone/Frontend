import { Link } from 'react-router-dom';
import { contactText, POLICY_DOCS, POLICY_INFO } from '../../lib/policy';
import './PolicyFooter.css';

// 화면 하단 약관 링크와 운영 정보 (직방·다방 하단 참고). 개인정보 처리방침은 눈에 띄게 굵게 쓴다.
// compact: 지도 화면(01) 왼쪽 패널 아래에 링크만 작게 둔다.
export default function PolicyFooter({ compact = false }: { compact?: boolean }) {
  const links = (
    <nav className="policy-footer__links" aria-label="약관 및 정책">
      <Link to={POLICY_DOCS.terms.path}>{POLICY_DOCS.terms.title}</Link>
      <Link to={POLICY_DOCS.privacy.path} className="policy-footer__privacy">
        {POLICY_DOCS.privacy.title}
      </Link>
    </nav>
  );
  if (compact) return <div className="policy-footer policy-footer--compact">{links}</div>;
  return (
    <footer className="policy-footer">
      {links}
      <p className="policy-footer__info">
        {POLICY_INFO.service} · 운영 {POLICY_INFO.operator} · {POLICY_INFO.operatorNote} · {contactText()}
      </p>
      <p className="policy-footer__info">© 2026 {POLICY_INFO.service}</p>
    </footer>
  );
}
