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
    rows = Math.max(1, Math.min(12, Math.floor(newRows)))
    cols = Math.max(1, Math.min(12, Math.floor(newCols)))
    const nextTotal = rows * cols
    const next: EditCell[] = new Array(nextTotal)
    for (let i = 0; i < nextTotal; i++) {
      next[i] = cells[i] ?? { isFixed: false, right: false, down: false }
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

  function handleRowsInput(value: string) {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    applySize(n, cols)
  }

  function handleColsInput(value: string) {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    applySize(rows, n)
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

  function buildPuzzle(): Puzzle {
    const grid: Grid = {
      rows,
      cols,
      cells: cells.map((c) => (c.isFixed && c.fixed ? { fixed: c.fixed } : {})),
      arrows: deriveArrows(),
    }
    const solutions: Record<number, string> = {}
    cells.forEach((c, i) => {
      if (!c.isFixed && c.fixed) solutions[i] = c.fixed
    })
    return {
      id: meta.id || meta.date,
      date: meta.date,
      title: meta.title || undefined,
      author: meta.author || undefined,
      grid,
      solutions,
    }
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
    <h2>Puzzle Editor</h2>
    <div class="controls">
      <label>ID <input type="text" value={meta.id} on:input={(e) => (meta.id = (e.target as HTMLInputElement).value)} /></label>
      <label>Date <input type="date" value={meta.date} on:input={(e) => (meta.date = (e.target as HTMLInputElement).value)} /></label>
      <label>Title <input type="text" value={meta.title} on:input={(e) => (meta.title = (e.target as HTMLInputElement).value)} /></label>
      <label>Author <input type="text" value={meta.author} on:input={(e) => (meta.author = (e.target as HTMLInputElement).value)} /></label>
      <span class="sep"></span>
      <label>Rows <input type="number" min="1" max="12" value={rows} on:input={(e) => handleRowsInput((e.target as HTMLInputElement).value)} /></label>
      <label>Cols <input type="number" min="1" max="12" value={cols} on:input={(e) => handleColsInput((e.target as HTMLInputElement).value)} /></label>
      <span class="sep"></span>
      <button on:click={downloadJSON}>Export JSON</button>
      <button on:click={copyJSON}>Copy JSON</button>
      <label class="import">Import <input type="file" accept="application/json" on:change={handleImportFile} /></label>
    </div>
  </header>

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
        <div class="tile" use:collectEl={i}>
          <div class="tile-meta">{Math.floor(i / cols) + 1},{(i % cols) + 1}</div>
          <input
            class="word"
            type="text"
            placeholder="word"
            value={cells[i]?.fixed ?? ''}
            on:input={(e) => {
              const val = (e.target as HTMLInputElement).value.trim()
              cells[i] = { ...(cells[i] ?? { isFixed: false, right: false, down: false }), fixed: val || undefined }
            }}
          />
          <label class="toggle">
            <input type="checkbox" checked={cells[i]?.isFixed} on:change={(e) => {
              const checked = (e.target as HTMLInputElement).checked
              cells[i] = { ...(cells[i] ?? { isFixed: false, right: false, down: false }), isFixed: checked }
            }} />
            Fixed at start
          </label>
          <div class="dirs">
            <label><input type="checkbox" checked={cells[i]?.right} disabled={(i % cols) === cols - 1} on:change={(e) => {
              const checked = (e.target as HTMLInputElement).checked
              cells[i] = { ...(cells[i] ?? { isFixed: false, right: false, down: false }), right: checked }
              measureArrows()
            }} /> →</label>
            <label><input type="checkbox" checked={cells[i]?.down} disabled={Math.floor(i / cols) === rows - 1} on:change={(e) => {
              const checked = (e.target as HTMLInputElement).checked
              cells[i] = { ...(cells[i] ?? { isFixed: false, right: false, down: false }), down: checked }
              measureArrows()
            }} /> ↓</label>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .editor { max-width: 960px; margin: 0 auto; padding: 16px; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  h2 { margin: 0; font-size: 20px; }
  .controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  label { display: inline-flex; align-items: center; gap: 6px; }
  input[type="number"] { width: 80px; padding: 6px 8px; }
  .sep { width: 1px; height: 24px; background: #ddd; display: inline-block; }
  .import input[type="file"] { display: inline-block; }

  .grid { display: grid; gap: 10px; }
  .grid-wrap { position: relative; }
  .arrows { position: absolute; inset: 0; pointer-events: none; color: #aaa; }
  .arrows line { stroke: currentColor; stroke-width: 2; }
  .tile { border: 1px dashed #bbb; border-radius: 8px; min-height: 72px; display: flex; align-items: center; justify-content: center; position: relative; }
  .tile-meta { position: absolute; top: 6px; left: 8px; font-size: 12px; color: #888; }
  .word { width: 90%; max-width: 200px; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; }
  .toggle { position: absolute; bottom: 6px; left: 8px; font-size: 12px; color: #666; display: inline-flex; align-items: center; gap: 6px; }
  .dirs { position: absolute; bottom: 6px; right: 8px; display: inline-flex; gap: 10px; font-size: 12px; color: #666; }

  @media (prefers-color-scheme: dark) {
    .tile { border-color: #444; }
    .tile-meta { color: #aaa; }
    .dirs { color: #aaa; }
    .toggle { color: #aaa; }
    .word { background: transparent; border-color: #444; color: inherit; }
    .sep { background: #333; }
    .arrows { color: #777; }
  }
</style>


