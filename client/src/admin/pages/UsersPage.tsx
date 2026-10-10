import { FormEvent, useEffect, useState } from "react";
import { adminApi, type AdminUser, type InviteResult, type Role } from "../../api";
import { Icon } from "../../components/Icons";
import { Card, Loading, PageHeader, useConfirm, useToast } from "../ui";

const ROLES: { value: Role; label: string; short: string; text: string; icon: string; tone: string }[] = [
  { value: "admin", label: "Administrateur", short: "Admin", text: "Peut tout modifier et gérer les accès", icon: "edit", tone: "cyan" },
  { value: "viewer", label: "Lecture seule", short: "Lecture seule", text: "Consulte l'admin sans rien modifier", icon: "eye", tone: "sand" }
];

const day = (d?: string) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "");

/** Choix du rôle : deux pastilles, l'indicateur glisse sous le rôle choisi. */
function RolePicker({ value, onChange, compact, disabled }: { value: Role; onChange: (r: Role) => void; compact?: boolean; disabled?: boolean }) {
  return (
    <div className={`adm-role ${compact ? "adm-role--compact" : ""}`} role="radiogroup" aria-label="Rôle" data-value={value}>
      <span className="adm-role__ind" aria-hidden="true" />
      {ROLES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          className={`adm-role__opt ${value === r.value ? "is-active" : ""}`}
          onClick={() => value !== r.value && onChange(r.value)}
          disabled={disabled}
          title={r.text}
        >
          <Icon name={r.icon} />
          <span>
            <strong>{compact ? r.short : r.label}</strong>
            {!compact && <small>{r.text}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Lien d'invitation à transmettre soi-même (envoi d'emails non configuré ou en échec). */
function LinkPanel({ result, onClose }: { result: InviteResult; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      toast("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copie impossible : sélectionnez le lien à la main", "error");
    }
  }
  return (
    <div className="adm-invite-link">
      <div className="adm-invite-link__head">
        <span className="adm-chip-icon adm-tone--sand">
          <Icon name="mail" />
        </span>
        <p>
          <strong>{result.emailSent ? "Email envoyé" : "Lien à transmettre"}</strong>
          <small>
            {result.emailSent
              ? `${result.user.email} a reçu son lien. Vous pouvez aussi le lui transmettre vous-même :`
              : `Aucun email n'est parti. Envoyez ce lien à ${result.user.email} (valable 7 jours, à usage unique) :`}
          </small>
        </p>
        <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Fermer" title="Fermer">
          <Icon name="x" />
        </button>
      </div>
      <div className="adm-invite-link__row">
        <input className="input" value={result.link} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Lien d'invitation" />
        <button type="button" className="btn btn--primary btn--sm" onClick={copy}>
          <Icon name={copied ? "check" : "copy"} /> {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

export function UsersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [mailEnabled, setMailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .users()
      .then((r) => {
        setUsers(r.users);
        setMailEnabled(r.mailEnabled);
      })
      .catch((e) => toast(e.message, "error"));
  }, [toast]);

  const upsert = (u: AdminUser) => setUsers((list) => (list?.some((x) => x._id === u._id) ? list.map((x) => (x._id === u._id ? u : x)) : [...(list ?? []), u]));

  function announce(r: InviteResult, verb: string) {
    upsert(r.user);
    setFresh(r.user._id);
    setResult(r.emailSent && mailEnabled ? null : r);
    if (r.emailSent) toast(`${verb} à ${r.user.email}`);
    else if (mailEnabled) toast("L'email n'a pas pu partir : copiez le lien ci-dessous", "error");
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      announce(await adminApi.inviteUser(email.trim(), role), "Invitation envoyée");
      setEmail("");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function resend(u: AdminUser) {
    try {
      announce(await adminApi.resendInvite(u._id), u.status === "pending" ? "Invitation renvoyée" : "Lien envoyé");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function changeRole(u: AdminUser, r: Role) {
    try {
      upsert(await adminApi.setUserRole(u._id, r));
      toast(`${u.email} : ${r === "admin" ? "administrateur" : "lecture seule"}`);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function remove(u: AdminUser) {
    const ok = await confirm({
      title: "Retirer cet accès ?",
      text: `${u.email} ne pourra plus se connecter. ${u.status === "pending" ? "Son lien d'invitation ne fonctionnera plus." : ""}`,
      confirmLabel: "Retirer l'accès",
      danger: true
    });
    if (!ok) return;
    try {
      await adminApi.deleteUser(u._id);
      setUsers((list) => list?.filter((x) => x._id !== u._id) ?? null);
      if (result?.user._id === u._id) setResult(null);
      toast("Accès retiré");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  if (!users) return <Loading />;
  const expired = (u: AdminUser) => u.status === "pending" && u.inviteExpires && new Date(u.inviteExpires).getTime() < Date.now();

  return (
    <>
      <PageHeader overline="Réglages" title="Utilisateurs" subtitle="Invitez des personnes à consulter ou modifier cet espace." />

      <Card
        title="Inviter quelqu'un"
        description={
          mailEnabled
            ? "La personne reçoit un email avec un lien pour choisir son mot de passe."
            : "Vous obtiendrez un lien à lui transmettre pour qu'elle choisisse son mot de passe."
        }
      >
        <form className="adm-invite" onSubmit={invite}>
          <div className="field">
            <label htmlFor="inv-email">Adresse email</label>
            <input id="inv-email" type="email" className="input" placeholder="prenom@entreprise.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          </div>
          <div className="field">
            <label>Rôle</label>
            <RolePicker value={role} onChange={setRole} />
          </div>
          <button className="btn btn--primary adm-invite__go" disabled={busy || !email.trim()}>
            <Icon name="send" /> {busy ? "Invitation…" : mailEnabled ? "Envoyer l'invitation" : "Créer l'invitation"}
          </button>
        </form>
        {result && <LinkPanel result={result} onClose={() => setResult(null)} />}
      </Card>

      <Card title="Accès" description={`${users.length} ${users.length > 1 ? "personnes ont" : "personne a"} accès à cet espace.`}>
        <ul className="adm-users">
          {users.map((u) => (
            <li key={u._id} className={`adm-user ${fresh === u._id ? "is-fresh" : ""}`}>
              <span className={`adm-user__avatar adm-tone--${u.role === "admin" ? "cyan" : "sand"}`}>{u.email[0]?.toUpperCase()}</span>
              <span className="adm-user__main">
                <strong>
                  {u.email}
                  {u.me && <em>vous</em>}
                </strong>
                <small>
                  {u.status === "active" ? (
                    <span className="adm-status adm-tone--green">Actif</span>
                  ) : expired(u) ? (
                    <span className="adm-status adm-tone--pink">Invitation expirée</span>
                  ) : (
                    <span className="adm-status adm-tone--sand">Invitation en attente</span>
                  )}
                  {u.status === "pending" && u.inviteExpires && !expired(u) && <span>jusqu'au {day(u.inviteExpires)}</span>}
                  {u.status === "active" && u.createdAt && <span>depuis le {day(u.createdAt)}</span>}
                </small>
              </span>
              {u.me ? (
                <span className="adm-user__role">
                  <Icon name="edit" /> Administrateur
                </span>
              ) : (
                <RolePicker compact value={u.role} onChange={(r) => changeRole(u, r)} />
              )}
              <span className="adm-user__actions">
                {!u.me && (
                  <>
                    <button
                      type="button"
                      className="adm-icon-btn"
                      onClick={() => resend(u)}
                      aria-label={u.status === "pending" ? "Renvoyer l'invitation" : "Envoyer un lien pour changer de mot de passe"}
                      title={u.status === "pending" ? "Renvoyer l'invitation" : "Envoyer un lien pour changer de mot de passe"}
                    >
                      <Icon name={u.status === "pending" ? "send" : "lock"} />
                    </button>
                    <button type="button" className="adm-icon-btn is-danger" onClick={() => remove(u)} aria-label="Retirer l'accès" title="Retirer l'accès">
                      <Icon name="trash" />
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
