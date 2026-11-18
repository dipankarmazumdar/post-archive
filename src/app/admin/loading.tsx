export default function AdminLoading() {
  return (
    <div className="empty" aria-busy="true" aria-live="polite">
      <p className="kicker">Editor</p>
      <h1>Opening drafts…</h1>
    </div>
  );
}
