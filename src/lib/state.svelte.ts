import type { Puzzle, GameState, Grid } from '../types/puzzle'

export const game = $state({
  puzzle: null as Puzzle | null,
  state: {
    entries: {},
    reveals: {},
    focusedCell: null,
    lockedCells: new Set<number>(),
    incorrectCells: new Set<number>(),
    attempts: 0,
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
    lockedCells: new Set<number>(),
    incorrectCells: new Set<number>(),
    attempts: 0,
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
  // Only consider it solved if all solution cells are locked (submitted and correct)
  for (const [idxStr, word] of Object.entries(solutions)) {
    const idx = Number(idxStr)
    if (!game.state.lockedCells.has(idx)) return false
  }
  return true
}

export function submitAnswers(): boolean {
  if (!game.puzzle) return false
  
  game.state.attempts++
  const { solutions } = game.puzzle
  let allCorrect = true
  
  // Check each solution cell
  for (const [idxStr, correctWord] of Object.entries(solutions)) {
    const idx = Number(idxStr)
    const revealed = game.state.reveals[idx] ?? ''
    const userInput = game.state.entries[idx] ?? ''
    const fullEntry = revealed + userInput
    
    if (fullEntry === correctWord) {
      // Correct answer - lock the cell
      game.state.lockedCells.add(idx)
      game.state.incorrectCells.delete(idx)
    } else {
      // Incorrect answer - clear user input but keep revealed letters
      if (userInput !== '') {
        game.state.entries[idx] = undefined
        game.state.incorrectCells.add(idx)
        allCorrect = false
      }
    }
  }
  
  // Force reactivity by creating new Set objects
  game.state.lockedCells = new Set(game.state.lockedCells)
  game.state.incorrectCells = new Set(game.state.incorrectCells)
  
  return allCorrect
}

export function isCellLocked(index: number): boolean {
  return game.state.lockedCells.has(index)
}

export function isCellIncorrect(index: number): boolean {
  return game.state.incorrectCells.has(index)
}

export function clearIncorrectStatus(index: number): void {
  game.state.incorrectCells.delete(index)
}


