"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="error-box" role="alert">
      <h1>This page could not be loaded</h1>
      <p>The archive hit an unexpected error. You can try the page again.</p>
      <button type="button" onClick={() => reset()}>Try again</button>
    </div>
  );
}
