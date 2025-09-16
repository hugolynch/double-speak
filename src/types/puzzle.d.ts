export type Direction = 'right' | 'down'

export type Arrow = {
  from: number // index of source cell in row-major order
  to: number   // index of target cell in row-major order
  dir: Direction
}

export type Cell = {
  /** prefilled word if any; undefined means player must solve */
  fixed?: string
  /** display hint, e.g., length or pattern; optional */
  hint?: string
}

export type Grid = {
  rows: number
  cols: number
  cells: Cell[]
  arrows: Arrow[]
}

export type Puzzle = {
  id: string
  date: string // YYYY-MM-DD
  title?: string
  author?: string
  grid: Grid
  /** unique solution words for each empty cell, by index */
  solutions: Record<number, string>
}

export type GameState = {
  /** player entries per cell; undefined means empty/unanswered */
  entries: Record<number, string | undefined>
  /** revealed letters by cell; simple string mask for now */
  reveals: Record<number, string | undefined>
  focusedCell: number | null
}


