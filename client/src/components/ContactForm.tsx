import { FormEvent, useState } from "react";
import { api } from "../api";
import { Icon } from "./Icons";
import { useSite } from "../content";

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

export default function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const { t } = useSite();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setStatus({ kind: "sending" });
    try {
      await api.sendMessage({
        name: data.name,
        email: data.email,
        message: data.message
      });
      form.reset();
      setStatus({ kind: "sent" });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="contact-done">
        <span className="tag tag--green">
          <Icon name="check" /> {t("contact.sentTag")}
        </span>
        <p className="t-lead">{t("contact.sent")}</p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={onSubmit}>
      <div className="contact-form__row">
        <div className="field">
          <label htmlFor="name">{t("contact.name")}</label>
          <input id="name" name="name" className="input" placeholder={t("contact.namePh")} required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="email">{t("contact.email")}</label>
          <input id="email" name="email" type="email" className="input" placeholder={t("contact.emailPh")} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="message">{t("contact.message")}</label>
        <textarea
          id="message"
          name="message"
          className="input"
          placeholder={t("contact.messagePh")}
          required
          minLength={10}
        />
      </div>

      {status.kind === "error" && (
        <p className="contact-form__error">{status.message}. {t("contact.error")}</p>
      )}

      <button className="btn btn--primary btn--block" disabled={status.kind === "sending"}>
        <Icon name="send" />
        {status.kind === "sending" ? t("contact.sending") : t("contact.send")}
      </button>
    </form>
  );
}
