import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { getErrorMessage, getFieldErrors, type FieldError } from '../lib/authApi';
import { createWorkspace } from '../lib/workspaceApi';
import './Group.css';

// Backend Workspace.NAME_MAX_LENGTH, DESCRIPTION_MAX_LENGTH
const NAME_MAX_LENGTH = 30;
const DESCRIPTION_MAX_LENGTH = 200;

// 09 새 그룹 만들기 (WS-01, UI v0.4 §6). 만들면 만든 사람이 호스트가 되고 10(초대 링크)으로 간다.
export default function WorkspaceCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);

  const fieldError = (field: string) => fieldErrors.find((e) => e.field === field)?.message;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldErrors([{ field: 'name', message: '그룹 이름을 입력해주세요.' }]);
      return;
    }
    setSubmitting(true);
    setError(null);
    setFieldErrors([]);
    try {
      const workspace = await createWorkspace({
        name: trimmed,
        description: description.trim() || null,
      });
      // 뒤로 가기로 이 화면에 돌아와 같은 그룹을 또 만들지 않게 기록을 바꾼다.
      navigate(`/workspaces/${workspace.id}/invite`, { replace: true });
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err, '그룹을 만들지 못했어요.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="page page--group">
      <Header />
      <main className="group-page">
        <div className="group-page__heading">
          <h1 className="group-page__title">새 그룹 만들기</h1>
          <p className="group-page__subtitle">함께 집을 구할 친구들과 사용할 그룹을 만들어보세요.</p>
        </div>

        <form className="group-card" onSubmit={handleSubmit} noValidate>
          {error && fieldErrors.length === 0 && <p className="group-error">{error}</p>}

          <label className="group-field">
            <span className="group-field__label">그룹 이름</span>
            <input
              className="group-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX_LENGTH}
              placeholder="예: 우리 집 찾기"
              disabled={submitting}
              autoFocus
            />
            {fieldError('name') && <span className="group-field__error">{fieldError('name')}</span>}
          </label>

          <label className="group-field">
            <span className="group-field__label">그룹 소개 (선택)</span>
            <input
              className="group-field__input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder="예: 계명대 주변에서 함께 집을 찾아요."
              disabled={submitting}
            />
            {fieldError('description') && (
              <span className="group-field__error">{fieldError('description')}</span>
            )}
          </label>

          <p className="group-info">그룹을 만든 사람이 호스트가 되며, 초대와 멤버 관리를 할 수 있어요.</p>

          <button
            type="submit"
            className="button button--primary group-card__submit"
            disabled={submitting || !name.trim()}
          >
            {submitting ? '만드는 중...' : '그룹 만들기'}
          </button>
        </form>
      </main>
    </div>
  );
}
