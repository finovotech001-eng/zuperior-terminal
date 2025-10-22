// app/apis/trading/placeOrder.ts
export async function placeMarketOrder(orderData: {
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  orderType: "market" | "limit" | "pending";
  openPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  accountId: string | number;
  price?: number;
}) {
  try {
    // 1️⃣ Fetch the token (adjust key if your login stores it differently)
//     const token = localStorage.getItem("authToken");
    localStorage.setItem('authToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJjbGllbnRfNjM4OTYzMTIwMjkxNjI2MTUxXzQ1ODciLCJhY2NvdW50X2lkIjoiNzk0Nzk1IiwiZW1haWwiOiIiLCJ1bmlxdWVfbmFtZSI6Ik1UNSBBY2NvdW50IDc5NDc5NSIsInJvbGUiOiJDbGllbnQiLCJ0b2tlbl90eXBlIjoiY2xpZW50IiwibmJmIjoxNzYwODE3MDY0LCJleHAiOjE3NjY4MTcwNjQsImlhdCI6MTc2MDgxNzA2NCwiaXNzIjoiTVQ1TWFuYWdlckFQSSIsImF1ZCI6Ik1UNU1hbmFnZXJBUElVc2VycyJ9.nPvM8gV7vlmbUW6SuoSDahXR8sXfzmucrdVAnBOIcIk');
    const token = localStorage.getItem("authToken"); // <-- Looking for 'authToken'
    if (!token) throw new Error("User token not found — please log in again.");
    if (!token) throw new Error("User token not found — please log in again.");

    // 2️⃣ Convert side → uppercase orderType for your backend
    const orderType = orderData.side === "buy" ? "BUY" : "SELL";

    // 3️⃣ Build final payload for route.ts
    const payload = {
      orderType,
      accountId: orderData.accountId,
      symbol: orderData.symbol,
      volume: orderData.volume,
      price: orderData.price || orderData.openPrice || 0,
      stopLoss: orderData.stopLoss,
      takeProfit: orderData.takeProfit,
      comment: "Placed via web terminal",
    };

    console.log("📤 Sending to /api/trading:", payload);

    // 4️⃣ Make request
    const res = await fetch("/api/trading", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // ✅ matches route.ts expectation
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(result.Message || `HTTP ${res.status}`);
    return result;
  } catch (err) {
    console.error("❌ placeMarketOrder error:", err);
    throw err;
  }
}
