import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Dialog.css';

// 팝업 틀 (Guidelines 3절 "팝업 공통").
// - 버튼은 오른쪽 아래, 왼쪽이 [취소], 오른쪽이 실행 버튼.
// - 바깥 클릭, Esc, [취소]로 닫힌다. 실행 중(busy)에는 닫히지 않는다.
// - 열리면 첫 입력칸(없으면 [취소])에 포커스, Tab은 팝업 안에서만 돈다, 닫히면 연 버튼으로 포커스를 돌려준다.
export interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  // 요청 중 문구 (예: "삭제하는 중")
  busyLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return createPortal(<DialogPanel {...props} />, document.body);
}

function DialogPanel({
  title,
  description,
  children,
  cancelLabel = '취소',
  confirmLabel,
  busyLabel,
  tone = 'primary',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    busyRef.current = busy;
    onCloseRef.current = onClose;
  });

  // 열 때 포커스를 옮기고, 닫힐 때 연 버튼으로 돌려준다.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstInput = panelRef.current?.querySelector<HTMLElement>('input, select, textarea');
    (firstInput ?? cancelRef.current)?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      // 실행 중(busy)에는 버튼이 모두 꺼져 포커스가 body로 떨어진다. 그래도 Tab이 뒤 화면으로 나가지 않게 패널에 둔다.
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="dialog"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <p id={titleId} className="dialog__title">
          {title}
        </p>
        {description && (
          <div id={descriptionId} className="dialog__description">
            {description}
          </div>
        )}
        {children && <div className="dialog__body">{children}</div>}
        <div className="dialog__actions">
          <button ref={cancelRef} type="button" className="button button--secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`button ${tone === 'danger' ? 'button--danger' : 'button--primary'}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
