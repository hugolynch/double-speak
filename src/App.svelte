<script lang="ts">
  import MainView from './components/MainView.svelte'
  import EditorView from './components/EditorView.svelte'
  let mode: 'play' | 'edit' = 'play'
</script>

<div style="padding: 8px 12px; display: flex; gap: 8px; align-items: center;">
  <button on:click={() => (mode = 'play')} disabled={mode==='play'}>Play</button>
  <button on:click={() => (mode = 'edit')} disabled={mode==='edit'}>Editor</button>
</div>

{#if mode === 'play'}
  <MainView />
{:else}
  <EditorView />
{/if}


