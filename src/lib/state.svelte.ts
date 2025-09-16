import type { Puzzle, GameState, Grid } from '../types/puzzle'

export const game = $state({
  puzzle: null as Puzzle | null,
  state: {
    entries: {},
    reveals: {},
    focusedCell: null,
  } as GameState,
  index: [] as { id: string; date: string; title?: string; author?: string }[],
  selectedId: '' as string,
})

export function loadPuzzle(puzzle: Puzzle) {
  game.puzzle = puzzle
  game.state = {
    entries: {},
    reveals: {},
    focusedCell: firstEmptyCell(puzzle.grid) ?? 0,
  }
}

export async function fetchPuzzleIndex(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL ?? '/'}puzzles/index.json`)
  if (!res.ok) throw new Error(`Failed to load puzzle index: ${res.status}`)
  const data = await res.json()
  game.index = Array.isArray(data) ? data : []
}

export async function fetchPuzzleById(id: string): Promise<void> {
  const base = import.meta.env.BASE_URL ?? '/'
  const res = await fetch(`${base}puzzles/${id}.json`)
  if (!res.ok) throw new Error(`Failed to load puzzle ${id}: ${res.status}`)
  const puzzle = (await res.json()) as Puzzle
  loadPuzzle(puzzle)
  game.selectedId = id
}

export function firstEmptyCell(grid: Grid): number | null {
  for (let i = 0; i < grid.cells.length; i++) {
    if (!grid.cells[i].fixed) return i
  }
  return null
}

export function isSolved(): boolean {
  if (!game.puzzle) return false
  const { solutions } = game.puzzle
  for (const [idxStr, word] of Object.entries(solutions)) {
    const idx = Number(idxStr)
    const entry = game.state.entries[idx]
    if (entry !== word) return false
  }
  return true
}


