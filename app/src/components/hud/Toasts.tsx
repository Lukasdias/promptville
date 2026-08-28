import { animated, useSpring } from "@react-spring/web";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp, type Toast } from "../../store";

const KIND_STYLE: Record<Toast["kind"], { border: string; icon: LucideIcon }> = {
  info: { border: "#4a4453", icon: Info },
  success: { border: "#2e8b57", icon: CircleCheck },
  error: { border: "#c0392b", icon: TriangleAlert },
};

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const spring = useSpring({
    from: { opacity: 0, transform: "translateY(20px) scale(0.9)" },
    to: { opacity: 1, transform: "translateY(0px) scale(1)" },
    config: { tension: 280, friction: 22 },
  });
  const s = KIND_STYLE[toast.kind];
  const Icon = s.icon;
  return (
    <animated.button
      type="button"
      onClick={onDismiss}
      className="paper-card pointer-events-auto flex items-center gap-2 px-4 py-2 font-body text-sm font-bold text-ink"
      style={{ opacity: spring.opacity, transform: spring.transform, border: `3px solid ${s.border}` }}
    >
      <Icon size={16} />
      <span>{toast.message}</span>
    </animated.button>
  );
}
