import { useNeighborhood } from "../../query";

export function MissingState() {
  const { isPending, isError, error } = useNeighborhood();
  if (isPending || !isError) return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-sky p-6">
      <div className="paper-card max-w-md p-6 text-center font-body text-ink">
        <div className="text-4xl">🗺️</div>
        <h2 className="mt-2 font-display text-2xl font-semibold">Map not found</h2>
        <p className="mt-2 text-sm opacity-80">
          Promptville couldn't read the opencode database.
        </p>
        <p className="mt-1 break-all rounded-lg bg-ink/5 p-2 text-xs font-mono">{error.message}</p>
        <p className="mt-3 text-xs opacity-70">
          Ensure <code>~/.local/share/opencode/opencode.db</code> exists, or set{" "}
          <code>OPENCODE_DB_PATH</code>.
        </p>
      </div>
    </div>
  );
}