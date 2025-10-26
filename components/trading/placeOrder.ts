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
  return data
}

