import { useEffect, useState } from "react";
import { ArrowRight, BookmarkCheck, Compass, Leaf, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { MemorySummary } from "../components/MemorySummary.jsx";
import { TripCard } from "../components/TripCard.jsx";
import { ErrorState, LoadingState } from "../components/States.jsx";
import { api } from "../services/api.js";

const features = [
  { icon: BookmarkCheck, title: "A memory that travels", text: "Your preferences shape the next plan, not just the first one." },
  { icon: Compass, title: "Plans with your pace", text: "A little more slow mornings. A little less rushing around." },
  { icon: Leaf, title: "Thoughtful by design", text: "Your saved preferences stay scoped to your own browser profile." },
];

export default function HomePage() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadOverview() {
    setLoading(true);
    setError("");
    try {
      const [trips, memory] = await Promise.all([api.trips(), api.memory()]);
      setOverview({ trips, memory });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOverview(); }, []);

  return (
    <div className="home-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} aria-hidden="true" /> YOUR NEXT TRIP, A LITTLE MORE YOU</div>
          <h1>Travel that<br /><em>gets you.</em></h1>
          <p>Your AI travel planner that remembers how you travel. Quieter corners, the right budget, and the things you actually love.</p>
          <Link className="button button-dark" to="/planner">Plan my trip <ArrowRight size={17} aria-hidden="true" /></Link>
          <div className="hero-proof"><span className="proof-mark">✓</span> Your preferences are always yours to manage</div>
        </div>
        <div className="hero-visual" aria-label="A peaceful coastal destination">
          <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1100&q=85"
            alt="Quiet blue water and green hills seen from a lakeside" fetchPriority="high" />
          <div className="image-caption"><span className="caption-dot" /> A slower kind of getaway <span className="caption-arrow">↗</span></div>
          <div className="memory-float">
            <span className="float-icon"><Sparkles size={15} aria-hidden="true" /></span>
            <span><strong>Made more like you</strong><small>Quiet places · Slow mornings</small></span>
            <span className="float-check">✓</span>
          </div>
        </div>
        <div className="hero-index" aria-hidden="true">01 — 03</div>
      </section>

      <section className="welcome-row">
        <div>
          <p className="eyebrow eyebrow-muted">A BETTER KIND OF PLANNING</p>
          <h2>Less searching.<br /><span>More feeling there.</span></h2>
        </div>
        <p className="welcome-copy">Good travel isn't one-size-fits-all. Tell TripMind what matters to you and it will bring those little details along next time.</p>
      </section>

      <section className="feature-grid" aria-label="TripMind features">
        {features.map(({ icon: Icon, title, text }, index) => (
          <article className="feature-card" key={title}>
            <span className="feature-number">0{index + 1}</span>
            <span className="feature-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      {error && <ErrorState message={error} onRetry={loadOverview} />}

      {loading ? <LoadingState label="Getting your travel space ready…" /> : overview && (
        <>
          <section className="section-block">
            <div className="section-heading">
              <div><p className="eyebrow eyebrow-muted">THE DETAILS THAT MAKE IT YOURS</p><h2>Your travel memory</h2></div>
              <Link className="quiet-link" to="/memory">See all <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            <MemorySummary preferences={overview.memory.preferences} memories={overview.memory.memories} />
          </section>

          <section className="section-block recent-section">
            <div className="section-heading">
              <div><p className="eyebrow eyebrow-muted">PICK UP WHERE YOU LEFT OFF</p><h2>Recent trips</h2></div>
              <Link className="quiet-link" to="/trips">All trips <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            {overview.trips.length > 0 ? (
              <div className="trip-grid">{overview.trips.slice(0, 2).map((trip) => <TripCard key={trip.id} trip={trip} />)}</div>
            ) : (
              <div className="home-empty">
                <span className="empty-icon"><Compass size={21} aria-hidden="true" /></span>
                <div><strong>Your first trip is waiting.</strong><p>Start with a place in mind, or let TripMind help you find one.</p></div>
                <Link className="quiet-link" to="/planner">Start planning <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            )}
          </section>
        </>
      )}

      <section className="closing-callout">
        <div><span className="callout-mark"><Sparkles size={17} aria-hidden="true" /></span><p><strong>Your next trip can start from what you love.</strong><br />The little things you share make the next plan feel more like yours.</p></div>
        <Link className="button button-light" to="/planner">Let's plan <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
