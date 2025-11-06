// Custom MT5-compatible Datafeed (uses the TradingView Library)
class CustomDatafeed {
    constructor(apiBaseUrl = '/apis') {
        this.apiUrl = apiBaseUrl;
        this.subscribers = {};
        this.lastBars = {};
        this.aggregators = {};
    }

    onReady(cb) {
        setTimeout(() => cb({
            supported_resolutions: ['1','3','5','15','30','60','120','240','360','480','D','W','M'],
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true,
            supports_search: true,
            supports_group_request: false,
        }), 0);
    }

    searchSymbols(userInput, exchange, symbolType, onResult) {
        const symbols = [
            { symbol: 'BTCUSD', full_name: 'BTCUSD', description: 'Bitcoin vs US Dollar', exchange: 'MT5', type: 'crypto' },
            { symbol: 'ETHUSD', full_name: 'ETHUSD', description: 'Ethereum vs US Dollar', exchange: 'MT5', type: 'crypto' },
            { symbol: 'XAUUSD', full_name: 'XAUUSD', description: 'Gold vs US Dollar', exchange: 'MT5', type: 'commodity' },
            { symbol: 'EURUSD', full_name: 'EURUSD', description: 'Euro vs US Dollar', exchange: 'MT5', type: 'forex' },
        ];
        const q = (userInput || '').toLowerCase();
        onResult(symbols.filter(s => s.symbol.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)));
    }

    resolveSymbol(symbolName, onResolve) {
        let symbolType = 'crypto';
        let pricescale = 100;
        if (/USD|EUR|GBP|JPY/.test(symbolName)) pricescale = 10000;
        const info = {
            ticker: symbolName,
            name: symbolName,
            description: symbolName,
            type: symbolType,
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'MT5',
            minmov: 1,
            pricescale,
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: true,
            supported_resolutions: ['1','3','5','15','30','60','120','240','360','480','D','W','M'],
            volume_precision: 2,
            data_status: 'streaming',
        };
        setTimeout(() => onResolve(info), 0);
    }

    getTimeframe(res) {
        const m = {
            '1':'1','3':'3','5':'5','15':'15','30':'30','60':'60','120':'120','240':'240','360':'360','480':'480','D':'1440','W':'10080','M':'43200'
        };
        return m[res] || '1';
    }

    async getBars(symbolInfo, resolution, periodParams, onResult, onError) {
        const { from, to, firstDataRequest } = periodParams;
        const timeframe = this.getTimeframe(resolution);
        const count = firstDataRequest ? 100 : 500;
        try {
            const resp = await fetch(`${this.apiUrl}/chart/candle/history/${symbolInfo.name}?timeframe=${timeframe}&count=${count}`, { cache:'no-cache' });
            if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
            const data = await resp.json();
            if (!Array.isArray(data) || data.length === 0) return onResult([], { noData: true });
            const tfMs = parseInt(timeframe) * 60 * 1000;
            let bars = data.map(c => ({
                time: Math.floor(new Date(c.time).getTime() / tfMs) * tfMs,
                open: +c.open, high: +c.high, low: +c.low, close: +c.close, volume: +(c.volume || 0)
            })).filter(b => Number.isFinite(b.time) && Number.isFinite(b.close)).sort((a,b)=>a.time-b.time);

            let finalBars;
            if (firstDataRequest) {
                finalBars = bars.slice(-Math.min(100, bars.length));
            } else {
                const filtered = bars.filter(b => b.time >= from*1000 && b.time <= to*1000);
                finalBars = filtered.length ? filtered : bars.slice(-Math.min(100,bars.length));
            }

            // If TF > 1 and history appears stale, aggregate from 1m as fallback
            const tfInt = parseInt(timeframe);
            const newest = finalBars[finalBars.length-1]?.time || 0;
            const needAgg = Number.isFinite(tfInt) && tfInt>1 && (Date.now()-newest > tfInt*60*1000*2);
            if (needAgg) {
                const need1m = Math.min(tfInt*105, 6000);
                const oneRes = await fetch(`${this.apiUrl}/chart/candle/history/${symbolInfo.name}?timeframe=1&count=${need1m}`, { cache:'no-cache' });
                if (oneRes.ok) {
                    const one = await oneRes.json();
                    const oneBars = one.map(c=>({
                        time: Math.floor(new Date(c.time).getTime() / (60*1000)) * 60*1000,
                        open:+c.open, high:+c.high, low:+c.low, close:+c.close, volume:+(c.volume||0)
                    })).filter(b=>Number.isFinite(b.time)&&Number.isFinite(b.close)).sort((a,b)=>a.time-b.time);
                    const bucketMs = tfInt*60*1000; const map=new Map();
                    for (const b of oneBars){
                        const t=Math.floor(b.time/bucketMs)*bucketMs; const a=map.get(t);
                        if(!a) map.set(t,{...b,time:t}); else {a.high=Math.max(a.high,b.high);a.low=Math.min(a.low,b.low);a.close=b.close;a.volume=(a.volume||0)+(b.volume||0);} }
                    finalBars = Array.from(map.values()).sort((a,b)=>a.time-b.time).slice(-Math.min(100, map.size));
                }
            }

            return onResult(finalBars, { noData: finalBars.length===0 });
        } catch(e){
            console.error('[CustomDatafeed]: getBars error', e);
            onError(e.message);
        }
    }

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback) {
        const timeframe = this.getTimeframe(resolution);
        const tfInt = parseInt(timeframe);
        const bucketMs = tfInt*60*1000;
        if (tfInt === 1) {
            const poll = async () => {
                try {
                    const r = await fetch(`${this.apiUrl}/chart/candle/current/${symbolInfo.name}?timeframe=1`,{cache:'no-cache'});
                    if(!r.ok) return; const c=await r.json();
                    const t = Math.floor(new Date(c.time).getTime()/(60*1000))*60*1000;
                    const bar={ time:t, open:+(c.open??c.close), high:+(c.high??c.close), low:+(c.low??c.close), close:+c.close, volume:+(c.volume||0) };
                    const last=this.lastBars[listenerGuid];
                    if(!last || bar.time>last.time){ this.lastBars[listenerGuid]=bar; onTick(bar); return; }
                    const merged={...last};
                    merged.high=Math.max(merged.high, bar.high, bar.close);
                    merged.low=Math.min(merged.low, bar.low, bar.close);
                    merged.close=bar.close; merged.volume=Math.max(bar.volume, merged.volume||0);
                    this.lastBars[listenerGuid]=merged; onTick(merged);
                }catch(e){ console.error('[CustomDatafeed]: rt(1m) error',e.message);} };
            poll(); this.subscribers[listenerGuid]=setInterval(poll,1000); return;
        }

        // Aggregate from 1m for TF>1
        this.aggregators[listenerGuid]=this.aggregators[listenerGuid]||null;
        const pollAgg = async () => {
            try {
                const r=await fetch(`${this.apiUrl}/chart/candle/current/${symbolInfo.name}?timeframe=1`,{cache:'no-cache'});
                if(!r.ok) return; const c=await r.json();
                const oneTime=Math.floor(new Date(c.time).getTime()/(60*1000))*60*1000;
                const bucketTime=Math.floor(oneTime/bucketMs)*bucketMs;
                const oneBar={ time:oneTime, open:+(c.open??c.close), high:+(c.high??c.close), low:+(c.low??c.close), close:+c.close, volume:+(c.volume||0) };
                let agg=this.aggregators[listenerGuid];
                if(!agg || bucketTime>agg.time){
                    agg={ time:bucketTime, open:oneBar.open, high:oneBar.high, low:oneBar.low, close:oneBar.close, volume:oneBar.volume, _sumPrev:0, _currMinTime:oneBar.time, _prevMinVol:oneBar.volume };
                    this.aggregators[listenerGuid]=agg;
                    if (typeof onResetCacheNeededCallback==='function'){ try{ onResetCacheNeededCallback(); }catch{} }
                    this.lastBars[listenerGuid]={...agg}; onTick({...agg}); return;
                }
                // extend
                agg.high=Math.max(agg.high, oneBar.high, oneBar.close);
                agg.low=Math.min(agg.low, oneBar.low, oneBar.close);
                agg.close=oneBar.close;
                if(agg._currMinTime===oneBar.time){ agg._prevMinVol=oneBar.volume; } else { agg._sumPrev+=agg._prevMinVol; agg._currMinTime=oneBar.time; agg._prevMinVol=oneBar.volume; }
                agg.volume=agg._sumPrev+agg._prevMinVol;
                this.lastBars[listenerGuid]={...agg}; onTick({...agg});
            }catch(e){ console.error('[CustomDatafeed]: rt(agg) error',e.message); }
        };
        pollAgg(); this.subscribers[listenerGuid]=setInterval(pollAgg,1000);
    }

    unsubscribeBars(id){ if(this.subscribers[id]){ clearInterval(this.subscribers[id]); delete this.subscribers[id]; } delete this.lastBars[id]; delete this.aggregators[id]; }

    getServerTime(cb){
        fetch(`${this.apiUrl}/time`).then(r=>r.json()).then(d=>cb(Math.floor(new Date(d.serverTime).getTime()/1000))).catch(()=>cb(Math.floor(Date.now()/1000)));
    }
}

// Export for browser usage
if (typeof window !== 'undefined') {
    window.CustomDatafeed = CustomDatafeed;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) { 
    module.exports = CustomDatafeed; 
}