import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, MapPin, Sparkles } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/States.jsx";
import { TripCard } from "../components/TripCard.jsx";
import { api, formatRupees, friendlyDate } from "../services/api.js";

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadTrips() {
    setLoading(true);
    setError("");
    try {
      setTrips(await api.trips());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTrips(); }, []);

  return (
    <div className="trips-page">
      <div className="page-heading-row">
        <div><p className="eyebrow eyebrow-muted">YOUR OWN LITTLE ATLAS</p><h1>My trips</h1><p className="page-intro">Every plan you make, all in one place.</p></div>
        <Link className="button button-dark" to="/planner">Plan a trip <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      {error && <ErrorState message={error} onRetry={loadTrips} />}
      {loading ? <LoadingState label="Finding your trips…" /> : trips.length ? (
        <div className="trip-grid trip-grid-page">{trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}</div>
      ) : (
        <div className="empty-state">
          <span className="empty-state-icon"><MapPin size={24} aria-hidden="true" /></span>
          <p className="eyebrow eyebrow-muted">A PAGE YET TO BE WRITTEN</p>
          <h2>Your first trip is out there.</h2>
          <p>Start with a place you love, a feeling you're after, or just a few days to get away.</p>
          <Link className="button button-dark" to="/planner">Make your first plan <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      )}
    </div>
  );
}

export function TripDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const cached = location.state?.planResult?.trip;
  const planResult = location.state?.planResult;
  const [trip, setTrip] = useState(cached ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let active = true;
    api.trip(id).then((savedTrip) => {
      if (active) setTrip(savedTrip);
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  if (loading && !trip) return <LoadingState label="Opening your itinerary…" />;
  if (error && !trip) {
    return <div className="detail-error"><ErrorState message={error} /><Link className="back-link" to="/trips"><ArrowLeft size={15} /> Back to trips</Link></div>;
  }
  if (!trip) return <ErrorState message="This trip isn't available in your current browser profile." />;

  const warnings = planResult?.warnings ?? [];
  return (
    <div className="trip-detail-page">
      <Link className="back-link" to="/trips"><ArrowLeft size={15} aria-hidden="true" /> All trips</Link>
      {warnings.map((warning) => <div className="notice-banner" role="status" key={warning}><Sparkles size={17} aria-hidden="true" />{warning}</div>)}
      {error && <div className="notice-banner notice-banner-soft" role="status">Showing the plan saved during this visit. We couldn't refresh it from the API.</div>}
      <section className="trip-detail-hero">
        <p className="eyebrow"><Sparkles size={14} aria-hidden="true" /> {trip.generationMode === "ai" ? "MADE AROUND YOUR REQUEST" : "A THOUGHTFUL STARTING POINT"}</p>
        <h1>{trip.destination}</h1>
        <p className="trip-detail-summary">{trip.summary}</p>
        <div className="trip-facts">
          <div><CalendarDays size={17} aria-hidden="true" /><span>{trip.days} days</span></div>
          <div><MapPin size={17} aria-hidden="true" /><span>{formatRupees(trip.budget)} estimated</span></div>
          <div><span className="fact-dot" /> Planned {friendlyDate(trip.createdAt)}</div>
        </div>
      </section>

      {trip.whyThisFits?.length > 0 && (
        <section className="why-card">
          <span className="why-card-icon"><Sparkles size={18} aria-hidden="true" /></span>
          <div><p className="eyebrow eyebrow-muted">THE REASONS THIS FEELS LIKE YOU</p>
            <ul>{trip.whyThisFits.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
        </section>
      )}

      <section className="itinerary-section">
        <div className="section-heading">
          <div><p className="eyebrow eyebrow-muted">A LITTLE ROOM TO WANDER</p><h2>Your itinerary</h2></div>
          <span className="itinerary-count">{trip.itinerary?.length || trip.days} days</span>
        </div>
        <div className="itinerary-list">
          {(trip.itinerary ?? []).map((day, index) => (
            <article className="itinerary-day" key={`${day.title}-${index}`}>
              <div className="day-rail"><span className="day-number">0{index + 1}</span><span className="day-line" /></div>
              <div className="day-content">
                <div className="day-heading"><h3>{day.title || `Day ${index + 1}`}</h3>
                  {day.estimatedSpend !== null && day.estimatedSpend !== undefined && <span>{formatRupees(day.estimatedSpend)} est.</span>}
                </div>
                <div className="day-activities">
                  <div><span className="activity-time">MORNING</span><p>{day.morning}</p></div>
                  <div><span className="activity-time">AFTERNOON</span><p>{day.afternoon}</p></div>
                  <div><span className="activity-time">EVENING</span><p>{day.evening}</p></div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {trip.tips?.length > 0 && (
        <section className="tips-card">
          <span className="tips-card-icon">✳</span>
          <div><p className="eyebrow eyebrow-muted">A FEW THINGS TO KEEP IN MIND</p>
            <ul>{trip.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </div>
        </section>
      )}

      {(trip.foodSuggestions?.length > 0 || trip.transportSuggestions?.length > 0) && (
        <section className="suggestions-grid" aria-label="Food and transportation suggestions">
          {trip.foodSuggestions?.length > 0 && <div className="suggestion-card"><p className="eyebrow eyebrow-muted">A TASTE OF THE PLACE</p><h2>Food ideas</h2>
            <ul>{trip.foodSuggestions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {trip.transportSuggestions?.length > 0 && <div className="suggestion-card"><p className="eyebrow eyebrow-muted">GETTING AROUND</p><h2>Transport notes</h2>
            <ul>{trip.transportSuggestions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        </section>
      )}

      {trip.memoriesUsed?.length > 0 && (
        <section className="memories-used">
          <div className="section-heading"><div><p className="eyebrow eyebrow-muted">A LITTLE CONTEXT FROM BEFORE</p><h2>What TripMind remembered</h2></div></div>
          <div className="memory-chip-list">{trip.memoriesUsed.map((memory) => <span className="memory-chip" key={memory}>{memory}</span>)}</div>
        </section>
      )}

      <p className="trip-disclaimer">Travel ideas and estimates are AI-generated suggestions, not live-verified prices, schedules, opening hours, or availability. Check current local information before booking.</p>
      <div className="detail-bottom-actions">
        <Link className="quiet-link" to="/memory">Visit your travel memory <ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link className="button button-dark" to="/planner">Plan another trip <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
