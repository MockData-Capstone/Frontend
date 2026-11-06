import { useContext } from 'react';
import { NotificationContext } from './NotificationContext';

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications는 NotificationProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
