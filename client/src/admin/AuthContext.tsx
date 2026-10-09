import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { adminApi } from "../api";
import { Loading } from "./ui";

interface AuthState {
  email: string | null;
  checking: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setEmail: (email: string) => void;
}

const AuthContext = createContext<AuthState>({
  email: null,
  checking: true,
  login: async () => {},
  logout: async () => {},
  setEmail: () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    adminApi
      .me()
      .then((u) => setEmail(u.email))
      .catch(() => setEmail(null))
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (e: string, p: string) => {
    const u = await adminApi.login(e, p);
    setEmail(u.email);
  }, []);

  const logout = useCallback(async () => {
    await adminApi.logout().catch(() => {});
    setEmail(null);
  }, []);

  return <AuthContext.Provider value={{ email, checking, login, logout, setEmail }}>{children}</AuthContext.Provider>;
}

/** Redirige vers /admin/connexion si personne n'est connecté. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { email, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Loading />;
  if (!email) return <Navigate to="/admin/connexion" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
