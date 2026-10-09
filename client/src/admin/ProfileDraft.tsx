import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApi, ApiError, type Profile } from "../api";
import { useAuth } from "./AuthContext";
import { useBeforeUnload, useToast } from "./ui";

/**
 * Brouillon partagé du profil : toutes les pages "contenu" de l'admin éditent le même
 * document. Les changements restent en mémoire d'une page à l'autre et s'enregistrent
 * en une fois depuis la barre du bas.
 */
interface DraftState {
  draft: Profile | null;
  /** dernière version publiée (pour repérer les sections modifiées) */
  saved: Profile | null;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  update: (fn: (p: Profile) => Profile) => void;
  save: () => Promise<void>;
  discard: () => void;
  reload: () => void;
}

const DraftContext = createContext<DraftState | null>(null);

export function useProfileDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useProfileDraft hors de ProfileDraftProvider");
  return ctx;
}

export function ProfileDraftProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const toast = useToast();
  const { logout } = useAuth();

  useEffect(() => {
    adminApi
      .profile()
      .then((p) => {
        setSaved(p);
        setDraft(p);
      })
      .catch((e: Error) => setError(e.message));
  }, [tick]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  useBeforeUnload(dirty);

  const update = useCallback((fn: (p: Profile) => Profile) => setDraft((d) => (d ? fn(d) : d)), []);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const p = await adminApi.saveProfile(draft);
      setSaved(p);
      setDraft(p);
      toast("Publié : le site est à jour");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await logout();
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }, [draft, toast, logout]);

  const discard = useCallback(() => setDraft(saved), [saved]);

  return (
    <DraftContext.Provider value={{ draft, saved, dirty, saving, error, update, save, discard, reload: () => setTick((t) => t + 1) }}>
      {children}
    </DraftContext.Provider>
  );
}

/** Raccourci : met à jour une clé de premier niveau du profil. */
export function useProfileField<K extends keyof Profile>(key: K) {
  const { draft, update } = useProfileDraft();
  return [draft?.[key] as Profile[K], (value: Profile[K]) => update((p) => ({ ...p, [key]: value }))] as const;
}
