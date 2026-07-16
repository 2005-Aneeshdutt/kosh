import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, auth, type SessionUser } from "@/lib/api";

interface AuthValue {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!auth.token) { setReady(true); return; }
    api.me()
      .then(setUser)
      .catch(() => auth.clear())
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    auth.set(token);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* noop */ }
    auth.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
