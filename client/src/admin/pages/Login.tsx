import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { adminApi } from "../../api";
import { Icon } from "../../components/Icons";
import { useAuth } from "../AuthContext";
import "../admin.css";

/**
 * Connexion à l'admin. Tant qu'aucun compte n'existe (première mise en ligne), la page devient
 * « Créez votre accès » : on choisit son email et son mot de passe directement ici, avec la clé
 * à usage unique du lien affiché dans les journaux du serveur.
 */
export default function Login() {
  const { email, login, checking, setEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const key = params.get("cle") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ needed: boolean; keyValid: boolean; email: string } | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  useEffect(() => {
    adminApi
      .setupStatus(key)
      .then(setSetup)
      .catch(() => setSetup({ needed: false, keyValid: false, email: "" }));
  }, [key]);

  if (!checking && email) return <Navigate to={from} replace />;

  async function onLogin(e: FormEvent<HTMLFormElement>) {
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

  async function onSetup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true);
    setError(null);
    try {
      const u = await adminApi.setup(key, String(data.get("email")), password);
      setEmail(u.email);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const creating = setup?.needed;

  return (
    <div className="adm-login">
      <div className="adm-login__glow" />
      {creating ? (
        <form className="adm-login__card" onSubmit={onSetup}>
          <p className="adm-logo">
            Valentin<span>.</span> <small>admin</small>
          </p>
          <div>
            <h1 className="t-h3">Créez votre accès</h1>
            <p className="t-sub">Première connexion : choisissez l'email et le mot de passe de votre espace d'administration.</p>
          </div>
          {setup.keyValid ? (
            <>
              <div className="field">
                <label htmlFor="setup-email">Email</label>
                <input id="setup-email" name="email" type="email" className="input" autoComplete="username" defaultValue={setup.email} required autoFocus={!setup.email} />
              </div>
              <div className="field">
                <label htmlFor="setup-password">Mot de passe</label>
                <input id="setup-password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required autoFocus={!!setup.email} />
                <p className="adm-hint">10 caractères minimum.</p>
              </div>
              <div className="field">
                <label htmlFor="setup-confirm">Confirmez le mot de passe</label>
                <input id="setup-confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={10} required />
              </div>
              {error && <p className="adm-error">{error}</p>}
              <button className="btn btn--primary btn--block" disabled={busy}>
                <Icon name="check" /> {busy ? "Création…" : "Créer mon accès"}
              </button>
            </>
          ) : (
            <p className="adm-error">
              Pour des raisons de sécurité, ouvrez le lien de première connexion affiché dans les journaux du serveur (Railway → Deployments → View logs). Il contient une clé à usage unique.
            </p>
          )}
          <Link to="/" className="adm-login__back">
            ← Retour au site
          </Link>
        </form>
      ) : (
        <form className="adm-login__card" onSubmit={onLogin}>
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
      )}
    </div>
  );
}
