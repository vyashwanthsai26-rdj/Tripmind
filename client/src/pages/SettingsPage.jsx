import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Database, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/States.jsx";
import { api } from "../services/api.js";

export default function SettingsPage() {
  const [session, setSession] = useState(null);
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const [currentSession, currentMemory] = await Promise.all([api.session(), api.memory()]);
      setSession(currentSession);
      setMemory(currentMemory);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSettings(); }, []);

  async function clearMemory() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await api.clearMemory();
      setConfirmClear(false);
      setNotice("Your saved travel memory has been cleared. Trip history was left unchanged.");
      await loadSettings();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  if (loading && !session) return <LoadingState label="Loading your settings…" />;

  return (
    <div className="settings-page">
      <div className="page-heading-row settings-heading">
        <div><p className="eyebrow eyebrow-muted">YOUR SPACE, YOUR CALL</p><h1>Settings</h1><p className="page-intro">A few details about how TripMind works for you.</p></div>
      </div>
      {error && <ErrorState message={error} onRetry={loadSettings} />}
      {notice && <div className="success-banner" role="status"><Check size={17} aria-hidden="true" />{notice}</div>}

      {session && (
        <div className="settings-sections">
          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
              <div><p className="eyebrow eyebrow-muted">YOUR PROFILE</p><h2>Private to this browser</h2></div></div>
            <p className="settings-description">TripMind keeps your trips and travel memory in a signed browser profile. Your browser ID is never sent as a client-chosen user ID.</p>
            <div className="settings-detail-row"><span>Profile type</span><strong>Browser profile</strong></div>
            <div className="settings-detail-row"><span>Sign-in account</span><strong>Not set up</strong></div>
            <p className="settings-caution"><AlertTriangle size={15} aria-hidden="true" /> Anyone with access to this browser profile can use its saved trips. Account sign-in is a future improvement.</p>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-icon"><Database size={18} aria-hidden="true" /></span>
              <div><p className="eyebrow eyebrow-muted">CONNECTED SERVICES</p><h2>What powers your plans</h2></div></div>
            <p className="settings-description">External service credentials stay on the server. Demo mode is clearly identified when a service isn't configured.</p>
            <div className="service-status-list">
              <div className="settings-detail-row"><span>Trip storage</span><strong><span className="status-dot" />{session.database === "mongodb" ? "MongoDB" : "Local demo file"}</strong></div>
              <div className="settings-detail-row"><span>Itinerary generation</span><strong><span className={`status-dot${session.aiConfigured ? "" : " status-dot-muted"}`} />{session.aiConfigured ? "AI service configured" : "Sample plan mode"}</strong></div>
              <div className="settings-detail-row"><span>Long-term memory</span><strong><span className={`status-dot${session.hindsightConfigured ? "" : " status-dot-muted"}`} />{session.hindsightConfigured ? "Hindsight configured" : "Profile memory only"}</strong></div>
            </div>
            <div className="settings-inline-link"><KeyRound size={15} aria-hidden="true" /><span>Service keys belong in the server's private <code>.env</code> file.</span></div>
          </section>

          <section className="settings-card settings-memory-card">
            <div className="settings-card-heading"><span className="settings-icon settings-icon-danger"><Trash2 size={18} aria-hidden="true" /></span>
              <div><p className="eyebrow eyebrow-muted">MEMORY CONTROLS</p><h2>Clear travel memory</h2></div></div>
            <p className="settings-description">This removes saved preference notes and attempts to delete their Hindsight documents. Your trip history is kept. This cannot be undone.</p>
            {!confirmClear ? (
              <button className="button button-outline-danger" type="button" onClick={() => setConfirmClear(true)}>
                <Trash2 size={16} aria-hidden="true" /> Clear my memory
              </button>
            ) : (
              <div className="confirm-panel" role="group" aria-labelledby="confirm-title" aria-describedby="confirm-description">
                <strong id="confirm-title">Clear the preferences TripMind remembers?</strong>
                <p id="confirm-description">Saved trips will remain. If Hindsight is unavailable, TripMind will keep the local memory unchanged and show an error.</p>
                <div><button className="button button-outline" type="button" onClick={() => setConfirmClear(false)} disabled={pending}>Keep my memory</button>
                  <button className="button button-danger" type="button" onClick={clearMemory} disabled={pending}>{pending ? "Clearing…" : "Yes, clear memory"}</button></div>
              </div>
            )}
            {memory && <Link className="quiet-link settings-memory-link" to="/memory">Review your saved memory <ArrowRight size={15} aria-hidden="true" /></Link>}
          </section>
        </div>
      )}
    </div>
  );
}
