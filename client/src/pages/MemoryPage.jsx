import { useEffect, useState } from "react";
import { ArrowRight, BookHeart, Heart, Leaf, Plus, Train, Utensils, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/States.jsx";
import { api, formatRupees, friendlyDate } from "../services/api.js";

const categoryLabel = {
  likes: "You enjoy",
  dislikes: "You avoid",
  destinations: "Places you love returning to",
  style: "Your travel style",
  transportation: "Getting around",
  food: "Food & drink",
  budget: "Your usual budget",
  note: "A note to remember",
  "previous-trip": "A planned destination",
};

export default function MemoryPage() {
  const [memory, setMemory] = useState(null);
  const [trips, setTrips] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadMemory() {
    setLoading(true);
    setError("");
    try {
      const [currentMemory, tripHistory] = await Promise.all([api.memory(), api.trips()]);
      setMemory(currentMemory);
      setTrips(tripHistory);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMemory(); }, []);

  async function saveNote(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await api.addMemory(note);
      const refreshed = await api.memory();
      setMemory(refreshed);
      setNote("");
      setNotice(result.warning || "Your travel memory has been updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  if (loading && !memory) return <LoadingState label="Gathering what makes a trip yours…" />;

  const preferences = memory?.preferences ?? {};
  const previousDestinations = [...new Set(trips.map((trip) => trip.destination).filter(Boolean))];
  const isEmpty = !memory?.memories?.length && !previousDestinations.length;

  return (
    <div className="memory-page">
      <section className="memory-hero">
        <div className="memory-hero-copy">
          <p className="eyebrow"><BookHeart size={14} aria-hidden="true" /> YOUR PERSONAL TRAVEL MEMORY</p>
          <h1>Every traveler<br /><em>has their own way.</em></h1>
          <p>These are the little things TripMind can carry into your next plan. You decide what to share and when to clear it.</p>
        </div>
        <span className="memory-hero-stamp" aria-hidden="true"><Heart size={28} strokeWidth={1.25} /></span>
      </section>

      {error && <ErrorState message={error} onRetry={loadMemory} />}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {memory && (
        <>
          {!memory.semanticMemoryConfigured && (
            <div className="notice-banner notice-banner-soft"><BookHeart size={17} aria-hidden="true" />
              <span>Profile memory is saved here. Connect Hindsight to enable semantic long-term recall between plans.</span>
            </div>
          )}

          {isEmpty ? (
            <div className="empty-state memory-empty">
              <span className="empty-state-icon"><Leaf size={24} aria-hidden="true" /></span>
              <p className="eyebrow eyebrow-muted">NOTHING WRITTEN YET</p>
              <h2>We can start with what you love.</h2>
              <p>Plan a trip and choose to remember your preferences, or add a note below.</p>
              <Link className="button button-dark" to="/planner">Share your travel style <ArrowRight size={16} /></Link>
            </div>
          ) : (
            <div className="memory-dashboard">
              <section className="memory-overview">
                <div className="memory-overview-title"><p className="eyebrow eyebrow-muted">THE QUICK PICTURE</p><h2>What makes it yours</h2></div>
                <div className="memory-overview-grid">
                  <article className="memory-tile">
                    <span className="memory-tile-icon"><Wallet size={17} aria-hidden="true" /></span>
                    <span>Typical budget</span><strong>{formatRupees(preferences.typicalBudget)}</strong>
                    <small>For a usual trip</small>
                  </article>
                  <article className="memory-tile">
                    <span className="memory-tile-icon"><Leaf size={17} aria-hidden="true" /></span>
                    <span>Your pace</span><strong>{preferences.travelStyle || "Still discovering"}</strong>
                    <small>Travel style</small>
                  </article>
                  <article className="memory-tile">
                    <span className="memory-tile-icon"><Train size={17} aria-hidden="true" /></span>
                    <span>Getting around</span><strong>{preferences.transportation || "Flexible"}</strong>
                    <small>Preferred transport</small>
                  </article>
                  <article className="memory-tile">
                    <span className="memory-tile-icon"><Utensils size={17} aria-hidden="true" /></span>
                    <span>Food &amp; drink</span><strong>{preferences.foodPreference || "Open to ideas"}</strong>
                    <small>What you enjoy</small>
                  </article>
                  <article className="memory-tile">
                    <span className="memory-tile-icon"><Heart size={17} aria-hidden="true" /></span>
                    <span>Places you love</span><strong>{preferences.preferredDestinations?.join(", ") || "To be discovered"}</strong>
                    <small>Favorite destinations</small>
                  </article>
                </div>
              </section>

              <section className="memory-list-section">
                <div className="section-heading"><div><p className="eyebrow eyebrow-muted">THINGS YOU'VE SHARED</p><h2>Little things that matter</h2></div>
                  <span className="memory-total">{memory.memories.length} saved</span></div>
                {memory.memories.length ? (
                  <div className="memory-list">
                    {memory.memories.map((item) => (
                      <article className="memory-list-item" key={item.id}>
                        <span className={`memory-category-icon memory-category-${item.category}`} aria-hidden="true">
                          {item.category === "budget" ? <Wallet size={16} /> : item.category === "food" ? <Utensils size={16} /> : <Heart size={16} />}
                        </span>
                        <div>
                          <span className="memory-category">{categoryLabel[item.category] || "A note to remember"}
                            {!item.isCurrent && <span className="memory-updated-label">UPDATED</span>}
                          </span>
                          <p>{item.text}</p>
                        </div>
                        <time dateTime={item.createdAt}>{friendlyDate(item.createdAt)}</time>
                      </article>
                    ))}
                  </div>
                ) : <p className="muted-copy">No saved preferences yet. Your previous trips are listed below.</p>}
              </section>
            </div>
          )}

          {previousDestinations.length > 0 && (
            <section className="memory-list-section previous-destinations">
              <div className="section-heading"><div><p className="eyebrow eyebrow-muted">PLACES YOU'VE PLANNED</p><h2>Previous destinations</h2></div></div>
              <div className="destination-pills">{previousDestinations.map((destination) => <span key={destination}>{destination}</span>)}</div>
            </section>
          )}

          <section className="add-memory-card">
            <div><p className="eyebrow eyebrow-muted">SOMETHING TO ADD?</p><h2>Leave a note for next time.</h2>
              <p>Write a lasting preference, like “I usually prefer quiet places.” One-time requests aren't kept.</p></div>
            <form onSubmit={saveNote} className="add-memory-form">
              <label htmlFor="memory-note">A travel preference to remember</label>
              <textarea id="memory-note" rows="3" maxLength="500" required
                placeholder="I usually love exploring local food markets…"
                value={note} onChange={(event) => setNote(event.target.value)} disabled={pending} />
              <button className="button button-dark" type="submit" disabled={pending}>
                <Plus size={16} aria-hidden="true" /> {pending ? "Saving…" : "Save to my memory"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
