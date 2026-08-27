let panActive = false;

export function isPanActive(): boolean {
  return panActive;
}

export function setPanActive(v: boolean): void {
  panActive = v;
}