import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import { useWorkspace } from '../app/providers/useWorkspace';
import { useWorkspaceMessages } from '../app/providers/useWorkspaceSocket';
import { useToast } from '../components/Toast/useToast';
import { useGroupConditions } from '../hooks/useGroupConditions';
import { getErrorCode, getErrorMessage } from '../lib/authApi';
import { acceptSuggestion, getSuggestions } from '../lib/conditionApi';
import { conditionSummary, roomTypeLabel } from '../lib/conditionFormat';
import { getListingLinks, safeExternalUrl } from '../lib/listingApi';
import { formatExactTime } from '../lib/relativeTime';
import type { HouseCondition, ListingCondition, ListingLinks, RoomType, Suggestion } from '../types/search';
import { badgeLetter } from './candidates/format';
import { useWorkspaceCandidates } from './search/useWorkspaceCandidates';
import './WorkspaceSettings.css';
import './Conditions.css';

const ROOMS: RoomType[] = ['ONE_ROOM', 'TWO_ROOM', 'THREE_ROOM_OR_MORE'];
const CONDITION_NAMES: Record<ListingCondition, string> = {
  LOCATION: '위치',
  DEPOSIT: '보증금',
  MONTHLY_RENT: '월세',
  ROOM_TYPE: '방 구조',
  AREA: '면적',
};

type Form = Record<'depositMin' | 'depositMax' | 'monthlyRentMin' | 'monthlyRentMax' | 'areaMin' | 'areaMax', string> & {
  roomType: RoomType | null;
  avoidSlope: boolean;
  needVehicleAccess: boolean;
};

const toText = (v: number | null) => (v === null ? '' : String(v));
const toNumber = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));

function toForm(c: HouseCondition): Form {
  return {
    depositMin: toText(c.depositMin),
    depositMax: toText(c.depositMax),
    monthlyRentMin: toText(c.monthlyRentMin),
    monthlyRentMax: toText(c.monthlyRentMax),
    areaMin: toText(c.areaMin),
    areaMax: toText(c.areaMax),
    roomType: c.roomType,
    avoidSlope: c.avoidSlope === true,
    needVehicleAccess: c.needVehicleAccess === true,
  };
}

function fromForm(f: Form): HouseCondition {
  return {
    depositMin: toNumber(f.depositMin),
    depositMax: toNumber(f.depositMax),
    monthlyRentMin: toNumber(f.monthlyRentMin),
    monthlyRentMax: toNumber(f.monthlyRentMax),
    areaMin: toNumber(f.areaMin),
    areaMax: toNumber(f.areaMax),
    roomType: f.roomType,
    avoidSlope: f.avoidSlope ? true : null,
    needVehicleAccess: f.needVehicleAccess ? true : null,
  };
}

