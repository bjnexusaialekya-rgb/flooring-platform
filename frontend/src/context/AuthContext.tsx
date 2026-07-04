import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, type LoginResponse, type Role } from '../lib/api';

type User = { id: string; email: string; role: Role; displayName: string };

type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('flooring_user');
    return stored ? (JSON.parse(stored) as User) : null;
  });

  async function login(email: string, password: string) {
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem('flooring_jwt', res.token);
    localStorage.setItem('flooring_user', JSON.stringify(res.user));
    setUser(res.user);
  }

  function logout() {
    localStorage.removeItem('flooring_jwt');
    localStorage.removeItem('flooring_user');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
