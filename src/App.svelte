<script lang="ts">
  import MainView from './components/MainView.svelte'
  import EditorView from './components/EditorView.svelte'
  import ArchiveView from './components/ArchiveView.svelte'
  import { onMount } from 'svelte'
  import { game, fetchPuzzleIndex, fetchPuzzleById } from './lib/state.svelte'

  let mode: 'play' | 'edit' | 'archive' = 'play'

  onMount(() => {
    // Listen for navigation events from MainView
    const handleNavigate = (event: CustomEvent) => {
      if (event.detail === 'archive') {
        mode = 'archive'
      }
    }
    
    // Listen for puzzle selection from ArchiveView
    const handlePuzzleSelect = (event: CustomEvent) => {
      mode = 'play'
      fetchPuzzleById(event.detail)
    }
    
    window.addEventListener('navigate', handleNavigate as EventListener)
    window.addEventListener('puzzleSelect', handlePuzzleSelect as EventListener)
    
    return () => {
      window.removeEventListener('navigate', handleNavigate as EventListener)
      window.removeEventListener('puzzleSelect', handlePuzzleSelect as EventListener)
    }
  })

</script>

<div class="mode-toggle">
  <button 
    class="mode-btn" 
    class:active={mode==='play'}
    on:click={() => (mode = 'play')}
  >
    Play
  </button>
  <button 
    class="mode-btn" 
    class:active={mode==='archive'}
    on:click={() => (mode = 'archive')}
  >
    Archive
  </button>
  <button 
    class="mode-btn" 
    class:active={mode==='edit'}
    on:click={() => (mode = 'edit')}
  >
    Editor
  </button>
</div>

{#if mode === 'play'}
  <MainView />
{:else if mode === 'archive'}
  <ArchiveView />
{:else}
  <EditorView />
{/if}

<style>
  .mode-toggle {
    padding: 8px 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    border-bottom: 1px solid #e5e7eb;
  }
  .mode-btn {
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
  .mode-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #374151;
  }
  .mode-btn.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
  }
  .mode-btn.active:hover {
    background: #2563eb;
    border-color: #2563eb;
  }
  
  @media (prefers-color-scheme: dark) {
    .mode-toggle {
      border-bottom-color: #374151;
    }
    .mode-btn {
      background: #1f2937;
      border-color: #374151;
      color: #9ca3af;
    }
    .mode-btn:hover {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }
    .mode-btn.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: #ffffff;
    }
    .mode-btn.active:hover {
      background: #2563eb;
      border-color: #2563eb;
    }
  }
</style>


