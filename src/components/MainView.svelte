<script lang="ts">
  import { onMount } from 'svelte'
  import { tick } from 'svelte'
  import type { Puzzle } from '../types/puzzle'
  import { game, loadPuzzle, isSolved, submitAnswers, isCellLocked, isCellIncorrect, clearIncorrectStatus, fetchPuzzleIndex, fetchPuzzleById } from '../lib/state.svelte'

  const today = new Date().getFullYear() + '-' + 
    String(new Date().getMonth() + 1).padStart(2, '0') + '-' + 
    String(new Date().getDate()).padStart(2, '0')

  function makeDemoPuzzle(): Puzzle {
    return {
      id: 'demo',
      date: today,
      title: 'Getting started',
      author: 'demo',
      grid: {
        rows: 2,
        cols: 2,
        // Two fixed clue words and two empty cells
        cells: [
          { fixed: 'rain' },    // 0
          {},                   // 1 (solution: bow)
          {},                   // 2 (solution: storm)
          { fixed: 'brain' },   // 3
        ],
        arrows: [
          { from: 0, to: 1, dir: 'right' },
          { from: 0, to: 2, dir: 'down' },
          { from: 2, to: 3, dir: 'right' },
        ],
      },
      // Unique solutions for the empty indices
      solutions: {
        1: 'bow',
        2: 'storm',
      },
    }
  }

  onMount(async () => {
    try {
      await fetchPuzzleIndex()
      // Only load initial puzzle if no puzzle is currently loaded
        if (!game.puzzle) {
          if (game.index.length > 0) {
            // Try to find today's puzzle first
            const todayPuzzle = game.index.find(p => p.date === today)
            if (todayPuzzle) {
              await fetchPuzzleById(todayPuzzle.id)
            } else {
              // Fall back to the most recent puzzle before today's date
              const pastPuzzles = game.index.filter(p => p.date < today)
              if (pastPuzzles.length > 0) {
                const mostRecentPast = pastPuzzles[0] // Already sorted by date (newest first)
                await fetchPuzzleById(mostRecentPast.id)
              } else {
                // If no past puzzles exist, fall back to the newest available
                const initial = game.index[0]
                await fetchPuzzleById(initial.id)
              }
            }
          } else {
            loadPuzzle(makeDemoPuzzle())
        }
      }
      
      // Load saved state from localStorage
      loadSavedState()
    } finally {
      measureArrows()
    }
  })

  // React to puzzle changes (when switching from archive)
  $effect(() => {
    if (game.puzzle) {
      // Load saved state for the current puzzle
      loadSavedState()
      // Re-measure arrows when puzzle changes
      measureArrows()
    }
  })

  function setEntry(index: number, value: string) {
    if (isCellLocked(index)) return // Don't allow editing locked cells
    
    const revealed = game.state.reveals[index] ?? ''
    const revealedLength = revealed.length
    
    // Only allow user to edit the part after revealed letters
    if (value.length < revealedLength) {
      // User is trying to delete revealed letters - don't allow it
      return
    }
    
    // Extract only the user input part (after revealed letters)
    const userInput = value.slice(revealedLength)
    game.state.entries[index] = userInput
    clearIncorrectStatus(index) // Clear red border when user types
    
    // Save state to localStorage
    saveState()
  }

  function handleSubmit() {
    const solved = submitAnswers()
    if (solved) {
      // Puzzle is solved - could show celebration or navigate to next puzzle
      console.log('Puzzle solved!')
    }
    
    // Always focus on the first unsolved cell from the top (left to right)
    focusFirstUnsolvedCell()
    
    // Force a re-render to ensure visual changes appear immediately
    game.state = { ...game.state }
    
    // Save state to localStorage (including locked cells)
    saveState()
  }

  function focusFirstUnsolvedCell() {
    if (!game.puzzle) return
    
    const { solutions } = game.puzzle
    
    // Find the first unsolved cell from the top
    for (let cellIndex = 0; cellIndex < game.puzzle.grid.cells.length; cellIndex++) {
      const cell = game.puzzle.grid.cells[cellIndex]
      
      // Skip if it's a fixed cell (these are not input cells)
      if (cell.fixed) continue
      
      // Skip if it's not used in the puzzle (no solution and no arrows)
      if (!isCellUsed(cellIndex)) continue
      
      // Skip if it's already locked (solved)
      if (isCellLocked(cellIndex)) continue
      
      // Skip if it doesn't have a solution (shouldn't happen, but safety check)
      if (!solutions[cellIndex]) continue
      
      // Found the first unsolved cell - focus it
      focusCell(cellIndex)
      setTimeout(() => {
        const input = document.querySelector(`input[data-cell-index="${cellIndex}"]`) as HTMLInputElement
        input?.focus()
      }, 0)
      return
    }
    
    // If no unsolved cells found, clear focus
    game.state.focusedCell = null
    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && activeElement.blur) {
        activeElement.blur()
      }
    }, 0)
  }

  function focusCell(index: number) {
    game.state.focusedCell = index
  }

  function goPrev() {
    if (!game.puzzle) return
    const cells = game.puzzle.grid.cells
    let i = game.state.focusedCell ?? 0
    for (let step = 0; step < cells.length; step++) {
      i = (i - 1 + cells.length) % cells.length
      if (isCellUsed(i) && !cells[i].fixed) { 
        game.state.focusedCell = i
        // Focus the actual input element
        setTimeout(() => {
          const input = document.querySelector(`input[data-cell-index="${i}"]`) as HTMLInputElement
          input?.focus()
        }, 0)
        return 
      }
    }
  }

  function goNext() {
    if (!game.puzzle) return
    const cells = game.puzzle.grid.cells
    let i = game.state.focusedCell ?? 0
    for (let step = 0; step < cells.length; step++) {
      i = (i + 1) % cells.length
      if (isCellUsed(i) && !cells[i].fixed) { 
        game.state.focusedCell = i
        // Focus the actual input element
        setTimeout(() => {
          const input = document.querySelector(`input[data-cell-index="${i}"]`) as HTMLInputElement
          input?.focus()
        }, 0)
        return 
      }
    }
  }

  function revealLetter() {
    if (!game.puzzle) return
    const i = game.state.focusedCell
    if (i == null) return
    const cell = game.puzzle.grid.cells[i]
    if (cell.fixed) return
    const solution = game.puzzle.solutions[i]
    if (!solution) return
    
    const currentRevealed = game.state.reveals[i] ?? ''
    const nextLen = Math.min(currentRevealed.length + 1, solution.length)
    const nextRevealed = solution.slice(0, nextLen)
    
    // Clear any existing user input when revealing letters
    game.state.entries[i] = undefined
    game.state.reveals[i] = nextRevealed
    clearIncorrectStatus(i) // Clear any red border
    
    // Save state to localStorage
    saveState()
  }

  function saveState() {
    if (!game.puzzle) return
    const state = {
      puzzleId: game.puzzle.id,
      entries: game.state.entries,
      reveals: game.state.reveals,
      focusedCell: game.state.focusedCell,
      lockedCells: Array.from(game.state.lockedCells),
      incorrectCells: Array.from(game.state.incorrectCells)
    }
    localStorage.setItem(`waterfalls-${game.puzzle.id}`, JSON.stringify(state))
  }

  function loadSavedState() {
    if (!game.puzzle) return
    const saved = localStorage.getItem(`waterfalls-${game.puzzle.id}`)
    if (saved) {
      try {
        const state = JSON.parse(saved)
        if (state.puzzleId === game.puzzle.id) {
          game.state.entries = state.entries || {}
          game.state.reveals = state.reveals || {}
          game.state.focusedCell = state.focusedCell || null
          game.state.lockedCells = new Set(state.lockedCells || [])
          game.state.incorrectCells = new Set(state.incorrectCells || [])
        }
      } catch (e) {
        console.warn('Failed to load saved state:', e)
      }
    }
  }

  function resetPuzzle() {
    if (!game.puzzle) return
    game.state.entries = {}
    game.state.reveals = {}
    game.state.focusedCell = null
    game.state.lockedCells = new Set()
    game.state.incorrectCells = new Set()
    localStorage.removeItem(`waterfalls-${game.puzzle.id}`)
  }

  // Get the display value for a cell (revealed letters + user input)
  function getDisplayValue(index: number): string {
    const revealed = game.state.reveals[index] ?? ''
    const userInput = game.state.entries[index] ?? ''
    return revealed + userInput
  }

  // Check if a cell has revealed letters
  function hasRevealedLetters(index: number): boolean {
    return (game.state.reveals[index]?.length ?? 0) > 0
  }

  // Arrow overlay measurements
  let gridWrapEl: HTMLElement | null = null
  let cellEls: (HTMLElement | null)[] = []
  let svgSize = $state({ width: 0, height: 0 })
  type ArrowLine = { x1: number; y1: number; x2: number; y2: number; key: string }
  let arrowLines = $state<ArrowLine[]>([])

  // Action to collect cell elements by index
  function collectEl(node: HTMLElement, index: number) {
    cellEls[index] = node
    // measure in case this was the last one mounting
    measureArrows()
    return {
      destroy() {
        cellEls[index] = null
        measureArrows()
      }
    }
  }

  async function measureArrows() {
    if (!game.puzzle || !gridWrapEl) { 
      arrowLines = []; 
      return 
    }
    await tick()
    const rect = gridWrapEl.getBoundingClientRect()
    svgSize.width = rect.width
    svgSize.height = rect.height
    const lines: ArrowLine[] = []
    for (const a of game.puzzle.grid.arrows) {
      const fromEl = cellEls[a.from]
      const toEl = cellEls[a.to]
      if (!fromEl || !toEl) continue
      const fr = fromEl.getBoundingClientRect()
      const tr = toEl.getBoundingClientRect()
      let x1 = fr.left + fr.width / 2
      let y1 = fr.top + fr.height / 2
      let x2 = tr.left + tr.width / 2
      let y2 = tr.top + tr.height / 2
      if (a.dir === 'right') {
        x1 = fr.right; y1 = fr.top + fr.height / 2
        x2 = tr.left;  y2 = tr.top + tr.height / 2
      } else if (a.dir === 'down') {
        x1 = fr.left + fr.width / 2; y1 = fr.bottom
        x2 = tr.left + tr.width / 2; y2 = tr.top
      }
      x1 -= rect.left; y1 -= rect.top
      x2 -= rect.left; y2 -= rect.top
      lines.push({ x1, y1, x2, y2, key: `${a.from}-${a.to}-${a.dir}` })
    }
    arrowLines = lines
  }

  function onResize() { measureArrows() }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize)
  }

  // Determine if a cell is used in the puzzle
  function isCellUsed(index: number): boolean {
    if (!game.puzzle) return false
    const cell = game.puzzle.grid.cells[index]
    if (!cell) return false
    
    // Cell is used if it has fixed content, solution, or is connected via arrows
    if (cell.fixed) return true
    if (game.puzzle.solutions[index]) return true
    
    // Check if this cell is connected to any arrows
    const hasArrowFrom = game.puzzle.grid.arrows.some(a => a.from === index)
    const hasArrowTo = game.puzzle.grid.arrows.some(a => a.to === index)
    return hasArrowFrom || hasArrowTo
  }

  // Get the input cell number (1-based) for non-fixed cells
  function getInputCellNumber(index: number): number | null {
    if (!game.puzzle) return null
    const cell = game.puzzle.grid.cells[index]
    if (!cell || cell.fixed) return null
    
    // Count how many input cells come before this one
    let inputCount = 0
    for (let i = 0; i < index; i++) {
      const prevCell = game.puzzle.grid.cells[i]
      if (prevCell && !prevCell.fixed && isCellUsed(i)) {
        inputCount++
      }
    }
    return inputCount + 1
  }

  function formatDate(dateStr: string): string {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  function navigateToArchive() {
    // This will be handled by the parent App component
    // For now, we'll dispatch an event
    const event = new CustomEvent('navigate', { detail: 'archive' })
    window.dispatchEvent(event)
  }
</script>

<div class="app">
  <header>
    <div class="header-content">
      <img src="/waterfalls/logo.svg" alt="Waterfalls" class="logo" />
    </div>
  </header>
  <main>
    {#if game.puzzle}
      <div class="puzzle-info">
        <h1 class="puzzle-title">{game.puzzle.title || 'Daily Puzzle'}</h1>
        <div class="puzzle-meta">
          <span class="puzzle-date">{formatDate(game.puzzle.date)}</span>
          {#if game.puzzle.author}
            <span class="puzzle-author">by {game.puzzle.author}</span>
          {/if}
        </div>
      </div>
    {/if}
    {#if game.puzzle}



      <div class="grid-wrap" bind:this={gridWrapEl}>
        <svg class="arrows" width={svgSize.width || 400} height={svgSize.height || 300} viewBox={`0 0 ${svgSize.width || 400} ${svgSize.height || 300}`} aria-hidden="true">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
            </marker>
          </defs>
          {#each arrowLines as l (l.key)}
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} marker-end="url(#arrowhead)" />
          {/each}
        </svg>
        <div
          class="grid"
          style={`grid-template-columns: repeat(${game.puzzle.grid.cols}, 1fr);`}
        >
        {#each game.puzzle.grid.cells as cell, i}
          {#if isCellUsed(i)}
            {#if cell.fixed}
              <div class={`cell fixed ${game.state.focusedCell === i ? 'focused' : ''}`} use:collectEl={i}>
                <span class="fixed-text">{cell.fixed}</span>
              </div>
            {:else}
              <div class="cell-container" use:collectEl={i}>
                <input
                  class={`cell empty entry ${game.state.focusedCell === i ? 'focused' : ''} ${isCellLocked(i) ? 'locked' : ''} ${isCellIncorrect(i) ? 'incorrect' : ''}`}
                  type="text"
                  placeholder={cell.hint ?? ''}
                  value={getDisplayValue(i)}
                  data-cell-index={i}
                  disabled={isCellLocked(i)}
                  on:input={(e) => setEntry(i, (e.target as HTMLInputElement).value)}
                  on:focus={(e) => {
                    focusCell(i)
                    // Position cursor after revealed letters
                    const revealedLength = (game.state.reveals[i]?.length ?? 0)
                    setTimeout(() => {
                      const input = e.target as HTMLInputElement
                      input.setSelectionRange(revealedLength, revealedLength)
                    }, 0)
                  }}
                  on:keydown={(e) => {
                    if (isCellLocked(i)) return // Don't allow navigation for locked cells
                    
                    const revealedLength = (game.state.reveals[i]?.length ?? 0)
                    const cursorPos = (e.target as HTMLInputElement).selectionStart ?? 0
                    
                    // Prevent cursor from going before revealed letters
                    if (e.key === 'ArrowLeft' && cursorPos <= revealedLength) {
                      e.preventDefault()
                      return
                    }
                    
                    // Prevent backspace from deleting revealed letters
                    if (e.key === 'Backspace' && cursorPos <= revealedLength) {
                      e.preventDefault()
                      return
                    }
                    
                    if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); goNext() }
                    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      if (e.shiftKey) {
                        goPrev()
                      } else {
                        goNext()
                      }
                    }
                  }}
                />
                {#if getInputCellNumber(i)}
                  <div class="cell-number">{getInputCellNumber(i)}</div>
                {/if}
                {#if hasRevealedLetters(i)}
                  <div class="reveal-indicators">
                    {#each Array.from({ length: (game.state.reveals[i]?.length ?? 0) }) as _}
                      <div class="reveal-pip"></div>
                    {/each}
                  </div>
                {/if}
                {#if isCellLocked(i)}
                  <div class="locked-star">✓</div>
                {/if}
              </div>
            {/if}
          {:else}
            <!-- Unused cell - invisible but still takes up grid space for arrow positioning -->
            <div class="cell unused" use:collectEl={i}></div>
          {/if}
        {/each}
        </div>
      </div>

      <div class="toolbar">
        <button on:click={resetPuzzle} class="reset-btn">Reset puzzle</button>
        {#if !isSolved()}
          <button on:click={revealLetter}>Reveal letter</button>
        {/if}
        {#if isSolved()}
          <span class="status">Solved!</span>
        {:else}
          <button on:click={handleSubmit} class="submit-btn">Submit</button>
        {/if}
      </div>
    {:else}
      <p>Loading…</p>
    {/if}
  </main>
</div>

<style>
  .app { max-width: 880px; margin: 0 auto; padding: 24px; }
  header { margin-bottom: 16px; }
  .header-content { 
    display: flex; 
    align-items: center; 
    justify-content: space-between;
    gap: 12px; 
  }
  .logo { height: 40px; width: auto; }
  .header-actions {
    display: flex;
    gap: 8px;
  }
  .nav-btn {
    padding: 8px 16px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #ffffff;
    color: #6b7280;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .nav-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #374151;
  }
  main { border-top: 1px solid #eee; padding-top: 16px; }
  .puzzle-info {
    text-align: center;
    margin-bottom: 24px;
  }
  .puzzle-title {
    color: #00AFB6;
    font-size: 1.8rem;
    margin: 0 0 8px 0;
    font-weight: 600;
  }
  .puzzle-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #6b7280;
    font-size: 0.9rem;
  }
  .puzzle-date {
    font-weight: 600;
  }

  .meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; }
  .title { font-weight: 600; }
  

  .grid {
    display: grid;
    gap: 10px;
  }
  .grid-wrap { position: relative; }
  .arrows {
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: #84D9DD;
    z-index: 1;
  }

  .cell {
    height: 72px;
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cell-bg, transparent);
    box-sizing: border-box;
  }
  .cell.unused {
    border: none;
    background: transparent;
    visibility: hidden;
  }
  .cell.fixed {
    --cell-bg: #C3EBED;
    border-color: #84D9DD;
    position: relative;
    z-index: 10;
  }
  .cell.focused {
    outline: 3px solid #84D9DD;
    outline-offset: -2px;
  }
  .fixed-text { 
    font-weight: 600; 
    text-align: center;
    word-wrap: break-word;
    overflow-wrap: break-word;
    text-transform: uppercase;
    color: #003235;
  }
  .entry {
    text-align: center;
    font: inherit;
    width: 100%;
    height: 100%;
    border: 1px solid #84D9DD;
    outline: none;
    background: white;
    text-transform: uppercase;
    position: relative;
    z-index: 10;
  }
  .entry.locked {
    border-color: #84D9DD;
    background-color: #E6F6F7;
    font-weight: bold;
    color: black;
  }
  .entry.incorrect {
    border-color: #FFDBDA;
    background-color: #FFF0EF;
  }
  .entry:disabled {
    cursor: not-allowed;
  }
  
  .cell-container {
    position: relative;
    height: 72px;
    width: 100%;
  }
  
  .cell-number {
    position: absolute;
    top: 8px;
    left: 8px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10;
    line-height: 1;
  }
  
  .reveal-indicators {
    position: absolute;
    top: 11px;
    left: 20px;
    display: flex;
    gap: 2px;
    z-index: 10;
  }
  
  .reveal-pip {
    width: 6px;
    height: 6px;
    background: #000000;
    border-radius: 50%;
  }
  
  .locked-star {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 16px;
    color: #00787D;
    z-index: 10;
    line-height: 1;
  }
  .toolbar { display: flex; gap: 10px; align-items: center; margin-top: 12px; }
  .toolbar button {
    padding: 8px 16px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #ffffff;
    color: #374151;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .toolbar button:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }
  .toolbar button:active {
    background: #f3f4f6;
    transform: translateY(1px);
  }
  .submit-btn {
    background: #009BA1 !important;
    border-color: #009BA1 !important;
    color: #ffffff !important;
  }
  .submit-btn:hover {
    background: #00787D !important;
    border-color: #00787D !important;
  }

  .status { color: #00787D; }
  @media (prefers-color-scheme: dark) {
    .subtitle { color: #aaa; }
    main { border-top-color: #333; }
    .cell { border-color: #333; }
    .cell.fixed { 
      --cell-bg: #C3EBED; 
      border-color: #84D9DD; 
    }
    .entry { 
      background: transparent; 
      color: inherit; 
      border-color: #555;
    }
    .entry.locked {
      border-color: #10b981;
      background-color: #064e3b;
      color: black;
    }
    .entry.incorrect {
      border-color: #ef4444;
      background-color: #7f1d1d;
    }
    .byline { color: #aaa; }
    .status { color: #aaa; }
    
    .toolbar button {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }
    .toolbar button:hover {
      background: #374151;
      border-color: #4b5563;
    }
    .toolbar button:active {
      background: #111827;
    }
    .reset-btn {
      background: #374151 !important;
      border-color: #4b5563 !important;
      color: #f9fafb !important;
    }
    .reset-btn:hover {
      background: #4b5563 !important;
      border-color: #6b7280 !important;
    }
  }
  :global(button){ cursor: pointer; }
  :global(input){ font: inherit; }
  :global(*) { box-sizing: border-box; }
  :global(body) { 
    font-family: Inter, sans-serif;
    font-feature-settings: 'liga' 1, 'calt' 1;
  }
  @supports (font-variation-settings: normal) {
    :global(body) { font-family: InterVariable, sans-serif; }
  }
</style>


