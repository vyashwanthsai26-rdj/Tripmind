import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRupees, friendlyDate } from "../services/api.js";

export function TripCard({ trip }) {
  return (
    <Link className="trip-card" to={`/trips/${trip.id}`}>
      <div className="trip-card-image">
        <span className="trip-card-monogram" aria-hidden="true">{trip.destination?.slice(0, 1).toUpperCase() || "T"}</span>
        <span className="trip-card-days">{trip.days} days</span>
      </div>
      <div className="trip-card-content">
        <div className="trip-card-topline">
          <span className="trip-card-date"><CalendarDays size={14} aria-hidden="true" />{friendlyDate(trip.createdAt)}</span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </div>
        <h3>{trip.destination}</h3>
        <p className="trip-card-summary">{trip.summary || "A trip shaped around your travel style."}</p>
        <div className="trip-card-budget"><MapPin size={15} aria-hidden="true" /> Estimated budget <strong>{formatRupees(trip.budget)}</strong></div>
      </div>
    </Link>
  );
}
