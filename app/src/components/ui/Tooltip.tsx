import { cloneElement, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

type TooltipChildProps = Partial<{
  ref: (node: HTMLElement | null) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}>;

export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  const elRef = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const el = elRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top + r.height + 8, left: r.left + r.width / 2 });
  };
  const hide = () => setPos(null);

  const child = cloneElement(children as ReactElement<TooltipChildProps>, {
    ref: (node: HTMLElement | null) => {
      elRef.current = node;
    },
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  return (
    <>
      {child}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-50 -translate-x-1/2 rounded-lg border-2 border-ink bg-cream px-2 py-1 font-body text-xs font-bold text-ink shadow-[3px_3px_0_rgba(74,68,83,0.35)]"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
