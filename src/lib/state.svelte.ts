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
  // Fetch list of puzzle files from a simple list.json file
  const base = import.meta.env.BASE_URL ?? '/'
  const discoveredPuzzles: { id: string; date: string; title?: string; author?: string }[] = []
  
  try {
    // First, get the list of puzzle files
    const listRes = await fetch(`${base}puzzles/list.json`)
    if (!listRes.ok) {
      console.warn('No puzzle list found, using empty list')
      game.index = []
      return
    }
    
    const puzzleFiles = await listRes.json() as string[]
    
    // Then load each puzzle file to get metadata
    for (const filename of puzzleFiles) {
      try {
        const res = await fetch(`${base}puzzles/${filename}`)
        if (res.ok) {
          const puzzle = await res.json()
          discoveredPuzzles.push({
            id: puzzle.id || filename.replace('.json', ''),
            date: puzzle.date || filename.replace('.json', ''),
            title: puzzle.title,
            author: puzzle.author
          })
        }
      } catch (err) {
        console.warn(`Failed to load puzzle ${filename}:`, err)
      }
    }
  } catch (err) {
    console.error('Failed to fetch puzzle list:', err)
  }
  
  // Sort by date (newest first)
  discoveredPuzzles.sort((a, b) => b.date.localeCompare(a.date))
  game.index = discoveredPuzzles
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


