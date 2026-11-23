import { useState } from 'react';
import Dialog from '../../components/Dialog';
import type { Consents } from '../../lib/policy';
import { PrivacyConsentSummary, TermsOfService } from './documents';
import './Policy.css';

type Viewing = 'terms' | 'privacy';

const ITEMS: { key: keyof Consents; label: string; view?: Viewing }[] = [
  { key: 'age', label: '[필수] 만 14세 이상이에요' },
  { key: 'terms', label: '[필수] 서비스 이용약관 동의', view: 'terms' },
  { key: 'privacy', label: '[필수] 개인정보 수집·이용 동의', view: 'privacy' },
];

const TITLES: Record<Viewing, string> = {
  terms: '서비스 이용약관',
  privacy: '개인정보 수집·이용 동의',
};

// 가입 동의 (AUTH-01·02). 직방·다방처럼 [전체 동의]와 항목별 [필수] 동의를 두고, 약관은 [보기]로 펼쳐 읽는다.
// 팝업의 [동의]를 누르면 그 항목에 체크한다.
export default function ConsentList({ value, onChange }: { value: Consents; onChange: (next: Consents) => void }) {
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const all = ITEMS.every((item) => value[item.key]);

  return (
    <div className="consent-list">
      <label className="consent-list__all">
        <input
          type="checkbox"
          checked={all}
          onChange={(event) => onChange({ age: event.target.checked, terms: event.target.checked, privacy: event.target.checked })}
        />
        <span>전체 동의</span>
      </label>
      <ul className="consent-list__items">
        {ITEMS.map((item) => (
          <li key={item.key} className="consent-list__item">
            <label>
              <input
                type="checkbox"
                checked={value[item.key]}
                onChange={(event) => onChange({ ...value, [item.key]: event.target.checked })}
              />
              <span>{item.label}</span>
            </label>
            {item.view && (
              <button type="button" className="consent-list__view" onClick={() => setViewing(item.view ?? null)}>
                보기
              </button>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={viewing !== null}
        title={viewing ? TITLES[viewing] : ''}
        cancelLabel="닫기"
        confirmLabel="동의"
        onConfirm={() => {
          if (viewing) onChange({ ...value, [viewing]: true });
          setViewing(null);
        }}
        onClose={() => setViewing(null)}
      >
        {/* 길어서 팝업 안에서만 스크롤한다. 키보드로도 스크롤할 수 있게 포커스를 받는다. */}
        <div className="consent-list__doc" tabIndex={0} role="region" aria-label={viewing ? `${TITLES[viewing]} 본문` : undefined}>
          {viewing === 'terms' ? <TermsOfService newTab /> : <PrivacyConsentSummary />}
        </div>
      </Dialog>
    </div>
  );
}
