import { useEffect, useState } from "react";
import { Lock, Settings, ShieldCheck, X } from "lucide-react";
import type { OwnerPrivateSettings } from "../lib/firebase";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  firebaseConfigured: boolean;
}

export function OwnerLoginModal({ open, onClose, onGoogleLogin, firebaseConfigured }: LoginModalProps) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleGoogle() {
    setErr(null);
    setBusy(true);
    try {
      await onGoogleLogin();
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-signin-title"
    >
      <div className="surface-card rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-ui font-semibold text-sm" id="owner-signin-title">
            <Lock className="w-4 h-4 text-accent-ui" />
            <span>Owner Sign In</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="text-muted-ui hover:text-primary-ui p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!firebaseConfigured ? (
          <div className="badge-warn p-3.5 rounded-xl text-xs space-y-1.5">
            <div className="font-semibold">Firebase not configured</div>
            <p className="leading-relaxed">
              Add your <code>VITE_FIREBASE_*</code> and <code>VITE_OWNER_EMAIL</code> variables to enable Owner Login. Guests can analyze handles right away without signing in.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="surface-inset rounded-xl p-3.5 flex items-start gap-2.5 text-secondary-ui leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-ok-ui shrink-0 mt-0.5" />
              <p>
                Sign in with the repository owner&apos;s Google account to unlock persistent Firestore tickmarks, notes, and your private Gemini AI Coach. Other accounts are rejected automatically.
              </p>
            </div>
            {err && (
              <div className="badge-gap p-3 rounded-xl">
                {err}
              </div>
            )}
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="btn-primary w-full py-2.5 px-4 rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-60"
            >
              {busy ? "Signing in with Google..." : "Continue with Google"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: OwnerPrivateSettings;
  onSave: (s: OwnerPrivateSettings) => Promise<void>;
}

export function OwnerSettingsModal({ open, onClose, settings, onSave }: SettingsModalProps) {
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey || "");
  const [targetCf, setTargetCf] = useState(String(settings.targetCfRating || 1600));
  const [targetLc, setTargetLc] = useState(String(settings.targetLcRating || 2150));
  const [cfHandle, setCfHandle] = useState(settings.cfHandle || "shivanshx365");
  const [acHandle, setAcHandle] = useState(settings.acHandle || "shivanshx365");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setGeminiKey(settings.geminiKey || "");
    setTargetCf(String(settings.targetCfRating || 1600));
    setTargetLc(String(settings.targetLcRating || 2150));
    setCfHandle(settings.cfHandle || "shivanshx365");
    setAcHandle(settings.acHandle || "shivanshx365");
  }, [settings, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        geminiKey: geminiKey.trim(),
        targetCfRating: Number(targetCf) || 1600,
        targetLcRating: Number(targetLc) || 2150,
        cfHandle: cfHandle.trim() || "shivanshx365",
        acHandle: acHandle.trim() || "shivanshx365",
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-settings-title"
    >
      <div className="surface-card rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-ui font-semibold text-sm" id="owner-settings-title">
            <Settings className="w-4 h-4 text-accent-ui" />
            <span>Owner Private Settings</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings dialog"
            className="text-muted-ui hover:text-primary-ui p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div className="space-y-1.5">
            <label htmlFor="gemini-key-input" className="block text-secondary-ui font-medium">
              Gemini API Key
            </label>
            <input
              id="gemini-key-input"
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              className="input-field w-full px-3 py-2 rounded-xl"
            />
            <p className="text-muted-ui">Stored strictly inside your private Firestore document, never exposed to guests.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="settings-cf" className="block text-secondary-ui font-medium">CF Handle</label>
              <input
                id="settings-cf"
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                className="input-field w-full px-3 py-2 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-ac" className="block text-secondary-ui font-medium">AtCoder Handle</label>
              <input
                id="settings-ac"
                value={acHandle}
                onChange={(e) => setAcHandle(e.target.value)}
                className="input-field w-full px-3 py-2 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="settings-tcf" className="block text-secondary-ui font-medium">Target CF Rating</label>
              <input
                id="settings-tcf"
                type="number"
                value={targetCf}
                onChange={(e) => setTargetCf(e.target.value)}
                className="input-field w-full px-3 py-2 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-tlc" className="block text-secondary-ui font-medium">Target LC Rating</label>
              <input
                id="settings-tlc"
                type="number"
                value={targetLc}
                onChange={(e) => setTargetLc(e.target.value)}
                className="input-field w-full px-3 py-2 rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full py-2.5 rounded-xl font-semibold transition disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save to Private Firestore"}
          </button>
        </form>
      </div>
    </div>
  );
}
