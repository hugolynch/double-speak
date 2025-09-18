<script lang="ts">
  import { onMount } from 'svelte'
  import { tick } from 'svelte'
  import type { Puzzle } from '../types/puzzle'
  import { game, loadPuzzle, isSolved, submitAnswers, isCellLocked, isCellIncorrect, clearIncorrectStatus, fetchPuzzleIndex, fetchPuzzleById } from '../lib/state.svelte'

  const today = new Date().getFullYear() + '-' + 
    String(new Date().getMonth() + 1).padStart(2, '0') + '-' + 
    String(new Date().getDate()).padStart(2, '0')

  // Timer state
  let startTime = $state<number | null>(null)
  let currentTime = $state<number>(0)
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let isCompleted = $state(false)
  let completionTime = $state<number | null>(null)
  
  // Scoring state
  let submitCount = $state<number>(0)
  let tileCompletions = $state<Record<number, { time: number, submits: number }>>({})

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
      
      // Start timer if puzzle is not already completed
      if (game.puzzle && !isSolved()) {
        startTimer()
      }
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
    
    // Convert input to lowercase for case-insensitive validation
    const lowercaseValue = value.toLowerCase()
    
    const revealed = game.state.reveals[index] ?? ''
    const revealedLength = revealed.length
    
    // Only allow user to edit the part after revealed letters
    if (lowercaseValue.length < revealedLength) {
      // User is trying to delete revealed letters - don't allow it
      return
    }
    
    // Extract only the user input part (after revealed letters)
    const userInput = lowercaseValue.slice(revealedLength)
    game.state.entries[index] = userInput
    clearIncorrectStatus(index) // Clear red border when user types
    
    // Save state to localStorage
    saveState()
  }

  function handleSubmit() {
    // Increment submit count
    submitCount++
    
    // Track which tiles were just completed
    const previouslyLocked = new Set(game.state.lockedCells)
    
    const solved = submitAnswers()
    
    // Check for newly completed tiles
    if (game.puzzle) {
      const newlyLocked = Array.from(game.state.lockedCells).filter(
        cellIndex => !previouslyLocked.has(cellIndex)
      )
      
      // Record completion data for newly solved tiles
      newlyLocked.forEach(cellIndex => {
        if (!tileCompletions[cellIndex]) {
          tileCompletions[cellIndex] = {
            time: currentTime,
            submits: submitCount
          }
        }
      })
    }
    
    // Check if puzzle is fully solved after this submit
    if (isSolved()) {
      // Puzzle is solved - stop timer and mark as completed
      console.log('Puzzle solved!')
      stopTimer()
      isCompleted = true
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
    const nextRevealed = solution.slice(0, nextLen).toLowerCase()
    
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
      incorrectCells: Array.from(game.state.incorrectCells),
      solved: isSolved(),
      completionTime: completionTime,
      submitCount: submitCount,
      tileCompletions: tileCompletions
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
          
          // Restore timer state
          if (state.solved && state.completionTime) {
            isCompleted = true
            completionTime = state.completionTime
          }
          
          // Restore submit count
          submitCount = state.submitCount || 0
          
          // Restore tile completions
          tileCompletions = state.tileCompletions || {}
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
    resetTimer()
    submitCount = 0 // Reset submit count
    tileCompletions = {} // Reset tile completions
    startTimer() // Restart the timer after reset
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
  let gridWrapEl = $state<HTMLElement | null>(null)
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

  function startTimer() {
    if (startTime === null) {
      startTime = Date.now()
      timerInterval = setInterval(() => {
        if (startTime) {
          currentTime = Math.floor((Date.now() - startTime) / 1000)
        }
      }, 1000)
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    if (startTime) {
      completionTime = Math.floor((Date.now() - startTime) / 1000)
    }
  }

  function resetTimer() {
    stopTimer()
    startTime = null
    currentTime = 0
    isCompleted = false
    completionTime = null
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate individual tile score
  function getTileScore(cellIndex: number): number {
    const completion = tileCompletions[cellIndex]
    if (!completion) return 0
    return completion.time * completion.submits
  }

  // Calculate total score
  function getTotalScore(): number {
    if (!game.puzzle) return 0
    
    let totalScore = 0
    for (let i = 0; i < game.puzzle.grid.cells.length; i++) {
      const cell = game.puzzle.grid.cells[i]
      // Only count tiles that are used in the puzzle (not fixed cells)
      if (!cell.fixed && isCellUsed(i)) {
        totalScore += getTileScore(i)
      }
    }
    return totalScore
  }

  // Generate ASCII version of puzzle layout
  function generateAsciiLayout(): string {
    if (!game.puzzle) return ''
    
    const grid = game.puzzle.grid
    const rows = grid.rows
    const cols = grid.cols
    let ascii = ''
    
    // Add header
    ascii += `Waterfalls\n`
    ascii += `${game.puzzle.title || 'Untitled'} by ${game.puzzle.author || 'Unknown'}\n\n`
    ascii += `Completed in: ${completionTime ? formatTime(completionTime) : 'Not completed'}\n`
    ascii += `Score: ${getTotalScore()}\n\n`
    
    // Create a 2D array to represent the grid with minimal spacing
    const cellWidth = 12  // Increased width to fit words better
    const cellHeight = 3
    const totalWidth = cols * cellWidth + (cols - 1) * 1  // Reduced spacing
    const totalHeight = rows * cellHeight + (rows - 1) * 1  // Reduced spacing
    
    // Initialize empty grid
    const asciiGrid: string[][] = []
    for (let y = 0; y < totalHeight; y++) {
      asciiGrid[y] = new Array(totalWidth).fill(' ')
    }
    
    // Helper function to draw a box
    function drawBox(x: number, y: number, content: string, isFixed: boolean = false) {
      const startX = x * (cellWidth + 1)
      const startY = y * (cellHeight + 1)
      
      // Draw box borders
      for (let i = 0; i < cellWidth; i++) {
        asciiGrid[startY][startX + i] = '─'
        asciiGrid[startY + cellHeight - 1][startX + i] = '─'
      }
      for (let i = 0; i < cellHeight; i++) {
        asciiGrid[startY + i][startX] = '│'
        asciiGrid[startY + i][startX + cellWidth - 1] = '│'
      }
      
      // Draw corners
      asciiGrid[startY][startX] = '┌'
      asciiGrid[startY][startX + cellWidth - 1] = '┐'
      asciiGrid[startY + cellHeight - 1][startX] = '└'
      asciiGrid[startY + cellHeight - 1][startX + cellWidth - 1] = '┘'
      
      // Add content (centered)
      const contentLines = content.split('\n')
      const centerY = startY + Math.floor(cellHeight / 2)
      const centerX = startX + Math.floor(cellWidth / 2)
      
      for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i]
        const startContentX = centerX - Math.floor(line.length / 2)
        for (let j = 0; j < line.length && startContentX + j < startX + cellWidth - 1; j++) {
          asciiGrid[centerY + i][startContentX + j] = line[j]
        }
      }
    }
    
    // Draw all cells
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellIndex = row * cols + col
        const cell = grid.cells[cellIndex]
        
        if (!cell) {
          // Empty cell - skip (don't draw)
          continue
        } else if (cell.fixed) {
          // Fixed cell - show the fixed word
          drawBox(col, row, cell.fixed.toUpperCase(), true)
        } else if (isCellUsed(cellIndex)) {
          // Used cell - show completion time
          const completion = tileCompletions[cellIndex]
          if (completion) {
            const timeStr = formatTime(completion.time)
            drawBox(col, row, timeStr)
          } else {
            drawBox(col, row, '----')
          }
        } else {
          // Unused cell - skip (don't draw)
          continue
        }
      }
    }
    
    // Draw arrows
    for (const arrow of grid.arrows) {
      const fromRow = Math.floor(arrow.from / cols)
      const fromCol = arrow.from % cols
      const toRow = Math.floor(arrow.to / cols)
      const toCol = arrow.to % cols
      
      // Draw horizontal arrow
      if (fromRow === toRow) {
        // Position arrow in the space between boxes
        const arrowY = fromRow * (cellHeight + 1) + Math.floor(cellHeight / 2)
        const arrowX = fromCol * (cellWidth + 1) + cellWidth  // Right after the box
        
        if (arrowX < totalWidth) {
          asciiGrid[arrowY][arrowX] = '→'
        }
      }
      // Draw vertical arrow
      else if (fromCol === toCol) {
        // Position arrow in the space between boxes, alternating left/right
        const centerX = fromCol * (cellWidth + 1) + Math.floor(cellWidth / 2)
        const offsetX = (fromRow % 2 === 0) ? -1 : 1  // Alternate left/right
        const arrowX = centerX + offsetX
        const arrowY = fromRow * (cellHeight + 1) + cellHeight  // Right below the box
        
        if (arrowY < totalHeight && arrowX < totalWidth && arrowX >= 0) {
          asciiGrid[arrowY][arrowX] = '↓'
        }
      }
    }
    
    // Convert grid to string
    for (let y = 0; y < totalHeight; y++) {
      ascii += asciiGrid[y].join('') + '\n'
    }
    
    return ascii
  }

  // Button state for share functionality
  let shareButtonText = $state('Share')

  // Copy ASCII layout to clipboard
  async function copyAsciiLayout() {
    try {
      const ascii = generateAsciiLayout()
      await navigator.clipboard.writeText(ascii)
      
      // Update button text temporarily
      shareButtonText = 'Copied'
      
      // Revert after 3 seconds
      setTimeout(() => {
        shareButtonText = 'Share'
      }, 3000)
      
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  // Check if a tile was completed in a single submit
  function wasTileCompletedInOneSubmit(cellIndex: number): boolean {
    const completion = tileCompletions[cellIndex]
    if (!completion) return false
    
    // Only show stars if the entire puzzle was completed in one submit
    if (!game.puzzle) return false
    
    // Check if all used tiles were completed in submit 1
    for (let i = 0; i < game.puzzle.grid.cells.length; i++) {
      const cell = game.puzzle.grid.cells[i]
      if (!cell.fixed && isCellUsed(i)) {
        const tileCompletion = tileCompletions[i]
        if (!tileCompletion || tileCompletion.submits !== 1) {
          return false
        }
      }
    }
    
    return true
  }

  // Get score breakdown for display
  function getScoreBreakdown(): Array<{time: number, words: Array<string>, totalScore: number}> {
    if (!game.puzzle) return []
    
    // Group tiles by submit number
    const submitGroups: Record<number, Array<{cellIndex: number, word: string, score: number}>> = {}
    
    for (let i = 0; i < game.puzzle.grid.cells.length; i++) {
      const cell = game.puzzle.grid.cells[i]
      // Only count tiles that are used in the puzzle (not fixed cells)
      if (!cell.fixed && isCellUsed(i)) {
        const completion = tileCompletions[i]
        if (completion) {
          // Get the word that was solved
          const solution = game.puzzle.solutions[i]
          if (solution) {
            if (!submitGroups[completion.submits]) {
              submitGroups[completion.submits] = []
            }
            submitGroups[completion.submits].push({
              cellIndex: i,
              word: solution,
              score: getTileScore(i)
            })
          }
        }
      }
    }
    
    // Convert to array and sort by submit number
    const breakdown = Object.entries(submitGroups).map(([submitStr, tiles]) => {
      const submitNumber = parseInt(submitStr)
      // Get the time from the first tile in this submit group
      const time = Object.values(tileCompletions).find(completion => 
        completion.submits === submitNumber
      )?.time || 0
      
      return {
        time: time,
        words: tiles.map(tile => tile.word).sort(), // Sort words alphabetically
        totalScore: tiles.reduce((sum, tile) => sum + tile.score, 0)
      }
    })
    
    return breakdown.sort((a, b) => a.time - b.time) // Sort by time
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
        <div class="timer">
          {#if isSolved() && completionTime !== null}
            <div class="completion-info">
              <div class="score-breakdown">
                <div class="completion-header">
                  <span class="completion-time">Completed in {formatTime(completionTime)}</span>
                  <span class="completion-score">Score: {getTotalScore()}</span>
                </div>
                {#each getScoreBreakdown() as submit}
                  <div class="submit-line">
                    <span class="submit-time">{formatTime(submit.time)}</span>
                    <span class="words-list">
                      {#each submit.words as word}
                        <span class="word-badge">{word}</span>
                      {/each}
                    </span>
                    <span class="submit-score">{submit.totalScore}</span>
                  </div>
                {/each}
                <div class="ascii-button-container">
                  <button class="ascii-button" onclick={copyAsciiLayout}>
                    {shareButtonText}
                  </button>
                </div>
              </div>
            </div>
          {:else if startTime !== null}
            <span class="current-time">Time: {formatTime(currentTime)}</span>
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
                  oninput={(e) => setEntry(i, (e.target as HTMLInputElement).value)}
                  onfocus={(e) => {
                    focusCell(i)
                    // Position cursor after revealed letters
                    const revealedLength = (game.state.reveals[i]?.length ?? 0)
                    setTimeout(() => {
                      const input = e.target as HTMLInputElement
                      input.setSelectionRange(revealedLength, revealedLength)
                    }, 0)
                  }}
                  onkeydown={(e) => {
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
                  {#if wasTileCompletedInOneSubmit(i)}
                    <div class="locked-star">★</div>
                  {:else}
                  <div class="locked-star">✓</div>
                  {/if}
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
        <button onclick={resetPuzzle} class="reset-btn">Reset puzzle</button>
        {#if !isSolved()}
          <button onclick={revealLetter}>Reveal letter</button>
        {/if}
        {#if isSolved()}
          <span class="status">Solved!</span>
        {:else}
          <button onclick={handleSubmit} class="submit-btn">Submit</button>
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
  main { border-top: 1px solid #eee; padding-top: 16px; }
  .puzzle-info {
    text-align: center;
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .puzzle-meta {
    margin-bottom: 16px;
  }

  .timer {
    font-size: 0.9rem;
  }

  .completion-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .completion-time {
    color: #00AFB6;
    font-weight: 600;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .completion-score {
    color: #00AFB6;
    font-weight: 600;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .score-breakdown {
    background: #f8fafc;
    border-radius: 6px;
    padding: 12px;
    font-size: 0.8rem;
    min-width: 300px;
    max-width: 500px;
    margin: 0 auto;
    width: fit-content;
  }

  .completion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
    font-family: monospace;
  }


  .submit-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding: 4px 0;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .submit-line:last-child {
    margin-bottom: 0;
  }

  .submit-time {
    color: #6b7280;
    font-family: monospace;
    font-weight: 600;
    min-width: 50px;
    text-align: left;
  }

  .submit-score {
    font-weight: 600;
    color: #00AFB6;
    font-family: monospace;
    min-width: 50px;
    text-align: right;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .words-list {
    display: flex;
    gap: 4px;
    flex: 1;
    justify-content: flex-start;
    font-family: monospace;
  }

  .word-badge {
    background: #e5e7eb;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 0.7rem;
    color: #374151;
    font-weight: 500;
    text-transform: uppercase;
    font-family: monospace;
  }

  .ascii-button-container {
    margin-top: 12px;
    text-align: center;
  }

  .ascii-button {
    background: #00AFB6;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    width: 100%;
  }

  .ascii-button:hover {
    background: #0099a0;
  }

  .current-time {
    color: #6b7280;
  }
  .puzzle-title {
    color: #00AFB6;
    font-size: 1.8rem;
    margin: 0;
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
    .status { color: #aaa; }
    
    .completion-time {
      color: #10b981;
    }
    
    .completion-score {
      color: #10b981;
    }
    
    .score-breakdown {
      background: #1f2937;
    }
    
    .completion-header {
      border-bottom-color: #4b5563;
    }


    .ascii-button {
      background: #00AFB6;
    }

    .ascii-button:hover {
      background: #0099a0;
    }
    
    
    .submit-time {
      color: #9ca3af;
    }
    
    .submit-score {
      color: #10b981;
    }
    
    .word-badge {
      background: #374151;
      color: #f9fafb;
    }
    
    .current-time {
      color: #9ca3af;
    }
    
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