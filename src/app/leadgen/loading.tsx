export default function LoadingLeadgenPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] px-6 py-10">
      <div className="mx-auto max-w-7xl animate-pulse space-y-4">
        <div className="h-8 w-80 rounded bg-slate-200" />
        <div className="h-4 w-full max-w-2xl rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="h-96 rounded-2xl bg-slate-200" />
      </div>
    </main>
  );
}
