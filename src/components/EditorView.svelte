<script lang="ts">
  import type { Puzzle, Grid, Arrow } from '../types/puzzle'
  import { tick } from 'svelte'

  // Local editor state
  let rows = 3
  let cols = 3
  const today = new Date().toISOString().slice(0,10)
  let meta = { id: today, date: today, title: 'New Puzzle', author: '' }

  type EditCell = { fixed?: string, isFixed: boolean, right: boolean, down: boolean }
  let cells: EditCell[] = Array.from({ length: rows * cols }, () => ({ isFixed: false, right: false, down: false }))
  

  function applySize(newRows: number, newCols: number) {
    const oldRows = rows
    const oldCols = cols
    rows = Math.max(1, Math.min(12, Math.floor(newRows)))
    cols = Math.max(1, Math.min(12, Math.floor(newCols)))
    
    const nextTotal = rows * cols
    const next: EditCell[] = new Array(nextTotal)
    
    // Preserve existing cells in their relative positions
    for (let i = 0; i < nextTotal; i++) {
      const newRow = Math.floor(i / cols)
      const newCol = i % cols
      const oldIndex = newRow * oldCols + newCol
      
      if (oldIndex < cells.length && newRow < oldRows && newCol < oldCols) {
        // Cell exists in both old and new grids, preserve it
        next[i] = cells[oldIndex] ?? { isFixed: false, right: false, down: false }
      } else {
        // New cell, initialize as empty
        next[i] = { isFixed: false, right: false, down: false }
      }
    }
    
    cells = next
    
    // Clear invalid directional toggles at new edges
    for (let i = 0; i < cells.length; i++) {
      const atRightEdge = (i % cols) === cols - 1
      const atBottomEdge = Math.floor(i / cols) === rows - 1
      if (atRightEdge) cells[i].right = false
      if (atBottomEdge) cells[i].down = false
    }
    measureArrows()
  }


  // Insert a row at the top
  function insertRowAtTop() {
    if (rows >= 12) return // Max rows limit
    const newRows = rows + 1
    const newCells: EditCell[] = new Array(newRows * cols)
    
    // Fill the first row with empty cells
    for (let i = 0; i < cols; i++) {
      newCells[i] = { isFixed: false, right: false, down: false }
    }
    
    // Copy existing cells, shifting them down by one row
    for (let i = 0; i < cells.length; i++) {
      const oldRow = Math.floor(i / cols)
      const oldCol = i % cols
      const newIndex = (oldRow + 1) * cols + oldCol
      newCells[newIndex] = cells[i]
    }
    
    rows = newRows
    cells = newCells
    measureArrows()
  }

  // Insert a row at the bottom
  function insertRowAtBottom() {
    if (rows >= 12) return // Max rows limit
    applySize(rows + 1, cols)
  }

  // Insert a column at the left
  function insertColumnAtLeft() {
    if (cols >= 12) return // Max cols limit
    const newCols = cols + 1
    const newCells: EditCell[] = new Array(rows * newCols)
    
    // Copy existing cells, shifting them right by one column
    for (let i = 0; i < cells.length; i++) {
      const oldRow = Math.floor(i / cols)
      const oldCol = i % cols
      const newIndex = oldRow * newCols + (oldCol + 1)
      newCells[newIndex] = cells[i]
    }
    
    // Fill the first column with empty cells
    for (let row = 0; row < rows; row++) {
      const index = row * newCols
      newCells[index] = { isFixed: false, right: false, down: false }
    }
    
    cols = newCols
    cells = newCells
    measureArrows()
  }

  // Insert a column at the right
  function insertColumnAtRight() {
    if (cols >= 12) return // Max cols limit
    applySize(rows, cols + 1)
  }

  // Build arrows and puzzle JSON
  function deriveArrows(): Arrow[] {
    const arrows: Arrow[] = []
    for (let i = 0; i < cells.length; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      const cell = cells[i]
      if (cell.right && c < cols - 1) arrows.push({ from: i, to: i + 1, dir: 'right' })
      if (cell.down && r < rows - 1) arrows.push({ from: i, to: i + cols, dir: 'down' })
    }
    return arrows
  }

  // Check if a tile is being used in the puzzle
  function isTileUsed(index: number): boolean {
    const cell = cells[index]
    if (!cell) return false
    
    // Tile is used if it has fixed content, user input, or is connected via arrows
    if (cell.isFixed || cell.fixed) return true
    if (cell.right || cell.down) return true
    
    // Check if this tile is connected to any arrows from other tiles
    for (let i = 0; i < cells.length; i++) {
      const otherCell = cells[i]
      if (!otherCell) continue
      
      const otherRow = Math.floor(i / cols)
      const otherCol = i % cols
      const thisRow = Math.floor(index / cols)
      const thisCol = index % cols
      
      // Check if other tile has arrow pointing to this tile
      if (otherCell.right && otherRow === thisRow && otherCol === thisCol - 1) return true
      if (otherCell.down && otherCol === thisCol && otherRow === thisRow - 1) return true
    }
    
    return false
  }

  // Detect which rows and columns are actually used
  function getUsedBounds() {
    let minRow = rows, maxRow = -1, minCol = cols, maxCol = -1
    
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      if (cell.isFixed || cell.fixed || cell.right || cell.down) {
        const row = Math.floor(i / cols)
        const col = i % cols
        minRow = Math.min(minRow, row)
        maxRow = Math.max(maxRow, row)
        minCol = Math.min(minCol, col)
        maxCol = Math.max(maxCol, col)
      }
    }
    
    return {
      minRow: minRow === rows ? 0 : minRow,
      maxRow: maxRow === -1 ? 0 : maxRow,
      minCol: minCol === cols ? 0 : minCol,
      maxCol: maxCol === -1 ? 0 : maxCol
    }
  }

  // Trim grid to remove unused rows and columns
  function trimGrid() {
    const bounds = getUsedBounds()
    const trimmedRows = bounds.maxRow - bounds.minRow + 1
    const trimmedCols = bounds.maxCol - bounds.minCol + 1
    
    const trimmedCells: EditCell[] = []
    const trimmedSolutions: Record<number, string> = {}
    
    for (let newRow = 0; newRow < trimmedRows; newRow++) {
      for (let newCol = 0; newCol < trimmedCols; newCol++) {
        const oldRow = bounds.minRow + newRow
        const oldCol = bounds.minCol + newCol
        const oldIndex = oldRow * cols + oldCol
        const newIndex = newRow * trimmedCols + newCol
        
        const oldCell = cells[oldIndex]
        if (oldCell) {
          trimmedCells[newIndex] = { ...oldCell }
          if (!oldCell.isFixed && oldCell.fixed) {
            trimmedSolutions[newIndex] = oldCell.fixed
          }
        } else {
          trimmedCells[newIndex] = { isFixed: false, right: false, down: false }
        }
      }
    }
    
    return {
      rows: trimmedRows,
      cols: trimmedCols,
      cells: trimmedCells,
      solutions: trimmedSolutions
    }
  }

  function buildPuzzle(): Puzzle {
    const trimmed = trimGrid()
    
    const grid: Grid = {
      rows: trimmed.rows,
      cols: trimmed.cols,
      cells: trimmed.cells.map((c) => (c.isFixed && c.fixed ? { fixed: c.fixed } : {})),
      arrows: deriveArrowsForTrimmed(trimmed.rows, trimmed.cols, trimmed.cells),
    }
    
    return {
      id: meta.date, // Always use date as ID
      date: meta.date,
      title: meta.title || undefined,
      author: meta.author || undefined,
      grid,
      solutions: trimmed.solutions,
    }
  }

  // Derive arrows for trimmed grid
  function deriveArrowsForTrimmed(trimmedRows: number, trimmedCols: number, trimmedCells: EditCell[]) {
    const arrows: Arrow[] = []
    for (let i = 0; i < trimmedCells.length; i++) {
      const r = Math.floor(i / trimmedCols)
      const c = i % trimmedCols
      const cell = trimmedCells[i]
      if (cell.right && c < trimmedCols - 1) arrows.push({ from: i, to: i + 1, dir: 'right' })
      if (cell.down && r < trimmedRows - 1) arrows.push({ from: i, to: i + trimmedCols, dir: 'down' })
    }
    return arrows
  }

  function downloadJSON() {
    const data = buildPuzzle()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.id}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    
    // Also download an updated list.json for easy deployment
    downloadPuzzleList()
  }
  
  function downloadPuzzleList() {
    // This would need to be updated manually or via a build script
    // For now, just show a reminder
    console.log('Remember to update public/puzzles/list.json with the new puzzle filename')
  }

  async function copyJSON() {
    const data = buildPuzzle()
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }

  // Auto-trim the grid to remove unused rows and columns
  function autoTrim() {
    const bounds = getUsedBounds()
    if (bounds.minRow > 0 || bounds.maxRow < rows - 1 || bounds.minCol > 0 || bounds.maxCol < cols - 1) {
      const trimmedRows = bounds.maxRow - bounds.minRow + 1
      const trimmedCols = bounds.maxCol - bounds.minCol + 1
      
      // Create trimmed cells array
      const trimmedCells: EditCell[] = []
      for (let newRow = 0; newRow < trimmedRows; newRow++) {
        for (let newCol = 0; newCol < trimmedCols; newCol++) {
          const oldRow = bounds.minRow + newRow
          const oldCol = bounds.minCol + newCol
          const oldIndex = oldRow * cols + oldCol
          const newIndex = newRow * trimmedCols + newCol
          
          const oldCell = cells[oldIndex]
          if (oldCell) {
            trimmedCells[newIndex] = { ...oldCell }
          } else {
            trimmedCells[newIndex] = { isFixed: false, right: false, down: false }
          }
        }
      }
      
      // Update the grid
      rows = trimmedRows
      cols = trimmedCols
      cells = trimmedCells
      measureArrows()
    }
  }

  // Import JSON
  function loadFromPuzzle(p: Puzzle) {
    meta = { id: p.id, date: p.date, title: p.title ?? '', author: p.author ?? '' }
    applySize(p.grid.rows, p.grid.cols)
    cells = Array.from({ length: p.grid.rows * p.grid.cols }, (_, i) => {
      const cell = p.grid.cells[i]
      const fixedWord = cell?.fixed
      const solutionWord = p.solutions[i]
      return {
        isFixed: Boolean(fixedWord),
        fixed: (fixedWord ?? solutionWord) || undefined,
        right: p.grid.arrows.some(a => a.from === i && a.dir === 'right'),
        down: p.grid.arrows.some(a => a.from === i && a.dir === 'down'),
      }
    })
    measureArrows()
  }

  async function handleImportFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text) as Puzzle
      loadFromPuzzle(json)
    } catch (err) {
      console.error('Failed to import puzzle', err)
    } finally {
      input.value = ''
    }
  }

  // Visualization overlay
  let gridWrapEl: HTMLElement | null = null
  let cellEls: (HTMLElement | null)[] = []
  let svgSize = { width: 0, height: 0 }
  type ArrowLine = { x1: number; y1: number; x2: number; y2: number; key: string }
  let arrowLines: ArrowLine[] = []

  function collectEl(node: HTMLElement, index: number) {
    cellEls[index] = node
    measureArrows()
    return { destroy() { cellEls[index] = null; measureArrows() } }
  }

  async function measureArrows() {
    await tick()
    if (!gridWrapEl) { arrowLines = []; return }
    const rect = gridWrapEl.getBoundingClientRect()
    svgSize = { width: rect.width, height: rect.height }
    const lines: ArrowLine[] = []
    const arrows = deriveArrows()
    for (const a of arrows) {
      const fromEl = cellEls[a.from]
      const toEl = cellEls[a.to]
      if (!fromEl || !toEl) continue
      const fr = fromEl.getBoundingClientRect()
      const tr = toEl.getBoundingClientRect()
      let x1 = fr.left + fr.width / 2
      let y1 = fr.top + fr.height / 2
      let x2 = tr.left + tr.width / 2
      let y2 = tr.top + tr.height / 2
      if (a.dir === 'right') { x1 = fr.right; y1 = fr.top + fr.height / 2; x2 = tr.left; y2 = tr.top + tr.height / 2 }
      if (a.dir === 'down') { x1 = fr.left + fr.width / 2; y1 = fr.bottom; x2 = tr.left + tr.width / 2; y2 = tr.top }
      x1 -= rect.left; y1 -= rect.top; x2 -= rect.left; y2 -= rect.top
      lines.push({ x1, y1, x2, y2, key: `${a.from}-${a.to}-${a.dir}` })
    }
    arrowLines = lines
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => measureArrows())
  }
