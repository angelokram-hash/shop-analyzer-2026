export function getImageUrl(bildId: string | number, size = 200): string {
  const id = typeof bildId === 'number' ? Math.round(bildId) : bildId;
  return `https://konplott-cdn.com/mytism/image/${id}/${id}.jpg?width=${size}&height=${size}&box=true`;
}

export function formatEUR(v: number): string {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}