// 10 조건 확정 · 매물 검색 링크 (UI v0.4.3, COND-01~03, REC-03, LINK-01·02)
// 왼쪽: 우리 조건 — AI 추출값(초안)을 검토·수정해 확정, 확정 후에는 수정해 변경 저장. 추가 제안(10-P) 수락.
// 오른쪽: 후보지를 골라 외부 매물 플랫폼 링크(확정 전에는 비활성) → [집 보러 갈 사람 정하기]
export default function Conditions() {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const { showToast } = useToast();
  const conditions = useGroupConditions(workspace.id);
  const { candidates } = useWorkspaceCandidates(workspace.id, me?.id ?? null);
  const [form, setForm] = useState<Form | null>(null);
  const [baseKey, setBaseKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [accepting, setAccepting] = useState<Suggestion['type'] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [links, setLinks] = useState<ListingLinks | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);

  // 서버 값이 바뀌면(첫 로드, 다른 멤버의 확정·수정, 제안 수락) 입력 칸을 다시 채운다
  const serverKey = conditions.loaded ? JSON.stringify(conditions.current) : null;
  if (serverKey !== null && serverKey !== baseKey) {
    setBaseKey(serverKey);
    setForm(toForm(conditions.current));
  }

  const loadSuggestions = () =>
    getSuggestions(workspace.id)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  useEffect(() => {
    void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);
  useWorkspaceMessages((message) => {
    if (['CONDITION_SUGGESTION_ACCEPTED', 'RECOMMENDATION_COMPLETED', 'CANDIDATE_UPDATED', 'CANDIDATE_ADDED'].includes(message.type)) {
      void loadSuggestions();
    }
  });

  const candidateId = selected ?? candidates?.[0]?.candidateId ?? null;
  const confirmedKey = conditions.confirmed ? JSON.stringify(conditions.confirmed) : null;

  // 확정 조건과 고른 후보지로 외부 매물 링크를 받는다 (조건을 바꾸면 링크도 다시 받는다)
  useEffect(() => {
    if (!confirmedKey || candidateId === null) return;
    let cancelled = false;
    getListingLinks(workspace.id, candidateId)
      .then((data) => {
        if (cancelled) return;
        setLinks(data);
        setLinksError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLinks(null);
        setLinksError(
          getErrorCode(err) === 'CONDITION_REQUIRED'
            ? '조건을 확정하면 매물 검색 링크를 열 수 있어요.'
            : getErrorMessage(err, '매물 검색 링크를 만들지 못했어요.'),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.id, candidateId, confirmedKey]);

  if (!form) {
    return (
      <div className="conditions-page">
        <p className="conditions-page__status">{conditions.error ?? '불러오는 중…'}</p>
      </div>
    );
  }

  const dirty = JSON.stringify(fromForm(form)) !== JSON.stringify(conditions.current);
  const set = (key: keyof Form, value: string | boolean | RoomType | null) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await conditions.save(fromForm(form));
      showToast(conditions.confirmed ? '조건 변경을 저장했어요.' : '조건을 확정했어요. 모든 멤버에게 공유돼요.');
    } catch (err) {
      setFormError(getErrorMessage(err, err instanceof Error ? err.message : '조건을 저장하지 못했어요.'));
    } finally {
      setSaving(false);
    }
  };

  const accept = async (type: Suggestion['type']) => {
    setAccepting(type);
    try {
      setSuggestions(await acceptSuggestion(workspace.id, type));
      await conditions.reload();
      showToast('제안을 조건에 넣었어요. 검토 후 확정해주세요.');
    } catch (err) {
      showToast(getErrorMessage(err, '제안을 수락하지 못했어요.'));
    } finally {
      setAccepting(null);
    }
  };

  const confirmed = conditions.confirmed;
  const pendingSuggestions = suggestions.filter((s) => !s.accepted);
  const selectedIndex = candidates?.findIndex((c) => c.candidateId === candidateId) ?? -1;
  const selectedCandidate = selectedIndex >= 0 ? candidates?.[selectedIndex] : undefined;
  const summary = confirmed ? conditionSummary(confirmed) : conditionSummary(fromForm(form));

  return (
    <div className="conditions-page">
      <div className="page-head">
        <h1 className="page-head__title">조건 확정 · 매물 검색</h1>
        <p className="page-head__desc">
          {confirmed ? '확정한 조건은 모든 멤버에게 공유돼요.' : '멤버가 AI 초기값을 검토·수정한 뒤 확정하면, 조건이 그룹에 공유돼요.'}
        </p>
      </div>

      <div className="conditions-page__grid">
        <section className="card" aria-labelledby="our-condition-title">
          <h2 id="our-condition-title" className="card__title">
            우리 조건
          </h2>
          <p className="conditions-form__state">
            {confirmed ? <strong>조건 확정됨 · 수정 후 변경 저장</strong> : 'AI 추출값을 검토·수정한 뒤 확정해요.'}
          </p>

          {pendingSuggestions.length > 0 && (
            <ul className="suggestions" aria-label="AI 추가 제안">
              {pendingSuggestions.map((s) => (
                <li key={s.type} className="suggestions__item">
                  <div>
                    <p className="suggestions__title">ZIPFIT AI · 추가 제안</p>
                    <p className="suggestions__message">{s.message}</p>
                    {s.evidence.length > 0 && (
                      <p className="suggestions__evidence">
                        근거: {s.evidence.map((e) => `${e.candidateName} ${e.detail}`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="button button--outline button--sm"
                    onClick={() => void accept(s.type)}
                    disabled={accepting !== null}
                  >
                    {accepting === s.type ? '넣는 중…' : '제안 수락'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submit} noValidate>
            <div className="form-grid">
              <NumberField label="보증금 최소 (만 원)" value={form.depositMin} onChange={(v) => set('depositMin', v)} />
              <NumberField label="보증금 최대 (만 원)" value={form.depositMax} onChange={(v) => set('depositMax', v)} />
              <NumberField label="월세 최소 (만 원)" value={form.monthlyRentMin} onChange={(v) => set('monthlyRentMin', v)} />
              <NumberField label="월세 최대 (만 원)" value={form.monthlyRentMax} onChange={(v) => set('monthlyRentMax', v)} />
            </div>
            <fieldset className="conditions-form__rooms">
              <legend className="field__label">방 구조</legend>
              <div className="segmented">
                {ROOMS.map((room) => (
                  <button
                    key={room}
                    type="button"
                    className="segmented__item"
                    aria-pressed={form.roomType === room}
                    onClick={() => set('roomType', form.roomType === room ? null : room)}
                  >
                    {roomTypeLabel(room)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="form-grid">
              <NumberField label="면적 최소 (㎡)" value={form.areaMin} onChange={(v) => set('areaMin', v)} decimal />
              <NumberField label="면적 최대 (㎡)" value={form.areaMax} onChange={(v) => set('areaMax', v)} decimal />
            </div>
            <div className="conditions-form__checks">
              <label>
                <input type="checkbox" checked={form.avoidSlope} onChange={(e) => set('avoidSlope', e.target.checked)} />
                오르막 피하기
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.needVehicleAccess}
                  onChange={(e) => set('needVehicleAccess', e.target.checked)}
                />
                차량 진입 필요
              </label>
            </div>
            {formError && (
              <p className="field__error" role="alert">
                {formError}
              </p>
            )}
            <button
              type="submit"
              className="button button--primary button--lg button--block"
              disabled={saving || (confirmed !== null && !dirty)}
            >
              {saving ? '저장 중…' : confirmed ? '변경 저장' : '조건 확정'}
            </button>
            {confirmed && (
              <p className="conditions-form__meta">
                최종 수정: {confirmed.lastModifiedBy.nickname} · {formatExactTime(confirmed.updatedAt)}
              </p>
            )}
          </form>
        </section>

        <section className="card" aria-labelledby="where-title">
          <h2 id="where-title" className="card__title">
            어느 후보지에서 찾을까요?
          </h2>
          {candidates === null && <p className="field__hint">불러오는 중…</p>}
          {candidates?.length === 0 && (
            <p className="notice">
              아직 후보지가 없어요. <Link to={`/workspaces/${workspace.id}/search`}>함께 찾기</Link>에서 추천 위치를 후보지로 추가해 주세요.
            </p>
          )}
          <div className="candidate-picker" role="radiogroup" aria-label="매물을 찾을 후보지">
            {candidates?.map((c, i) => (
              <button
                key={c.candidateId}
                type="button"
                role="radio"
                aria-checked={c.candidateId === candidateId}
                className="candidate-picker__item"
                onClick={() => setSelected(c.candidateId)}
              >
                <span className={`letter-badge${c.candidateId === candidateId ? ' letter-badge--outline' : ''}`}>
                  {badgeLetter(i)}
                </span>
                {c.name}
              </button>
            ))}
          </div>

          <h3 className="card__subtitle conditions-links__title">외부 매물 플랫폼</h3>
          <p className="conditions-links__summary">
            {selectedCandidate ? `선택 지역 ${badgeLetter(selectedIndex)} · ${selectedCandidate.name}` : '후보지를 골라 주세요'}
            {summary.length > 0 && ` / ${summary.join(' · ')}`}
          </p>
          <div className="conditions-links">
            {(links?.links ?? [{ site: 'naver', siteName: '네이버부동산' }, { site: 'zigbang', siteName: '직방' }]).map((link) => {
              const url = 'url' in link && confirmed ? safeExternalUrl(link.url) : null;
              return url ? (
                <a
                  key={link.site}
                  className="button button--primary button--lg button--block"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.siteName}에서 보기 ↗
                </a>
              ) : (
                <button
                  key={link.site}
                  type="button"
                  className="button button--primary button--lg button--block conditions-links__disabled"
                  disabled
                  title="조건을 확정하면 열 수 있어요."
                >
                  {link.siteName}에서 보기 ↗
                </button>
              );
            })}
          </div>
          {links?.links.some((l) => l.excludedConditions.length > 0) && (
            <p className="field__hint conditions-links__excluded">
              {links.links
                .filter((l) => l.excludedConditions.length > 0)
                .map((l) => `${l.siteName}: ${l.excludedConditions.map((c) => CONDITION_NAMES[c]).join('·')}은(는) 이동한 사이트에서 직접 선택해주세요`)
                .join(' / ')}
            </p>
          )}
          {linksError && (
            <p className="field__error" role="alert">
              {linksError}
            </p>
          )}
          <p className="notice conditions-links__notice">
            ZIPFIT은 매물을 직접 수집하지 않아요. 지원되는 조건이 검색에 반영되며, 나머지는 이동한 사이트에서 확인해주세요.
          </p>
          <Link to={`/workspaces/${workspace.id}/minigame`} className="button button--secondary button--lg button--block">
            집 보러 갈 사람 정하기
          </Link>
        </section>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  decimal = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="field__input"
        inputMode={decimal ? 'decimal' : 'numeric'}
        placeholder="미입력"
        value={value}
        onChange={(event) => {
          const next = event.target.value.replace(decimal ? /[^\d.]/g : /\D/g, '');
          onChange(next);
        }}
      />
    </label>
  );
}