</script>

<div class="editor">
  <header>
    <div class="header-content">
      <img src="/logo.svg" alt="Waterfalls" class="logo" />
      <div class="header-text">
        <p class="subtitle">Editor</p>
      </div>
    </div>
  </header>
  
  <div class="editor-sections">
    <div class="metadata-section">
      <div class="metadata-row">
        <input type="text" value={meta.title} on:input={(e) => (meta.title = (e.target as HTMLInputElement).value)} placeholder="Title" />
        <input type="text" value={meta.author} on:input={(e) => (meta.author = (e.target as HTMLInputElement).value)} placeholder="Author" />
        <input type="date" value={meta.date} on:input={(e) => (meta.date = (e.target as HTMLInputElement).value)} placeholder="Date" />
      </div>
    </div>

    <div class="controls">
      <button on:click={downloadJSON}>Export JSON</button>
      <button on:click={copyJSON}>Copy JSON</button>
      <div class="file-input-wrapper">
        <input type="file" accept="application/json" on:change={handleImportFile} id="import-file" />
        <label for="import-file" class="file-input-label">Import JSON</label>
      </div>
    </div>

    <div class="controls">
      <div class="grid-size-info">
        <span class="size-label">Grid: {rows}×{cols}</span>
      </div>
      <div class="insert-controls">
        <div class="insert-section">
          <div class="insert-buttons">
            <button on:click={insertRowAtTop} disabled={rows >= 12} title="Insert row at top">↑</button>
            <button on:click={insertRowAtBottom} disabled={rows >= 12} title="Insert row at bottom">↓</button>
            <button on:click={insertColumnAtLeft} disabled={cols >= 12} title="Insert column at left">←</button>
            <button on:click={insertColumnAtRight} disabled={cols >= 12} title="Insert column at right">→</button>
          </div>
        </div>

      </div>
      <button on:click={autoTrim}>Auto-trim unused</button>
    </div>
  </div>

  <div class="grid-wrap" bind:this={gridWrapEl}>
    <svg class="arrows" width={svgSize.width} height={svgSize.height} viewBox={`0 0 ${svgSize.width} ${svgSize.height}`} aria-hidden="true">
      <defs>
        <marker id="arrowhead-editor" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor"></polygon>
        </marker>
      </defs>
      {#each arrowLines as l (l.key)}
        <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} marker-end="url(#arrowhead-editor)"></line>
      {/each}
    </svg>
    <div class="grid" style={`grid-template-columns: repeat(${cols}, 1fr);`}>
      {#each Array.from({ length: rows * cols }) as _, i}
        <div class={`tile ${cells[i]?.isFixed ? 'fixed' : ''} ${isTileUsed(i) ? 'used' : ''}`} use:collectEl={i}>
          <input
            class="word"
            type="text"
            value={cells[i]?.fixed ?? ''}
            on:input={(e) => {
              const val = (e.target as HTMLInputElement).value.trim()
              cells[i] = { ...(cells[i] ?? { isFixed: false, right: false, down: false }), fixed: val || undefined }
            }}
          />
          <div class="controls">
            <button 
              class="lock-btn"
              type="button"
              on:click={() => {
                const current = cells[i] ?? { isFixed: false, right: false, down: false }
                cells[i] = { ...current, isFixed: !current.isFixed }
              }}
              title={cells[i]?.isFixed ? 'Unlock (make editable)' : 'Lock (fixed at start)'}
            >
              {cells[i]?.isFixed ? '🔒' : '🔓'}
            </button>
            <div class="dirs">
              {#if (i % cols) !== cols - 1}
                <label><input type="checkbox" checked={cells[i]?.right} on:change={(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  cells[i] = { ...(cells[i] ?? { isFixed: false, right: false, down: false }), right: checked }
                  measureArrows()
                }} /> →</label>
              {/if}
              {#if Math.floor(i / cols) !== rows - 1}
                <label><input type="checkbox" checked={cells[i]?.down} on:change={(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  cells[i] = { ...(cells[i] ?? { isFixed: false, right: false, down: false }), down: checked }
                  measureArrows()
                }} /> ↓</label>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .editor { max-width: 880px; margin: 0 auto; padding: 24px; }
  header { margin-bottom: 16px; }
  .header-content { display: flex; align-items: baseline; gap: 12px; }
  .logo { height: 40px; width: auto; }
  .header-text { display: flex; align-items: baseline; gap: 12px; }
  .subtitle { color: #00AFB6; margin: 0; font-size: 16px;}
  
  .editor-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
    border-top: 1px solid #eee; padding-top: 16px;
  }
  
  .metadata-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .metadata-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .metadata-row input {
    flex: 1;
    min-width: 0;
  }
  .controls { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
  
  .grid-size-info {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: #f3f4f6;
    border-radius: 6px;
    border: 1px solid #d1d5db;
  }
  
  .size-label {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
  }
  
  .insert-section {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .insert-label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    min-width: 40px;
  }
  
  .insert-buttons {
    display: flex;
    gap: 4px;
  }
  
  .insert-buttons button {
    padding: 4px 8px;
    font-size: 12px;
    min-width: 50px;
  }
  
  .insert-buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  label { 
    display: inline-flex; 
    align-items: center; 
    gap: 6px; 
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }
  input[type="text"], input[type="date"] { 
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #ffffff;
    color: #374151;
    font-size: 14px;
    transition: all 0.15s ease;
  }
  input[type="text"]:focus, input[type="date"]:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  input::placeholder {
    color: #9ca3af;
  }
  .sep { width: 1px; height: 24px; background: #d1d5db; display: inline-block; }
  .file-input-wrapper {
    position: relative;
    display: inline-block;
  }
  
  .file-input-wrapper input[type="file"] {
    position: absolute;
    left: -9999px;
    opacity: 0;
    pointer-events: none;
  }
  .file-input-label {
    display: inline-flex;
    align-items: center;
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
  .file-input-label:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #1f2937;
  }
  .file-input-label:active {
    background: #f3f4f6;
    transform: translateY(1px);
  }
  
  /* Export and Copy JSON button styling */
  button {
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
  
  button:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #1f2937;
  }
  
  button:active {
    background: #f3f4f6;
    transform: translateY(1px);
  }

  .grid { display: grid; gap: 10px; }
  .grid-wrap { position: relative; }
  .arrows { 
    position: absolute; 
    inset: 0; 
    pointer-events: none; 
    color: #84D9DD; 
    z-index: 10;
  }
  .arrows line { stroke: none; }
  .tile { 
    border: 1px dashed #d1d5db; 
    border-radius: 12px; 
    min-height: 72px; 
    display: flex; 
    flex-direction: column;
    align-items: center; 
    justify-content: center; 
    position: relative;
    padding: 8px;
    gap: 4px;
  }
  .tile.used {
    border-color: #84D9DD;
  }
  .tile.fixed {
    background-color: #E6F6F7;
    position: relative;
    z-index: 10;
  }
  .word { 
    width: 100%; 
    padding: 6px 8px; 
    border: 1px solid #84D9DD; 
    border-radius: 4px; 
    text-align: center;
    font-size: 14px;
    text-transform: uppercase;
    background: white;
    position: relative;
    z-index: 10;
  }
  .tile.fixed .word {
    font-weight: bold;
    color: #005155;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 4px;
  }
  .lock-btn {
    background: #ffffff;
    border: 1px solid #d1d5db;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lock-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }
  .lock-btn:active {
    background: #f3f4f6;
    transform: translateY(1px);
  }
  .dirs { 
    display: flex; 
    gap: 4px; 
    font-size: 12px; 
    color: #666;
  }
  .dirs label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .dirs label:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }
  .dirs input[type="checkbox"] {
    margin: 0;
  }

  @media (prefers-color-scheme: dark) {
    .tile { border-color: #444; }
    .tile.fixed { background-color: #2a2a2a; }
    .dirs { color: #aaa; }
    .word { 
      background: transparent; 
      border-color: #444; 
      color: inherit; 
    }
    .tile.fixed .word {
      font-weight: bold;
    }
    .sep { background: #374151; }
    .arrows { color: #777; }
    label { color: #f9fafb; }
    input[type="text"], input[type="date"] {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }
    input[type="text"]:focus, input[type="date"]:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }
    
    input::placeholder {
      color: #6b7280;
    }
      .file-input-label {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }
    .file-input-label:hover {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }
    .file-input-label:active {
      background: #111827;
    }
    
    button {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }
    button:hover {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }
    button:active {
      background: #111827;
    }
    .lock-btn {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }
    .lock-btn:hover {
      background: #374151;
      border-color: #4b5563;
    }
    .lock-btn:active {
      background: #111827;
    }
    .dirs label {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }
    .dirs label:hover {
      background: #374151;
      border-color: #4b5563;
    }
    
    .grid-size-info {
      background: #374151;
      border-color: #4b5563;
    }
    
    .size-label {
      color: #f9fafb;
    }
    
    .insert-label {
      color: #f9fafb;
    }
  }
  
  :global(body) { 
    font-family: Inter, sans-serif;
    font-feature-settings: 'liga' 1, 'calt' 1;
  }
  @supports (font-variation-settings: normal) {
    :global(body) { font-family: InterVariable, sans-serif; }
  }
</style>


