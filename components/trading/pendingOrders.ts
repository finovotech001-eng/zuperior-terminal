// Client helpers for pending orders via server routes

export async function placeBuyLimit(order: { accountId: string | number, symbol: string, price: number, volume: number, stopLoss?: number, takeProfit?: number, comment?: string }) {
  const res = await fetch('/apis/trading/pending/buy-limit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
  const text = await res.text().catch(() => '')
  let data: any = null; try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(typeof data === 'object' ? (data?.message || data?.error || `HTTP ${res.status}`) : `HTTP ${res.status}`)
  return data
}

export async function placeSellLimit(order: { accountId: string | number, symbol: string, price: number, volume: number, stopLoss?: number, takeProfit?: number, comment?: string }) {
  const res = await fetch('/apis/trading/pending/sell-limit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
  const text = await res.text().catch(() => '')
  let data: any = null; try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(typeof data === 'object' ? (data?.message || data?.error || `HTTP ${res.status}`) : `HTTP ${res.status}`)
  return data
}

export async function cancelPendingOrder(params: { accountId: string | number, orderId: number, comment?: string }) {
  const res = await fetch(`/apis/trading/pending/order/${params.orderId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: params.accountId, comment: params.comment }),
  })
  const text = await res.text().catch(() => '')
  let data: any = null; try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(typeof data === 'object' ? (data?.message || data?.error || `HTTP ${res.status}`) : `HTTP ${res.status}`)
  return data
}

