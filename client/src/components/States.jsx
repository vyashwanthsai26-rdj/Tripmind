import { AlertCircle, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading your travel details…" }) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin-icon" size={22} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-banner" role="alert">
      <AlertCircle size={19} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && <button className="text-button" type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
