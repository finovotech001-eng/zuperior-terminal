// Client helper to place market orders via server route
export async function placeMarketOrder(orderData: {
  symbol: string;
  side: 'buy' | 'sell';
  volume: number; // lots
  orderType: 'market' | 'limit' | 'pending';
  openPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  accountId: string | number;
  price?: number;
}) {
  const payload = {
    side: orderData.side,
    accountId: orderData.accountId,
    symbol: orderData.symbol,
    volume: orderData.volume,
    price: orderData.price || orderData.openPrice || 0,
    stopLoss: orderData.stopLoss,
    takeProfit: orderData.takeProfit,
    comment: 'Placed via web terminal',
  }
  const res = await fetch('/apis/trading/place', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await res.text().catch(() => '')
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(typeof data === 'object' ? (data?.message || data?.error || `HTTP ${res.status}`) : `HTTP ${res.status}`)
  // Attach normalized lot fields for convenience in UI (non-breaking)
  try {
    if (data && typeof data === 'object') {
      const vol = Number(data?.Volume ?? data?.volume)
      const bodyVol = Number(data?.debug?.body?.volume)
      const chosen = Number.isFinite(vol) && vol > 0 ? vol : (Number.isFinite(bodyVol) ? bodyVol : NaN)
      if (Number.isFinite(chosen)) {
        const lots = chosen / 100
        ;(data as any).volumeLots = lots
        ;(data as any).VolumeLots = lots
      }
    }
  } catch {}
  return data
}
