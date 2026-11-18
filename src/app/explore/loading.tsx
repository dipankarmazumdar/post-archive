export default function ExploreLoading() {
  return (
    <div className="empty" aria-busy="true" aria-live="polite">
      <p className="kicker">Loading</p>
      <h1>Searching the archive…</h1>
    </div>
  );
}
