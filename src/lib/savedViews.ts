const KEY = 'shop-analyzer-saved-v2';

export interface SavedView {
  id: string;
  name: string;
  timestamp: number;
  state: Record<string, any>;
}

export function loadViews(): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch { return []; }
}

export function saveView(name: string, state: Record<string, any>): SavedView {
  const views = loadViews();
  const entry: SavedView = { id: crypto.randomUUID(), name, timestamp: Date.now(), state };
  views.push(entry);
  localStorage.setItem(KEY, JSON.stringify(views));
  return entry;
}

export function deleteView(id: string) {
  const views = loadViews().filter(v => v.id !== id);
  localStorage.setItem(KEY, JSON.stringify(views));
}
