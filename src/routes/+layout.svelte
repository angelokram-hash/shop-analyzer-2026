<script>
  import '../app.css';
  let { children } = $props();

  const CORRECT_HASH = '59eaa90ff91e496ef703dcae417ea69b3014b210d692b97245e41c73ecb1d204';
  let authenticated = $state(false);
  let password = $state('');
  let error = $state(false);
  let checking = $state(false);

  if (typeof window !== 'undefined') {
    authenticated = sessionStorage.getItem('shop-auth') === 'ok';
  }

  async function hashPassword(pw) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(pw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function handleLogin() {
    checking = true;
    error = false;
    const hash = await hashPassword(password);
    if (hash === CORRECT_HASH) {
      sessionStorage.setItem('shop-auth', 'ok');
      authenticated = true;
    } else {
      error = true;
      password = '';
    }
    checking = false;
  }

  function onKey(e) {
    if (e.key === 'Enter') handleLogin();
  }
</script>

{#if authenticated}
  {@render children()}
{:else}
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 flex items-center justify-center">
    <div class="w-full max-w-sm">
      <div class="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-gray-100 p-8">
        <div class="flex justify-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
        </div>
        <h1 class="text-xl font-bold text-gray-900 text-center mb-1">Shop Analyzer 2026</h1>
        <p class="text-sm text-gray-400 text-center mb-8">Bitte Passwort eingeben</p>
        <div class="space-y-4">
          <div>
            <input
              type="password"
              bind:value={password}
              onkeydown={onKey}
              placeholder="Passwort"
              class="w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all
                {error ? 'border-red-300 focus:ring-red-200 bg-red-50/50' : 'border-gray-200 focus:ring-indigo-200 focus:border-indigo-300'}"
              autofocus
            />
            {#if error}
              <p class="text-xs text-red-500 mt-2 pl-1">Falsches Passwort.</p>
            {/if}
          </div>
          <button
            onclick={handleLogin}
            disabled={checking || !password}
            class="w-full px-4 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if checking}
              <span class="flex items-center justify-center gap-2">
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Prüfe...
              </span>
            {:else}
              Anmelden
            {/if}
          </button>
        </div>
      </div>
      <p class="text-xs text-gray-300 text-center mt-6">Zugang nur für autorisierte Nutzer</p>
    </div>
  </div>
{/if}
