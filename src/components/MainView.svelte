<script lang="ts">
  import { onMount } from 'svelte'
  import { tick } from 'svelte'
  import type { Puzzle } from '../types/puzzle'
  import { game, loadPuzzle, isSolved, fetchPuzzleIndex, fetchPuzzleById } from '../lib/state.svelte'

  const today = new Date().toISOString().slice(0, 10)

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
      if (game.index.length > 0) {
        const initial = game.index[0]
        await fetchPuzzleById(initial.id)
      } else if (!game.puzzle) {
        loadPuzzle(makeDemoPuzzle())
      }
    } finally {
      measureArrows()
    }
  })

  function setEntry(index: number, value: string) {
    game.state.entries[index] = value
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
      if (!cells[i].fixed) { game.state.focusedCell = i; return }
    }
  }

  function goNext() {
    if (!game.puzzle) return
    const cells = game.puzzle.grid.cells
    let i = game.state.focusedCell ?? 0
    for (let step = 0; step < cells.length; step++) {
      i = (i + 1) % cells.length
      if (!cells[i].fixed) { game.state.focusedCell = i; return }
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
    const current = game.state.entries[i] ?? ''
    const nextLen = Math.min(current.length + 1, solution.length)
    const next = solution.slice(0, nextLen)
    game.state.entries[i] = next
    game.state.reveals[i] = next
  }

  // Arrow overlay measurements
  let gridWrapEl: HTMLElement | null = null
  let cellEls: (HTMLElement | null)[] = []
  let svgSize = { width: 0, height: 0 }
  type ArrowLine = { x1: number; y1: number; x2: number; y2: number; key: string }
  let arrowLines: ArrowLine[] = []

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
    if (!game.puzzle || !gridWrapEl) { arrowLines = []; return }
    await tick()
    const rect = gridWrapEl.getBoundingClientRect()
    svgSize = { width: rect.width, height: rect.height }
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
</script>

<div class="app">
  <header>
    <h1>Double Speak</h1>
    <p class="subtitle">Daily word puzzle · {today}</p>
  </header>
  <main>
    {#if game.puzzle}
      <div class="meta">
        <div class="title">{game.puzzle.title ?? 'Daily puzzle'}</div>
        <div class="byline">{game.puzzle.author ?? ''}</div>
      </div>

      <div class="picker">
        <label>
          Puzzle:
          <select
            on:change={async (e) => {
              const id = (e.target as HTMLSelectElement).value
              await fetchPuzzleById(id)
              await tick()
              measureArrows()
            }}
            bind:value={game.selectedId}
          >
            {#each game.index as item}
              <option value={item.id}>{item.date} · {item.title ?? item.id}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="grid-wrap" bind:this={gridWrapEl}>
        <svg class="arrows" width={svgSize.width} height={svgSize.height} viewBox={`0 0 ${svgSize.width} ${svgSize.height}`} aria-hidden="true">
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
              <div class={`cell empty ${game.state.focusedCell === i ? 'focused' : ''}`} use:collectEl={i}>
                <input
                  class="entry"
                  type="text"
                  placeholder={cell.hint ?? ''}
                  value={game.state.entries[i] ?? ''}
                  on:input={(e) => setEntry(i, (e.target as HTMLInputElement).value)}
                  on:focus={() => focusCell(i)}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'Tab') { e.preventDefault(); goNext() }
                    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
                  }}
                />
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
        <button on:click={goPrev}>Prev</button>
        <button on:click={goNext}>Next</button>
        <button on:click={revealLetter}>Reveal letter</button>
        <span class="status">{isSolved() ? 'Solved ✅' : 'Keep going…'}</span>
      </div>
    {:else}
      <p>Loading…</p>
    {/if}
  </main>
</div>

<style>
  .app { max-width: 880px; margin: 0 auto; padding: 24px; }
  header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
  h1 { font-size: 28px; margin: 0; }
  .subtitle { color: #666; margin: 0; }
  main { border-top: 1px solid #eee; padding-top: 16px; }
  .meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; }
  .title { font-weight: 600; }
  .byline { color: #888; font-size: 14px; }
  .picker { margin-bottom: 12px; }

  .grid {
    display: grid;
    gap: 10px;
  }
  .grid-wrap { position: relative; }
  .arrows {
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: #aaa;
  }
  .arrows line {
    stroke: currentColor;
    stroke-width: 2;
  }
  .cell {
    min-height: 72px;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cell-bg, transparent);
  }
  .cell.unused {
    border: none;
    background: transparent;
    visibility: hidden;
  }
  .cell.fixed {
    --cell-bg: rgba(0,0,0,0.04);
  }
  .cell.focused {
    outline: 2px solid #4f46e5;
    outline-offset: -2px;
  }
  .fixed-text { font-weight: 600; }
  .entry {
    width: 100%;
    height: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    font: inherit;
  }
  .toolbar { display: flex; gap: 10px; align-items: center; margin-top: 12px; }
  .status { color: #666; }
  @media (prefers-color-scheme: dark) {
    .subtitle { color: #aaa; }
    main { border-top-color: #333; }
    .cell { border-color: #333; }
    .cell.fixed { --cell-bg: rgba(255,255,255,0.04); }
    .entry { background: transparent; color: inherit; }
    .byline { color: #aaa; }
    .status { color: #aaa; }
  }
  :global(button){ cursor: pointer; }
  :global(input){ font: inherit; }
  :global(*) { box-sizing: border-box; }
</style>


