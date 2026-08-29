// Shared mutable time/night refs driven by LightingRig each frame and read by
// Sky / lamps / windows. Kept outside the store so the render loop never
// triggers React re-renders.
export const clockRef = { current: 0.5 };
export const nightRef = { current: 0 };
