<script lang="ts">
  import { onMount } from 'svelte'
  import { game, fetchPuzzleIndex } from '../lib/state.svelte'

  onMount(async () => {
    if (game.index.length === 0) {
      await fetchPuzzleIndex()
    }
  })

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

  function isPast(dateStr: string): boolean {
    const today = new Date()
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0')
    return dateStr <= todayStr
  }

  function isPuzzleCompleted(puzzleId: string): boolean {
    const saved = localStorage.getItem(`waterfalls-${puzzleId}`)
    if (!saved) return false
    
    try {
      const state = JSON.parse(saved)
      if (state.puzzleId !== puzzleId) return false
      
      // Check if the puzzle was marked as solved
      const isCompleted = state.solved === true
      console.log(`Puzzle ${puzzleId} completed:`, isCompleted, state)
      return isCompleted
    } catch (e) {
      console.warn('Failed to parse saved state:', e)
      return false
    }
  }

  function selectPuzzle(id: string) {
    // Dispatch event to parent to switch to play mode and load puzzle
    const event = new CustomEvent('puzzleSelect', { detail: id })
    window.dispatchEvent(event)
  }

  // Show all puzzles, sorted by date (newest first), filtering out future puzzles
  $: allPuzzles = game.index.filter(puzzle => isPast(puzzle.date))
</script>

<div class="archive">
  <header>
    <div class="header-content">
      <img src="/waterfalls/logo.svg" alt="Waterfalls" class="logo" />
      <div class="header-text">
        <p class="subtitle">Archive</p>
      </div>
    </div>
  </header>

  <div class="puzzle-sections">
    {#if allPuzzles.length > 0}
      <div class="puzzle-grid">
        {#each allPuzzles as puzzle}
          <button 
            class="puzzle-card"
            class:completed={isPuzzleCompleted(puzzle.id)}
            on:click={() => selectPuzzle(puzzle.id)}
          >
            <div class="puzzle-info">
              <div class="puzzle-date">
                {formatDate(puzzle.date)}
                {#if isPuzzleCompleted(puzzle.id)}
                  <span class="checkmark">✓</span>
                {/if}
              </div>
              <div class="puzzle-title-author">
                {#if puzzle.title}
                  <span class="puzzle-title">{puzzle.title}</span>
                {/if}
                {#if puzzle.author}
                  <span class="puzzle-author">by {puzzle.author}</span>
                {/if}
              </div>
            </div>
            <div class="puzzle-arrow">→</div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <p>No puzzles available yet. Check back later!</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .archive {
    max-width: 880px;
    margin: 0 auto;
    padding: 24px;
  }

  header { margin-bottom: 16px; }
  .header-content { display: flex; align-items: baseline; gap: 12px; }
  .logo { height: 40px; width: auto; }
  .header-text { display: flex; align-items: baseline; gap: 12px; margin-bottom: -10px; }
  .subtitle { color: #00AFB6; margin: 0; font-size: 16px; }

  .puzzle-sections {
    display: flex;
    flex-direction: column;
    border-top: 1px solid #eee;
    padding-top: 16px;
  }

  .puzzle-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .puzzle-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .puzzle-card:hover {
    border-color: #00AFB6;
  }

  .puzzle-card.completed {
    background: #E6F6F7;
  }


  .puzzle-info {
    flex: 1;
  }

  .puzzle-date {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .checkmark {
    color: #00787D;
    font-size: 1rem;
    font-weight: bold;
  }

  .puzzle-title-author {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .puzzle-title {
    color: #00AFB6;
    font-weight: 500;
    font-size: 1rem;
  }

  .puzzle-author {
    color: #6b7280;
    font-size: 0.8rem;
  }

  .puzzle-arrow {
    color: #00AFB6;
    font-size: 1rem;
    font-weight: bold;
    margin-left: 12px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #6b7280;
  }

  .empty-state p {
    font-size: 1.1rem;
    margin: 0;
  }

  @media (prefers-color-scheme: dark) {
    .puzzle-sections {
      border-top-color: #333;
    }

    .puzzle-card {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }

    .puzzle-card.completed {
      background: #1e3a3a;
    }

    .puzzle-card:hover {
      border-color: #00AFB6;
    }

    .puzzle-date {
      color: #f9fafb;
    }

    .puzzle-title {
      color: #00AFB6;
    }

    .puzzle-author {
      color: #9ca3af;
    }

    .puzzle-arrow {
      color: #00AFB6;
    }

    .checkmark {
      color: #00787D;
    }

    .empty-state {
      color: #9ca3af;
    }
  }

  @media (max-width: 768px) {
    .archive {
      padding: 16px;
    }

    .puzzle-grid {
      grid-template-columns: 1fr;
    }

  }
</style>
