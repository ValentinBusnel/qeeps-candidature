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
  const { email, login, checking, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const key = params.get("cle") ?? "";
  const token = params.get("invitation") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ needed: boolean; keyValid: boolean; email: string } | null>(null);
  const [invite, setInvite] = useState<{ valid: boolean; email?: string; reset?: boolean } | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  useEffect(() => {
    if (!token) return;
    adminApi
      .inviteStatus(token)
      .then(setInvite)
      .catch(() => setInvite({ valid: false }));
  }, [token]);

  useEffect(() => {
    adminApi
      .setupStatus(key)
      .then(setSetup)
      .catch(() => setSetup({ needed: false, keyValid: false, email: "" }));
  }, [key]);

  // un lien d'invitation prime sur une éventuelle session ouverte (autre compte sur ce navigateur)
  if (!checking && email && !token) return <Navigate to={from} replace />;

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
      setUser(u);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true);
    setError(null);
    try {
      setUser(await adminApi.acceptInvite(token, password));
      navigate("/admin", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const creating = setup?.needed;

  if (token) {
    return (
      <div className="adm-login">
        <div className="adm-login__glow" />
        <form className="adm-login__card" onSubmit={onInvite}>
          <p className="adm-logo">
            Valentin<span>.</span> <small>admin</small>
          </p>
          <div>
            <h1 className="t-h3">{invite?.reset ? "Nouveau mot de passe" : "Bienvenue"}</h1>
            <p className="t-sub">
              {invite?.reset
                ? "Choisissez un nouveau mot de passe pour votre accès."
                : "Vous avez été invité(e) à l'espace d'administration. Choisissez votre mot de passe pour y accéder."}
            </p>
          </div>
          {!invite ? (
            <p className="adm-hint">Vérification du lien…</p>
          ) : invite.valid ? (
            <>
              <div className="field">
                <label htmlFor="inv-email">Email</label>
                <input id="inv-email" name="email" type="email" className="input" autoComplete="username" value={invite.email ?? ""} readOnly />
              </div>
              <div className="field">
                <label htmlFor="inv-password">Mot de passe</label>
                <input id="inv-password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required autoFocus />
                <p className="adm-hint">10 caractères minimum.</p>
              </div>
              <div className="field">
                <label htmlFor="inv-confirm">Confirmez le mot de passe</label>
                <input id="inv-confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={10} required />
              </div>
              {error && <p className="adm-error">{error}</p>}
              <button className="btn btn--primary btn--block" disabled={busy}>
                <Icon name="check" /> {busy ? "Enregistrement…" : "Valider mon mot de passe"}
              </button>
            </>
          ) : (
            <p className="adm-error">Ce lien n'est plus valable (déjà utilisé ou expiré). Demandez une nouvelle invitation à l'administrateur.</p>
          )}
          <Link to="/admin/connexion" className="adm-login__back">
            ← Page de connexion
          </Link>
        </form>
      </div>
    );
  }

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
