import { useCallback, useEffect, useState } from 'react';

// 저장하지 않은 변경 경고 (routes.md P8).
// - 그 화면 안의 버튼·링크로 나가려 하면 confirmLeave(나가는 동작)로 감싼다. 변경이 있으면 P8을 띄운다.
// - 새로고침과 탭 닫기는 브라우저 기본 확인창(beforeunload)으로 막는다.
// - 상단바 링크와 브라우저 뒤로 가기는 막지 않는다(저장소 라우터로는 막을 수 없다).
// - 저장에 성공하면 dirty를 false로 바꿔 경고를 끈다.
//
// 쓰는 곳: const { confirmLeave, dialog } = useUnsavedChanges(dirty);
//         <UnsavedChangesDialog {...dialog} />
export function useUnsavedChanges(dirty: boolean) {
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 오래된 브라우저는 returnValue가 있어야 확인창을 띄운다.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const confirmLeave = useCallback(
    (leave: () => void) => {
      if (dirty) setPendingLeave(() => leave);
      else leave();
    },
    [dirty],
  );

  const onStay = useCallback(() => setPendingLeave(null), []);
  const onLeave = useCallback(() => {
    const leave = pendingLeave;
    setPendingLeave(null);
    leave?.();
  }, [pendingLeave]);

  return {
    confirmLeave,
    dialog: { open: pendingLeave !== null, onStay, onLeave },
  };
}
