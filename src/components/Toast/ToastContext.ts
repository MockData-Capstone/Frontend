import { createContext } from 'react';

export interface ToastContextValue {
  // 화면 아래 가운데에 3초 동안 보여준다. 최대 3개까지 쌓인다.
  showToast: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
