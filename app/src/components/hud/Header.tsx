export function Header() {
  return (
    <header className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
      <span className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-amber-300 text-xl">
        ☀️
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink drop-shadow-[2px_2px_0_rgba(255,255,255,0.8)]">
        Promptville
      </h1>
    </header>
  );
}