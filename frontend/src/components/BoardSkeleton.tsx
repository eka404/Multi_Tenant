export default function BoardSkeleton() {
  return (
    <div className="flex animate-pulse gap-4 overflow-x-auto pb-4" aria-label="Loading board">
      {[0, 1, 2, 3].map((col) => (
        <div
          key={col}
          className="flex min-h-[320px] w-72 shrink-0 flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3 md:w-auto md:flex-1"
        >
          <div className="mb-2 h-4 w-24 rounded bg-slate-800" />
          {Array.from({ length: 3 - (col % 2) }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-800/70" />
          ))}
        </div>
      ))}
    </div>
  );
}