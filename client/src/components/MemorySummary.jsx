import { Heart, Leaf, Wallet } from "lucide-react";
import { formatRupees } from "../services/api.js";

export function MemorySummary({ preferences, memories = [] }) {
  const favoriteThings = preferences?.interests ?? [];
  const dislikes = preferences?.dislikes ?? [];

  return (
    <div className="memory-summary">
      <div className="memory-stat">
        <span className="memory-stat-icon"><Wallet size={17} aria-hidden="true" /></span>
        <div><span>Usual budget</span><strong>{formatRupees(preferences?.typicalBudget)}</strong></div>
      </div>
      <div className="memory-stat">
        <span className="memory-stat-icon"><Leaf size={17} aria-hidden="true" /></span>
        <div><span>Travel style</span><strong>{preferences?.travelStyle || "Still getting to know you"}</strong></div>
      </div>
      <div className="memory-stat memory-stat-wide">
        <span className="memory-stat-icon"><Heart size={17} aria-hidden="true" /></span>
        <div>
          <span>What makes a trip yours</span>
          <div className="memory-tags">
            {favoriteThings.slice(0, 4).map((item) => <span className="memory-tag" key={`like-${item}`}>{item}</span>)}
            {dislikes.slice(0, 2).map((item) => <span className="memory-tag memory-tag-muted" key={`avoid-${item}`}>Avoid {item.toLowerCase()}</span>)}
            {memories.length === 0 && favoriteThings.length === 0 && dislikes.length === 0
              && <span className="muted-copy">Your travel memory will grow as you plan.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
