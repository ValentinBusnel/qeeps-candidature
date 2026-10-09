import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icons";
import { useAuth } from "../AuthContext";
import "../admin.css";

export default function Login() {
  const { email, login, checking } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  if (!checking && email) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login(String(data.get("email")), String(data.get("password")));
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-login">
      <div className="adm-login__glow" />
      <form className="adm-login__card" onSubmit={onSubmit}>
        <p className="adm-logo">
          Valentin<span>.</span> <small>admin</small>
        </p>
        <div>
          <h1 className="t-h3">Connexion</h1>
          <p className="t-sub">Accédez à l'espace d'administration de votre site.</p>
        </div>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" className="input" autoComplete="username" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="login-password">Mot de passe</label>
          <input id="login-password" name="password" type="password" className="input" autoComplete="current-password" required />
        </div>
        {error && <p className="adm-error">{error}</p>}
        <button className="btn btn--primary btn--block" disabled={busy}>
          <Icon name="arrow" /> {busy ? "Connexion…" : "Se connecter"}
        </button>
        <Link to="/" className="adm-login__back">
          ← Retour au site
        </Link>
      </form>
    </div>
  );
}
