export const actions = {
  NOOP: -1,
  CHAR: 0,
  BACK: 1,
  PREV: 2,
  NEXT: 3,
  LEFT: 4,
  RIGHT: 5,
  UP: 6,
  DOWN: 7,
  REVEAL: 8,
} as const

export type ActionCode = (typeof actions)[keyof typeof actions]


