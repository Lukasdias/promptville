import { useEffect, useRef } from "react";
import { animated, useSpring } from "@react-spring/web";
import { X } from "lucide-react";
import { useApp } from "../../store";
import { useMessages } from "../../query";
import { Tooltip } from "../ui/Tooltip";

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ChatSidebar() {
  const selected = useApp((s) => s.selected);
  const chatOpen = useApp((s) => s.chatOpen);
  const closeChat = useApp((s) => s.closeChat);
  const sessionId = selected?.id ?? null;
  const { data, isPending, isError } = useMessages(sessionId);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data]);

  const { opacity, x } = useSpring({
    from: { opacity: 0, x: 40 },
    to: { opacity: chatOpen ? 1 : 0, x: chatOpen ? 0 : 60 },
    config: { tension: 240, friction: 24 },
  });

  if (!chatOpen || !selected) return null;

  return (
    <animated.aside
      className="absolute left-4 top-20 bottom-16 z-30 flex w-96 max-w-[26rem] flex-col"
      style={{ opacity, transform: x.to((v) => `translateX(${v}px)`) }}
    >
      <div className="paper-card flex min-h-0 flex-1 flex-col overflow-hidden p-3 font-body text-ink">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-lg font-semibold">{selected.title}</h2>
          <Tooltip label="Close chat">
            <button
              type="button"
              onClick={closeChat}
              aria-label="Close chat"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink/50 hover:bg-ink/10"
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        <div ref={scrollRef} className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1">
          {isPending && <p className="py-8 text-center text-sm opacity-60">Loading…</p>}
          {isError && <p className="py-8 text-center text-sm opacity-60">Couldn’t load the chat.</p>}
          {data && data.messages.length === 0 && (
            <p className="py-8 text-center text-sm opacity-60">No messages.</p>
          )}
          {data?.messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl border-2 border-ink/40 px-3 py-2 text-sm ${
                    isUser ? "bg-amber-200" : "bg-cream"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className="mt-1 text-right text-[10px] opacity-50">{clockTime(m.time)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </animated.aside>
  );
}
