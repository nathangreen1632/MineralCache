import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

type Role = 'admin' | 'vendor';

export default function RequireRole(props: Readonly<{ role: Role; children: React.ReactElement }>) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (props.role === 'admin' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (props.role === 'vendor' && !(user.role === 'vendor' || user.role === 'admin')) {
    return <Navigate to="/" replace />;
  }

  return props.children;
}
