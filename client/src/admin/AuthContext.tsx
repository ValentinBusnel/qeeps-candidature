import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { adminApi, type Role, type SessionUser } from "../api";
import { Loading } from "./ui";

interface AuthState {
  email: string | null;
  role: Role | null;
  /** compte « lecture seule » : tout se consulte, rien ne se modifie */
  readOnly: boolean;
  checking: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setEmail: (email: string) => void;
  setUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthState>({
  email: null,
  role: null,
  readOnly: false,
  checking: true,
  login: async () => {},
  logout: async () => {},
  setEmail: () => {},
  setUser: () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [checking, setChecking] = useState(true);

  const setUser = useCallback((u: SessionUser) => {
    setEmail(u.email);
    setRole(u.role ?? "admin");
  }, []);

  useEffect(() => {
    adminApi
      .me()
      .then(setUser)
      .catch(() => setEmail(null))
      .finally(() => setChecking(false));
  }, [setUser]);

  const login = useCallback(
    async (e: string, p: string) => {
      setUser(await adminApi.login(e, p));
    },
    [setUser]
  );

  const logout = useCallback(async () => {
    await adminApi.logout().catch(() => {});
    setEmail(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ email, role, readOnly: role === "viewer", checking, login, logout, setEmail, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Redirige vers /admin/connexion si personne n'est connecté. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { email, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Loading />;
  if (!email) return <Navigate to="/admin/connexion" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** Pages réservées aux administrateurs (ex. gestion des utilisateurs). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { readOnly } = useAuth();
  return readOnly ? <Navigate to="/admin" replace /> : <>{children}</>;
}
