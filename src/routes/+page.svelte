<script>
  import { onMount, tick } from 'svelte';
  import { getImageUrl, formatEUR, formatNum } from '$lib/utils';
  import { loadViews, saveView, deleteView } from '$lib/savedViews';

  let allData = $state([]);
  let loading = $state(true);

  // Dynamic imports
  let PivotTableUI = $state(null);
  let TableRenderers = $state(null);

  // Pivot state
  let rows = $state(['Kollektion']);
  let cols = $state(['Monat']);
  let vals = $state(['Umsatz']);
  let aggregatorName = $state('Sum');
  let rendererName = $state('Table');
  let valueFilter = $state({});

  // Sort by value
  let sortByValue = $state(false);
  let sortDirection = $state('desc');

  // Show collection images
  let showCollectionImages = $state(false);

  // Saved views
  let savedList = $state([]);
  let saveName = $state('');
  let showSaveInput = $state(false);

  // Image browser
  let showImageBrowser = $state(false);
  let imageSearchTerm = $state('');
  let lightboxUrl = $state('');

  // Pivot render key to force re-render
  let pivotKey = $state(0);

  // KPIs
  let totalUmsatz = $derived(allData.reduce((s, r) => s + (r.Umsatz || 0), 0));
  let totalStueck = $derived(allData.reduce((s, r) => s + (r.Anzahl || 0), 0));
  let uniqueKollektionen = $derived(new Set(allData.map(r => r.Kollektion)).size);
  let uniqueKassen = $derived(new Set(allData.map(r => r.Kasse)).size);

  // Sorted data for pivot
  let pivotData = $derived.by(() => {
    if (!sortByValue || !allData.length) return allData;
    // Compute row totals for sorting
    const valField = vals[0] || 'Umsatz';
    const rowField = rows[0];
    if (!rowField) return allData;

    const totals = new Map();
    for (const r of allData) {
      const key = r[rowField] || '';
      totals.set(key, (totals.get(key) || 0) + (Number(r[valField]) || 0));
    }

    const sorted = [...allData].sort((a, b) => {
      const va = totals.get(a[rowField] || '') || 0;
      const vb = totals.get(b[rowField] || '') || 0;
      return sortDirection === 'desc' ? vb - va : va - vb;
    });
    return sorted;
  });

  // Image groups for collection images and browser
  let collectionImageMap = $derived.by(() => {
    const map = new Map();
    for (const r of allData) {
      const key = r.Kollektion;
      if (!map.has(key)) map.set(key, new Set());
      if (r.BildId) map.get(key).add(r.BildId);
    }
    return map;
  });

  // Image browser data
  let imageGroups = $derived.by(() => {
    if (!showImageBrowser) return [];
    const term = imageSearchTerm.toLowerCase();
    const map = new Map();
    for (const r of allData) {
      if (term && !r.Kollektion.toLowerCase().includes(term) && !(r.SubKollektion || '').toLowerCase().includes(term)) continue;
      const key = r.Kollektion;
      if (!map.has(key)) map.set(key, { name: key, images: new Set(), count: 0, umsatz: 0 });
      const g = map.get(key);
      if (r.BildId) g.images.add(r.BildId);
      g.count += r.Anzahl;
      g.umsatz += r.Umsatz;
    }
    return Array.from(map.values())
      .map(g => ({ ...g, images: Array.from(g.images).slice(0, 12) }))
      .sort((a, b) => b.umsatz - a.umsatz);
  });

  onMount(async () => {
    const res = await fetch('/data.json');
    allData = await res.json();
    loading = false;

    const pivotMod = await import('svelte-pivottable/PivotTableUI.svelte');
    PivotTableUI = pivotMod.default;
    const renderersMod = await import('svelte-pivottable/TableRenderers');
    TableRenderers = renderersMod.default;

    savedList = loadViews();
  });

  function removeFromRows(attr) {
    rows = rows.filter(r => r !== attr);
    pivotKey++;
  }

  function removeFromCols(attr) {
    cols = cols.filter(c => c !== attr);
    pivotKey++;
  }

  function doSave() {
    if (!saveName.trim()) return;
    saveView(saveName.trim(), { rows, cols, vals, aggregatorName, rendererName, valueFilter, sortByValue, sortDirection, showCollectionImages });
    savedList = loadViews();
    saveName = '';
    showSaveInput = false;
  }

  function doLoad(view) {
    const s = view.state;
    rows = s.rows || [];
    cols = s.cols || [];
    vals = s.vals || ['Umsatz'];
    aggregatorName = s.aggregatorName || 'Sum';
    rendererName = s.rendererName || 'Table';
    valueFilter = s.valueFilter || {};
    sortByValue = s.sortByValue || false;
    sortDirection = s.sortDirection || 'desc';
    showCollectionImages = s.showCollectionImages || false;
    showImageBrowser = false;
    pivotKey++;
  }

  function doDelete(id) {
    deleteView(id);
    savedList = loadViews();
  }

  // Inject collection images into the pivot table DOM after render
  function injectCollectionImages() {
    if (!showCollectionImages) return;
    tick().then(() => {
      setTimeout(() => {
        const cells = document.querySelectorAll('.pvtRowLabel, .pvtAxisLabel');
        cells.forEach(cell => {
          if (cell.querySelector('.kp-img')) return;
          const text = cell.textContent?.trim();
          if (!text || !collectionImageMap.has(text)) return;
          const images = collectionImageMap.get(text);
          if (!images || images.size === 0) return;
          const firstImg = Array.from(images)[0];
          const img = document.createElement('img');
          img.src = getImageUrl(firstImg, 60);
          img.className = 'kp-img';
          img.style.cssText = 'width:24px;height:24px;object-fit:cover;border-radius:4px;margin-right:6px;vertical-align:middle;display:inline-block;cursor:pointer;';
          img.onerror = () => { img.style.display = 'none'; };
          img.onclick = (e) => {
            e.stopPropagation();
            lightboxUrl = getImageUrl(firstImg, 1000);
          };
          cell.prepend(img);
        });
      }, 200);
    });
  }

  // Re-inject images when pivot changes
  $effect(() => {
    if (showCollectionImages && allData.length && PivotTableUI) {
      // Track dependencies
      void pivotKey;
      void rows;
      void cols;
      void vals;
      void aggregatorName;
      injectCollectionImages();
    }
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
  <!-- Header -->
  <header class="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-40">
    <div class="max-w-[1920px] mx-auto px-6 py-3.5 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200/50">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-gray-900 tracking-tight">Shop Analyzer 2026</h1>
          <p class="text-xs text-gray-400">{allData.length.toLocaleString('de-DE')} Datensätze</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Sort by Value -->
        <div class="flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded-xl">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" bind:checked={sortByValue} class="rounded text-indigo-600 w-3.5 h-3.5" />
            <span class="text-xs font-medium text-gray-600">Sort by Value</span>
          </label>
          {#if sortByValue}
            <button
              onclick={() => { sortDirection = sortDirection === 'desc' ? 'asc' : 'desc'; pivotKey++; }}
              class="text-xs text-indigo-600 font-bold hover:text-indigo-800 ml-1"
            >
              {sortDirection === 'desc' ? '↓' : '↑'}
            </button>
          {/if}
        </div>

        <!-- Show Images Toggle -->
        <button
          onclick={() => { showCollectionImages = !showCollectionImages; if(showCollectionImages) injectCollectionImages(); else { pivotKey++; } }}
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all
            {showCollectionImages ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          Bilder
        </button>

        <!-- Image Browser Toggle -->
        <button
          onclick={() => showImageBrowser = !showImageBrowser}
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all
            {showImageBrowser ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          Galerie
        </button>

        <!-- Saved Views Dropdown -->
        <div class="relative group">
          <button class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            Analysen ({savedList.length})
          </button>
          <div class="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div class="flex items-center gap-2 mb-3">
              {#if showSaveInput}
                <input type="text" bind:value={saveName} placeholder="Name..." class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" onkeydown={(e) => { if (e.key === 'Enter') doSave(); }} />
                <button onclick={doSave} class="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">OK</button>
                <button onclick={() => showSaveInput = false} class="text-gray-400 text-xs hover:text-gray-600">✕</button>
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
    <div class="max-w-[1920px] mx-auto px-6 pt-5 pb-3">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white rounded-2xl p-4 border border-gray-100/80 shadow-sm">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Umsatz Gesamt</p>
          <p class="text-xl font-bold text-gray-900 mt-1 tabular-nums">{formatEUR(totalUmsatz)}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 border border-gray-100/80 shadow-sm">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Verkaufte Stück</p>
          <p class="text-xl font-bold text-gray-900 mt-1 tabular-nums">{formatNum(totalStueck)}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 border border-gray-100/80 shadow-sm">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Kollektionen</p>
          <p class="text-xl font-bold text-gray-900 mt-1">{uniqueKollektionen}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 border border-gray-100/80 shadow-sm">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Filialen</p>
          <p class="text-xl font-bold text-gray-900 mt-1">{uniqueKassen}</p>
        </div>
      </div>
    </div>

    <!-- Active Row/Col chips with X buttons -->
    {#if rows.length > 0 || cols.length > 0}
      <div class="max-w-[1920px] mx-auto px-6 pb-3">
        <div class="flex flex-wrap items-center gap-2">
          {#if rows.length > 0}
            <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mr-1">Zeilen:</span>
            {#each rows as attr}
              <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                {attr}
                <button onclick={() => removeFromRows(attr)} class="ml-0.5 w-4 h-4 rounded-full hover:bg-blue-200 flex items-center justify-center text-blue-500 hover:text-blue-800 transition-colors">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            {/each}
          {/if}
          {#if cols.length > 0}
            <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mr-1 {rows.length > 0 ? 'ml-4' : ''}">Spalten:</span>
            {#each cols as attr}
              <span class="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                {attr}
                <button onclick={() => removeFromCols(attr)} class="ml-0.5 w-4 h-4 rounded-full hover:bg-green-200 flex items-center justify-center text-green-500 hover:text-green-800 transition-colors">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            {/each}
          {/if}
        </div>
      </div>
    {/if}

    {#if showImageBrowser}
      <!-- Image Browser -->
      <div class="max-w-[1920px] mx-auto px-6 pb-8">
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div class="flex items-center gap-4 mb-6">
            <h2 class="text-lg font-bold text-gray-900">Kollektionen & Produktbilder</h2>
            <div class="relative flex-1 max-w-sm">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" bind:value={imageSearchTerm} placeholder="Kollektion suchen..." class="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
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
                    <img src={getImageUrl(bid, 120)} alt="" class="w-14 h-14 object-cover rounded-lg cursor-pointer hover:scale-110 transition-transform shadow-sm" loading="lazy" onclick={() => lightboxUrl = getImageUrl(bid, 1000)} onerror={(e) => { e.currentTarget.style.display='none'; }} />
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
            {#key pivotKey}
              <svelte:component
                this={PivotTableUI}
                data={pivotData}
                renderers={TableRenderers}
                bind:rows
                bind:cols
                bind:vals
                bind:aggregatorName
                bind:rendererName
                bind:valueFilter
              />
            {/key}
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

<style>
  :global(.kp-img) {
    transition: transform 0.15s ease;
  }
  :global(.kp-img:hover) {
    transform: scale(1.3);
  }
</style>
