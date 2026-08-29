// Tuning knobs for the town. Bump counts for denser environmental dressing.
export const environment = {
  trees: 55,
  lamps: 9,
  bushes: 26,
  flowers: 10,
  mailboxes: 30,
  hydrants: 8,
  cones: 6,
};

export const traffic = {
  cars: 16,
  runners: 6,
  walkers: 3,
  visitors: 4,
  // Base green-light cycle in seconds; each phase gets a random ±30% offset.
  cycle: 8,
};