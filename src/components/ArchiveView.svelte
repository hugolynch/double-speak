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
      return isCompleted
    } catch (e) {
      console.warn('Failed to parse saved state:', e)
      return false
    }
  }

  function getPuzzleCompletionTime(puzzleId: string): number | null {
    const saved = localStorage.getItem(`waterfalls-${puzzleId}`)
    if (!saved) return null
    
    try {
      const state = JSON.parse(saved)
      if (state.puzzleId !== puzzleId) return null
      return state.completionTime || null
    } catch (e) {
      return null
    }
  }

  function getPuzzleScore(puzzleId: string): number | null {
    const saved = localStorage.getItem(`waterfalls-${puzzleId}`)
    if (!saved) return null
    
    try {
      const state = JSON.parse(saved)
      if (state.puzzleId !== puzzleId) return null
      
      // Calculate score from tileCompletions if available
      if (state.tileCompletions) {
        let totalScore = 0
        for (const [cellIndex, completion] of Object.entries(state.tileCompletions)) {
          const comp = completion as { time: number, submits: number }
          totalScore += comp.time * comp.submits
        }
        return totalScore
      }
      
      return null
    } catch (e) {
      return null
    }
  }

  function wasCompletedInOneSubmit(puzzleId: string): boolean {
    const saved = localStorage.getItem(`waterfalls-${puzzleId}`)
    if (!saved) return false
    
    try {
      const state = JSON.parse(saved)
      if (state.puzzleId !== puzzleId) return false
      
      // Check if all tiles were completed in the same submit
      if (state.tileCompletions) {
        const submits = new Set<number>()
        for (const [cellIndex, completion] of Object.entries(state.tileCompletions)) {
          const comp = completion as { time: number, submits: number }
          submits.add(comp.submits)
        }
        return submits.size === 1
      }
      
      return false
    } catch (e) {
      return false
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function selectPuzzle(id: string) {
    // Dispatch event to parent to switch to play mode and load puzzle
    const event = new CustomEvent('puzzleSelect', { detail: id })
    window.dispatchEvent(event)
  }

  // Admin mode state
  let adminMode = $state(false)

  // Show all puzzles, sorted by date (newest first), filtering out future puzzles unless in admin mode
  let allPuzzles = $derived(game.index.filter(puzzle => adminMode || isPast(puzzle.date)))
</script>

<div class="archive">
  <header>
    <div class="header-content">
      <div class="header-left">
        <img src="/waterfalls/logo.svg" alt="Waterfalls" class="logo" />
        <span class="subtitle">Archive</span>
      </div>
      <div class="admin-toggle">
        <span class="admin-label">Admin</span>
        <button 
          class="admin-switch" 
          class:active={adminMode}
          onclick={() => adminMode = !adminMode}
          aria-label={adminMode ? 'Disable admin mode' : 'Enable admin mode'}
        >
          <div class="switch-slider"></div>
        </button>
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
            onclick={() => selectPuzzle(puzzle.id)}
          >
            <div class="puzzle-info">
              <div class="puzzle-date">
                {formatDate(puzzle.date)}
              </div>
              <div class="puzzle-title-author">
                {#if puzzle.title}
                <span class="puzzle-title">{puzzle.title}</span>
                {/if}
                {#if puzzle.author}
                <span class="puzzle-author">by {puzzle.author}</span>
                {/if}
              </div>
              {#if isPuzzleCompleted(puzzle.id)}
                {@const completionTime = getPuzzleCompletionTime(puzzle.id)}
                {@const score = getPuzzleScore(puzzle.id)}
                {#if completionTime}
                  <div class="completion-info">
                    <span class="completion-time">Completed in {formatTime(completionTime)}</span>
                    {#if score !== null}
                      <span class="completion-score">Score: {score}</span>
                    {/if}
                    {#if wasCompletedInOneSubmit(puzzle.id)}
                      <span class="star">★</span>
                    {:else}
                      <span class="checkmark">✓</span>
                    {/if}
                  </div>
                {/if}
              {/if}
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

  header { 
    margin-bottom: 16px; 
  }
  
  .header-content { 
    display: flex; 
    align-items: baseline; 
    justify-content: space-between;
    gap: 16px; 
  }
  
  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: -10px;
  }
  
  .logo { 
    height: 40px; 
    width: auto; 
  }
  
  .subtitle { 
    color: #00AFB6; 
    margin: 0; 
    font-size: 16px; 
  }
  
  .admin-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .admin-label {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
  }
  
  .admin-switch {
    position: relative;
    width: 40px;
    height: 24px;
    border: none;
    border-radius: 12px;
    background: #f3f4f6;
    cursor: pointer;
    transition: background-color 0.2s ease;
    padding: 0;
    outline: none;
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 2px;
  }
  
  .admin-switch:hover {
    background: #e5e7eb;
  }
  
  .admin-switch.active {
    background: #00AFB6;
  }
  
  .switch-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #ffffff;
    border-radius: 50%;
    transition: transform 0.2s ease;
  }
  
  .admin-switch.active .switch-slider {
    transform: translateX(16px);
  }

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
    border: 1px solid #C3EBED;
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
    color: #00AFB6;
    font-size: 1rem;
  }

  .star {
    color: #00AFB6;
    font-size: 1rem;
  }

  .completion-info {
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .completion-time {
    color: #6b7280;
    font-size: 0.8rem;
  }

  .completion-score {
    color: #6b7280;
    font-size: 0.8rem;
  }

  .puzzle-title-author {
    display: flex;
    align-items: baseline;
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
      border-color: #C3EBED;
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

    .star {
      color: #00AFB6;
    }

    .completion-time {
      color: #9ca3af;
    }

    .completion-score {
      color: #9ca3af;
    }

    .empty-state {
      color: #9ca3af;
    }

    .admin-label {
      color: #9ca3af;
    }

    .admin-switch {
      background: #374151;
    }

    .admin-switch:hover {
      background: #4b5563;
    }

    .admin-switch.active {
      background: #00AFB6;
    }

    .switch-slider {
      background: #f9fafb;
    }
  }

  @media (max-width: 768px) {
    .archive {
      padding: 16px;
    }
    
    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    
    .header-left {
      width: 100%;
      justify-content: space-between;
    }
    
    .admin-toggle {
      align-self: flex-end;
    }
    
    .admin-label {
      font-size: 12px;
    }
    
    .admin-switch {
      width: 36px;
      height: 20px;
    }
    
    .switch-slider {
      width: 16px;
      height: 16px;
    }
    
    .admin-switch.active .switch-slider {
      transform: translateX(16px);
    }
  }
</style>