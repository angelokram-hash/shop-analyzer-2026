<script>
  import { onMount } from 'svelte';
  import { getImageUrl, formatEUR, formatNum } from '$lib/utils';
  import { loadViews, saveView, deleteView } from '$lib/savedViews';

  let allData = $state([]);
  let loading = $state(true);
  let PivotTableUI = $state(null);
  let TableRenderers = $state(null);

  // Pivot state (managed by PivotTableUI via on:change)
  let pivotState = $state({
    rows: ['Kollektion'],
    cols: ['Monat'],
    aggregatorName: 'Sum',
    vals: ['Umsatz'],
    rendererName: 'Table',
  });

  // Saved views
  let savedList = $state([]);
  let saveName = $state('');
  let showSaveInput = $state(false);

  // Image browser
  let showImageBrowser = $state(false);
  let imageSearchTerm = $state('');
  let lightboxUrl = $state('');

  // KPIs
  let totalUmsatz = $derived(allData.reduce((s, r) => s + (r.Umsatz || 0), 0));
  let totalStueck = $derived(allData.reduce((s, r) => s + (r.Anzahl || 0), 0));
  let uniqueKollektionen = $derived(new Set(allData.map(r => r.Kollektion)).size);
  let uniqueKassen = $derived(new Set(allData.map(r => r.Kasse)).size);

  // Image browser data
  let imageGroups = $derived.by(() => {
    if (!showImageBrowser) return [];
    const term = imageSearchTerm.toLowerCase();
    const map = new Map();
    for (const r of allData) {
      if (term && !r.Kollektion.toLowerCase().includes(term) && !r.SubKollektion.toLowerCase().includes(term)) continue;
      const key = r.Kollektion;
      if (!map.has(key)) map.set(key, { name: key, images: new Set(), count: 0, umsatz: 0 });
      const g = map.get(key);
      g.images.add(r.BildId);
      g.count += r.Anzahl;
      g.umsatz += r.Umsatz;
    }
    return Array.from(map.values())
      .map(g => ({ ...g, images: Array.from(g.images).slice(0, 12) }))
      .sort((a, b) => b.umsatz - a.umsatz);
  });

  onMount(async () => {
    // Load data
    const res = await fetch('/data.json');
    allData = await res.json();
    loading = false;

    // Dynamic import of svelte-pivottable (Svelte 4 component)
    const pivotMod = await import('svelte-pivottable/PivotTableUI.svelte');
    PivotTableUI = pivotMod.default;
    const renderersMod = await import('svelte-pivottable/TableRenderers');
    TableRenderers = renderersMod.default;

    savedList = loadViews();
  });

  function handlePivotChange(e) {
    pivotState = { ...pivotState, ...e.detail };
  }

  function doSave() {
    if (!saveName.trim()) return;
    saveView(saveName.trim(), pivotState);
    savedList = loadViews();
    saveName = '';
    showSaveInput = false;
  }

  function doLoad(view) {
    pivotState = { ...view.state };
    showImageBrowser = false;
  }

  function doDelete(id) {
    deleteView(id);
    savedList = loadViews();
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
  <!-- Header -->
  <header class="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-40">
    <div class="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200/50">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 tracking-tight">Shop Analyzer 2026</h1>
          <p class="text-xs text-gray-400">{allData.length.toLocaleString('de-DE')} Datensätze geladen</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Image Browser Toggle -->
        <button
          onclick={() => showImageBrowser = !showImageBrowser}
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
            {showImageBrowser ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          Bilder
        </button>

        <!-- Saved Views -->
        <div class="relative group">
          <button class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            Analysen ({savedList.length})
          </button>
          <div class="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div class="flex items-center gap-2 mb-3">
              {#if showSaveInput}
                <input type="text" bind:value={saveName} placeholder="Name..." class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                <button onclick={doSave} class="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">OK</button>
                <button onclick={() => showSaveInput = false} class="px-2 py-1.5 text-gray-400 text-xs hover:text-gray-600">✕</button>
              {:else}
                <button onclick={() => showSaveInput = true} class="w-full px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors">
                  Aktuelle Ansicht speichern
                </button>
              {/if}
            </div>
            {#if savedList.length > 0}
              <div class="space-y-1 max-h-64 overflow-y-auto">
                {#each savedList as view}
                  <div class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 group/item transition-colors">
                    <button onclick={() => doLoad(view)} class="flex-1 text-left text-sm text-gray-700 font-medium truncate">{view.name}</button>
                    <span class="text-[10px] text-gray-300">{new Date(view.timestamp).toLocaleDateString('de-DE')}</span>
                    <button onclick={() => doDelete(view.id)} class="text-gray-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity">✕</button>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-gray-400 text-center py-2">Noch keine gespeichert</p>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="flex items-center justify-center h-96">
      <div class="text-center">
        <div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-400">Daten werden geladen...</p>
      </div>
    </div>
  {:else}
    <!-- KPIs -->
    <div class="max-w-[1920px] mx-auto px-6 pt-6 pb-4">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl p-5 border border-gray-100/80 shadow-sm shadow-gray-100">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Umsatz Gesamt</p>
          <p class="text-2xl font-bold text-gray-900 mt-1.5 tabular-nums">{formatEUR(totalUmsatz)}</p>
        </div>
        <div class="bg-white rounded-2xl p-5 border border-gray-100/80 shadow-sm shadow-gray-100">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Verkaufte Stück</p>
          <p class="text-2xl font-bold text-gray-900 mt-1.5 tabular-nums">{formatNum(totalStueck)}</p>
        </div>
        <div class="bg-white rounded-2xl p-5 border border-gray-100/80 shadow-sm shadow-gray-100">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Kollektionen</p>
          <p class="text-2xl font-bold text-gray-900 mt-1.5">{uniqueKollektionen}</p>
        </div>
        <div class="bg-white rounded-2xl p-5 border border-gray-100/80 shadow-sm shadow-gray-100">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Filialen</p>
          <p class="text-2xl font-bold text-gray-900 mt-1.5">{uniqueKassen}</p>
        </div>
      </div>
    </div>

    {#if showImageBrowser}
      <!-- Image Browser -->
      <div class="max-w-[1920px] mx-auto px-6 pb-8">
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div class="flex items-center gap-4 mb-6">
            <h2 class="text-lg font-bold text-gray-900">Kollektionen & Produktbilder</h2>
            <div class="relative flex-1 max-w-sm">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                bind:value={imageSearchTerm}
                placeholder="Kollektion suchen..."
                class="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <span class="text-sm text-gray-400">{imageGroups.length} Kollektionen</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-2">
            {#each imageGroups as group}
              <div class="bg-gray-50/50 rounded-xl border border-gray-100 p-4 hover:border-indigo-200 transition-colors">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-semibold text-gray-800 text-sm truncate">{group.name}</h3>
                  <div class="flex gap-3 text-[11px] text-gray-400">
                    <span>{formatNum(group.count)} Stk</span>
                    <span class="font-medium text-indigo-600">{formatEUR(group.umsatz)}</span>
                  </div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  {#each group.images as bid}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <img
                      src={getImageUrl(bid, 120)}
                      alt=""
                      class="w-14 h-14 object-cover rounded-lg cursor-pointer hover:scale-110 transition-transform shadow-sm"
                      loading="lazy"
                      onclick={() => lightboxUrl = getImageUrl(bid, 1000)}
                      onerror={(e) => { e.currentTarget.style.display='none'; }}
                    />
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <!-- Pivot Table -->
      <div class="max-w-[1920px] mx-auto px-6 pb-8">
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-x-auto">
          {#if PivotTableUI && TableRenderers}
            <svelte:component
              this={PivotTableUI}
              data={allData}
              renderers={TableRenderers}
              {...pivotState}
              on:update={handlePivotChange}
            />
          {:else}
            <div class="flex items-center justify-center py-20">
              <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Lightbox -->
{#if lightboxUrl}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm" onclick={() => lightboxUrl = ''}>
    <img src={lightboxUrl} alt="Produktbild" class="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl" />
  </div>
{/if}
