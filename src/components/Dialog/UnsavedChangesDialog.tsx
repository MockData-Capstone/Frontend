import Dialog from '.';

// P8. 저장하지 않은 변경 (routes.md). 동작은 hooks/useUnsavedChanges.ts.
export default function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <Dialog
      open={open}
      title="저장하지 않은 변경이 있어요"
      description="이 화면을 나가면 입력한 내용이 사라져요."
      cancelLabel="계속 수정"
      confirmLabel="나가기"
      onConfirm={onLeave}
      onClose={onStay}
    />
  );
}
