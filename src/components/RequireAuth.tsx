import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
