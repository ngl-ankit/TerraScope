import Link from 'next/link';

/** Not-found page, styled to match the application rather than the framework default. */
export default function NotFound() {
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-void px-6">
      <div className="glass max-w-md rounded-2xl p-6 text-center">
        <p className="mono text-2xs uppercase tracking-[0.2em] text-ink-faint">Error 404</p>
        <h1 className="mt-2 text-base font-semibold tracking-tight text-ink">That coordinate is off the map</h1>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          The page you requested does not exist. TerraScope only serves the live Earth view.
        </p>
        <Link href="/" className="btn-ghost mt-4">
          Return to the globe
        </Link>
      </div>
    </main>
  );
}
