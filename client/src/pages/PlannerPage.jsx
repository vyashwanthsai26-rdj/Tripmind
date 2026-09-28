import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, Leaf, LoaderCircle, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorState } from "../components/States.jsx";
import { api } from "../services/api.js";

const interestOptions = ["Beaches", "Nature", "Local food", "Culture", "Wildlife", "History", "Hiking", "Art"];
const dislikeOptions = ["Crowds", "Nightlife", "Long drives", "Early starts", "Shopping", "Packed schedules"];
const travelStyles = ["Relaxed", "Balanced", "Adventure", "Slow travel"];
const initialForm = {
  destination: "",
  days: 4,
  budget: "",
  interests: ["Nature"],
  dislikes: [],
  preferredDestinations: "",
  travelStyle: "Relaxed",
  transportation: "",
  foodPreference: "",
  additionalNotes: "",
  rememberPreferences: true,
};

function ChoiceChips({ label, options, selected, onToggle, describedBy }) {
  return (
    <fieldset className="form-field chip-field" aria-describedby={describedBy}>
      <legend>{label}</legend>
      <div className="choice-chips">
        {options.map((item) => {
          const active = selected.includes(item);
          return (
            <button key={item} className={`choice-chip${active ? " choice-chip-active" : ""}`}
              type="button" aria-pressed={active} onClick={() => onToggle(item)}>
              {active && <Check size={13} aria-hidden="true" />}{item}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function PlannerPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggle(field, value) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await api.planTrip({
        ...form,
        days: Number(form.days),
        budget: form.budget === "" ? null : Number(form.budget),
        preferredDestinations: form.preferredDestinations.split(",").map((place) => place.trim()).filter(Boolean),
      });
      navigate(`/trips/${result.trip.id}`, { state: { planResult: result } });
    } catch (requestError) {
      setError(requestError.message);
      setPending(false);
    }
  }

  return (
    <div className="planner-page">
      <Link className="back-link" to="/"><ArrowLeft size={15} aria-hidden="true" /> Back to home</Link>
      <div className="planner-heading">
        <div className="planner-heading-copy">
          <p className="eyebrow"><Compass size={14} aria-hidden="true" /> A PLAN, MADE YOURS</p>
          <h1>Where would you<br /><em>love to go?</em></h1>
          <p>Share a few details. TripMind will bring what it remembers about you, too.</p>
        </div>
        <div className="planner-aside">
          <span className="planner-aside-icon"><Sparkles size={17} aria-hidden="true" /></span>
          <span><strong>Your preferences matter.</strong><small>What you save helps with the next trip.</small></span>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      <form className={`planner-form${pending ? " planner-form-pending" : ""}`} onSubmit={submit}>
        <div className="form-section">
          <div className="form-section-heading"><span>01</span><div><h2>The trip</h2><p>Start with the basics. You can keep it open-ended.</p></div></div>
          <div className="form-grid">
            <label className="form-field form-field-wide" htmlFor="destination">
              <span>Destination <span className="field-optional">Optional — let TripMind choose</span></span>
              <input id="destination" name="destination" type="text" maxLength="80" placeholder="A place you have in mind"
                value={form.destination} onChange={(event) => update("destination", event.target.value)} disabled={pending} />
            </label>
            <label className="form-field" htmlFor="days">
              <span>How long?</span>
              <span className="input-with-unit"><input id="days" name="days" type="number" min="1" max="21" required
                value={form.days} onChange={(event) => update("days", event.target.value)} disabled={pending} /><span>days</span></span>
            </label>
            <label className="form-field" htmlFor="budget">
              <span>Budget <span className="field-optional">INR</span></span>
              <span className="input-with-unit"><span className="input-prefix">₹</span><input id="budget" name="budget" type="number"
                min="0" max="10000000" placeholder="Flexible" value={form.budget}
                onChange={(event) => update("budget", event.target.value)} disabled={pending} /></span>
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-heading"><span>02</span><div><h2>Your kind of trip</h2><p>Choose what sounds good — and what doesn't.</p></div></div>
          <ChoiceChips label="What are you drawn to?" options={interestOptions} selected={form.interests}
            onToggle={(value) => toggle("interests", value)} />
          <ChoiceChips label="What would you rather skip?" options={dislikeOptions} selected={form.dislikes}
            onToggle={(value) => toggle("dislikes", value)} />
          <fieldset className="form-field style-field">
            <legend>How do you like to travel?</legend>
            <div className="style-options">
              {travelStyles.map((style) => (
                <button key={style} type="button" onClick={() => update("travelStyle", style)}
                  className={`style-option${form.travelStyle === style ? " style-option-active" : ""}`}
                  aria-pressed={form.travelStyle === style}>
                  <span className="style-check">{form.travelStyle === style && <Check size={13} aria-hidden="true" />}</span>
                  <span>{style}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="form-section">
          <div className="form-section-heading"><span>03</span><div><h2>The little details</h2><p>Optional details make a plan feel considered.</p></div></div>
          <div className="form-grid">
            <label className="form-field" htmlFor="transportation">
              <span>Getting around</span>
              <select id="transportation" value={form.transportation} onChange={(event) => update("transportation", event.target.value)} disabled={pending}>
                <option value="">No preference</option><option>Train</option><option>Bus</option><option>Car</option><option>Walking</option><option>Public transport</option>
              </select>
            </label>
            <label className="form-field" htmlFor="foodPreference">
              <span>Food &amp; drink</span>
              <input id="foodPreference" type="text" maxLength="80" placeholder="Local food, vegetarian…"
                value={form.foodPreference} onChange={(event) => update("foodPreference", event.target.value)} disabled={pending} />
            </label>
            <label className="form-field form-field-wide" htmlFor="preferredDestinations">
              <span>Places you love returning to <span className="field-optional">Optional</span></span>
              <input id="preferredDestinations" type="text" maxLength="300" placeholder="Separate places with commas"
                value={form.preferredDestinations}
                onChange={(event) => update("preferredDestinations", event.target.value)}
                disabled={pending} />
            </label>
            <label className="form-field form-field-wide" htmlFor="additionalNotes">
              <span>Anything else on your mind?</span>
              <textarea id="additionalNotes" maxLength="500" rows="3"
                placeholder="A peaceful trip, a special occasion, or something you usually love…"
                value={form.additionalNotes} onChange={(event) => update("additionalNotes", event.target.value)} disabled={pending} />
              <small className="field-hint">Only lasting preferences you choose to save become part of your travel memory.</small>
            </label>
          </div>
        </div>

        <label className="remember-choice">
          <input type="checkbox" checked={form.rememberPreferences}
            onChange={(event) => update("rememberPreferences", event.target.checked)} disabled={pending} />
          <span className="remember-check"><Check size={13} aria-hidden="true" /></span>
          <span><strong>Remember these preferences and planned destinations</strong><small>You can review or clear them anytime.</small></span>
        </label>

        <div className="form-submit-row">
          <p><Leaf size={15} aria-hidden="true" /> The configured AI provider receives trip details. Don’t include contact, account, or identity information.</p>
          <button className="button button-dark button-submit" type="submit" disabled={pending}>
            {pending ? <><LoaderCircle className="spin-icon" size={17} aria-hidden="true" /> Bringing your plan together…</> : <>Create my itinerary <ArrowRight size={17} aria-hidden="true" /></>}
          </button>
        </div>
      </form>
    </div>
  );
}
