import { useState } from "react";
import { Lock, Settings, X } from "lucide-react";
import type { OwnerPrivateSettings } from "../lib/firebase";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  firebaseConfigured: boolean;
}

export function OwnerLoginModal({ open, onClose, onLogin, firebaseConfigured }: LoginModalProps) {
  const [email, setEmail] = useState(import.meta.env.VITE_OWNER_EMAIL || "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await onLogin(email, password);
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>Owner Sign In (Private Persistence)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!firebaseConfigured ? (
          <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 space-y-1.5">
            <div className="font-semibold">Firebase not configured yet</div>
            <p>
              To enable Owner Login &amp; persistent notes, add your <code>VITE_FIREBASE_*</code> and{" "}
              <code>VITE_OWNER_EMAIL</code> variables (see <code>README.md</code>). Guests can use the app right away without logging in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Owner Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                placeholder="you@gmail.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            {err && <div className="text-xs text-rose-400">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-60"
            >
              {busy ? "Signing in..." : "Unlock Private Notes & AI Coach"}
            </button>
          </form>
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Owner Private Settings (Firestore Only)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-slate-300">Gemini API Key (stored ONLY in your private Firestore doc)</label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
            />
            <p className="text-slate-400">Never committed to GitHub and never visible to guest users.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-slate-300">CF Handle</label>
              <input
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300">AtCoder Handle</label>
              <input
                value={acHandle}
                onChange={(e) => setAcHandle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-slate-300">Target CF Rating</label>
              <input
                type="number"
                value={targetCf}
                onChange={(e) => setTargetCf(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300">Target LC Rating</label>
              <input
                type="number"
                value={targetLc}
                onChange={(e) => setTargetLc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
          >
            {busy ? "Saving..." : "Save to Private Firestore"}
          </button>
        </form>
      </div>
    </div>
  );
}
