import { ExternalLink } from "lucide-react";
import { useSession } from "../../query";
import { openCommand } from "../../navigator";
import { useApp } from "../../store";
import type { NavItem } from "../../navigator";

export function SessionRow({ item, active }: { item: NavItem; active: boolean }) {
  const select = useApp((s) => s.select);
  const pushToast = useApp((s) => s.pushToast);
  const { session, project } = item;
  const { data } = useSession(active ? session.id : null);
  const date = new Date(session.timeUpdated).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const tokens = session.tokensIn + session.tokensOut;

  const copy = () => {
    const cmd = openCommand(session);
    navigator.clipboard.writeText(cmd).then(
      () => pushToast("success", `Copied: ${cmd}`),
      () => pushToast("error", "Could not copy command"),
    );
  };

  return (
    <div
      onClick={() => {
        select(session);
        pushToast("info", `Flying to "${session.title}"`);
      }}
      className="cursor-pointer rounded-xl border-2 border-ink/15 bg-cream p-2 transition-colors hover:border-ink/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold leading-tight">
            {session.title}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs opacity-70">
            <span className="font-bold">{project.name}</span>
            <span>{date}</span>
            {session.model && <span>· {session.model}</span>}
            {session.agent && <span>· {session.agent}</span>}
            <span>· ${session.cost.toFixed(4)}</span>
            <span>· {tokens.toLocaleString()} tok</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copy();
          }}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-ink/40 text-ink hover:bg-ink/10"
          aria-label="Open in opencode"
        >
          <ExternalLink size={13} />
        </button>
      </div>
      {active && data?.snippet && (
        <p className="mt-1 line-clamp-2 text-xs opacity-70">{data.snippet}</p>
      )}
    </div>
  );
}
