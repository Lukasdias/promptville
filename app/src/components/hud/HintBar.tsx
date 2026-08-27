export function HintBar() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border-[3px] border-ink/70 bg-cream px-4 py-1.5 font-body text-sm font-bold text-ink/80 shadow-[3px_3px_0_rgba(74,68,83,0.2)]">
      Drag to orbit · Scroll to zoom · Click a house
    </div>
  );
}