import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center bg-kerb">
      <div className="max-w-md w-full bg-white p-8 rounded-control border border-border shadow-sheet space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-control bg-marking-yellow border border-asphalt text-asphalt font-heading font-black text-lg">
          404
        </div>
        <h1 className="text-xl font-heading font-bold text-asphalt">
          Page Not Found
        </h1>
        <p className="text-xs font-sans text-asphalt-muted leading-relaxed">
          The requested page or municipal resource could not be found. Please check the URL or return to the live map.
        </p>
        <div className="pt-2">
          <Link
            href="/explore"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-control bg-marking-yellow hover:bg-marking-hover text-asphalt font-heading font-bold text-xs border border-[#D9A304] transition"
          >
            Return to Explore Map
          </Link>
        </div>
      </div>
    </div>
  );
}
