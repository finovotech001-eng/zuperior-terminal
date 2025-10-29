"use client"

import * as React from "react"
import { useMemo } from "react"
import { useAtom } from "jotai"
import { motion, AnimatePresence } from "framer-motion"
import { placeMarketOrder } from "@/components/trading/placeOrder";
import { cn, formatCurrency } from "@/lib/utils"
import Image from "next/image"
import brandLogo from "@/public/logo.png"
import { 
  ListIcon, 
  Calendar, 
  Settings, 
  Bell, 
  User, 
  LogOut, 
  LifeBuoy, 
  Lightbulb,
  ChevronDown,
  Clock,
  Plus,
  Info
} from "lucide-react"
import { Sidebar, SidebarItem } from "@/components/navigation/sidebar"
import { InstrumentTabs, InstrumentTab } from "@/components/navigation/instrument-tabs"
import { InstrumentList, Instrument } from "@/components/trading/instrument-list"
import { EconomicCalendar, EventsByDate } from "@/components/trading/economic-calendar"
import { ChartContainer } from "@/components/chart/chart-container"
import { PositionsTable, Position } from "@/components/trading/positions-table"
import { OrderPanel, OrderData } from "@/components/trading/order-panel"
import { SettingsPanel } from "@/components/trading/settings-panel"
import { WebSocketStatus } from "@/components/data-display/websocket-status"
import { placeBuyLimit, placeSellLimit, cancelPendingOrder } from "@/components/trading/pendingOrders"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconButton } from "@/components/ui/icon-button"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { useWebSocketConnection } from "@/hooks/useWebSocket"
import { usePositionsSignalR } from "@/hooks/usePositionsSSE"
import { useTradeHistory } from "@/hooks/useTradeHistory"
import { 
  instrumentsAtom, 
  positionsIsCollapsedAtom,
  positionsActiveTabAtom,
  openTabsAtom,
  activeTabIdAtom,
  addTabAtom,
  removeTabAtom
} from "@/lib/store"

type LeftPanelView = "instruments" | "calendar" | "settings" | null

interface MT5Account {
  id: string
  accountId: string
  name: string
  displayAccountId: string
  equity: number
  accountType: string // 'Demo' | 'Live'
  linkedAt: string
}


const LOCAL_STORAGE_KEY = 'zuperior_instruments_cache';
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache life
const INITIAL_CHUNK_LIMIT = 100;
const BACKGROUND_CHUNK_SIZE = 500;



// ðŸš€ UPDATED TYPE DEFINITION for Account Balance
interface BalanceData {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  profit:number;
  leverage: string;
  totalPL: number; // This is calculated field (Equity - Balance)
  accountType: 'Demo' | 'Live';
  name: string;
  accountGroup: string;
}

// ðŸš€ INITIAL STATE & MOCK DATA (Retained for fallback)
const initialBalanceData: BalanceData = {
  balance: 0,
  equity: 0,
  margin: 0,
  freeMargin: 0,
  marginLevel: 0,
  profit:0,
  leverage: "1:200",
  totalPL: 0,
  accountType: 'Demo',
  name: 'Test Account',
  accountGroup: 'Standard',
}

// Mock polling hook (Retained for fallback/testing)
function useMockBalancePolling(initialData: BalanceData): BalanceData {
    // ... (Your existing useMockBalancePolling implementation)
    // ... (This function remains unchanged)
    const [data, setData] = React.useState<BalanceData>({
        ...initialData,
        balance: 13327.80,
        equity: 15711.90,
        margin: 2181.20,
        freeMargin: 13530.70,
        marginLevel: 720.33,
        totalPL: 2384.10,
        accountType: 'Demo'
      });

      React.useEffect(() => {
        const interval = setInterval(() => {
          setData(currentData => {
            const fluctuation = (Math.random() - 0.5) * 50;
            const newTotalPL = currentData.totalPL + fluctuation;
            const newEquity = currentData.balance + newTotalPL;
            const newFreeMargin = newEquity - currentData.margin;
            const newMarginLevel = currentData.margin > 0 ? (newEquity / currentData.margin) * 100 : 0;

            return {
              ...currentData,
              totalPL: parseFloat(newTotalPL.toFixed(2)),
              equity: parseFloat(newEquity.toFixed(2)),
              freeMargin: parseFloat(newFreeMargin.toFixed(2)),
              marginLevel: parseFloat(newMarginLevel.toFixed(2)),
            };
          });
        }, 3000);

        return () => clearInterval(interval);
      }, []);

      return data;
}



// Hook for multiple account balance polling
function useMultiAccountBalancePolling(accountIds: string[]): { balances: Record<string, BalanceData>, isLoading: Record<string, boolean>, errors: Record<string, string | null> } {
  const [balances, setBalances] = React.useState<Record<string, BalanceData>>({});
  const [isLoading, setIsLoading] = React.useState<Record<string, boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});

  // Initialize state for all accounts - only when accountIds change
  React.useEffect(() => {
    if (accountIds.length === 0) return;

    setBalances(prevBalances => {
      const newBalances = { ...prevBalances };
      accountIds.forEach(accountId => {
        if (!newBalances[accountId]) {
          newBalances[accountId] = initialBalanceData;
        }
      });
      return newBalances;
    });

    setIsLoading(prevLoading => {
      const newLoading = { ...prevLoading };
      accountIds.forEach(accountId => {
        if (!newLoading.hasOwnProperty(accountId)) {
          newLoading[accountId] = true;
        }
      });
      return newLoading;
    });

    setErrors(prevErrors => {
      const newErrors = { ...prevErrors };
      accountIds.forEach(accountId => {
        if (!newErrors.hasOwnProperty(accountId)) {
          newErrors[accountId] = null;
        }
      });
      return newErrors;
    });
  }, [accountIds]);

  // Fetch balance for a specific account using getClientProfile API (NOT getBalance)
  // This endpoint provides comprehensive account data including Balance, Equity, Margin, etc.
  const fetchAccountBalance = React.useCallback(async (accountId: string, _isInitial = false) => {
    const API_PATH = `/apis/user/${accountId}/getClientProfile`;

    try {
      const response = await fetch(API_PATH, { cache: 'no-store' });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: `HTTP status ${response.status}` }));
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Debug: Log the raw response (log every 10th call to avoid spam, or on initial)
      const shouldLog = _isInitial || Math.random() < 0.1;
      if (shouldLog) {
        console.log('[Balance][getClientProfile] Raw API response:', {
          success: result.success,
          hasData: !!(result.data || result.Data),
          hasResult: !!result,
          keys: Object.keys(result),
          dataType: typeof result.data,
          dataSample: result.data ? Object.keys(result.data).slice(0, 5) : 'no data',
          fullResponse: JSON.stringify(result).substring(0, 500)
        });
      }

      // Check if response has data - might be nested in Data or data property
      const responseData = result.data || result.Data || result;
      
      if (shouldLog && responseData) {
        console.log('[Balance][getClientProfile] Response data keys:', Object.keys(responseData));
      }
      
      if (result.success && responseData) {
        const apiData = responseData as {
          Balance?: number;
          balance?: number;
          Equity?: number;
          equity?: number;
          Margin?: number;
          MarginUsed?: number;
          marginUsed?: number;
          FreeMargin?: number;
          freeMargin?: number;
          MarginLevel?: number;
          marginLevel?: number;
          profit?: number;
          Profit?: number;
          Leverage?: string;
          leverage?: string;
          Name?: string;
          name?: string;
          Group?: string;
          group?: string;
          AccountType?: string;
          accountType?: string;
        };

        // Extract balance values - try multiple possible field names and ensure they're numbers
        const balance = Number(apiData.Balance ?? apiData.balance ?? 0) || 0;
        const equity = Number(apiData.Equity ?? apiData.equity ?? 0) || 0;
        const margin = Number(apiData.Margin ?? apiData.MarginUsed ?? apiData.marginUsed ?? apiData.margin ?? 0) || 0;
        const freeMargin = Number(apiData.FreeMargin ?? apiData.freeMargin ?? 0) || 0;
        const totalPL = equity - balance;
        const profit = Number(apiData.Profit ?? apiData.profit ?? totalPL) || totalPL;
        
        // Debug: Log extracted values periodically
        const shouldLog = _isInitial || Math.random() < 0.1;
        if (shouldLog) {
          console.log('[Balance][getClientProfile] Extracted values:', {
            balance,
            equity,
            margin,
            freeMargin,
            totalPL,
            profit,
            rawValues: {
              Balance: apiData.Balance,
              balance: apiData.balance,
              Equity: apiData.Equity,
              equity: apiData.equity,
              Margin: apiData.Margin,
              MarginUsed: apiData.MarginUsed
            }
          });
        }

        // Extract accountGroup and determine accountType from Group field
        const groupValue = apiData.Group ?? apiData.group ?? '';
        const accountGroup = groupValue ? groupValue.split('\\').pop()?.toLowerCase() || 'standard' : 'standard';
        
        // Determine accountType from Group field - Priority: Group field (most reliable)
        // Common patterns: "Demo\\Standard", "DemoAccount", "LiveAccount", "Demo", "Live", etc.
        const groupLower = groupValue.toLowerCase();
        let finalAccountType: 'Demo' | 'Live' = 'Live'; // Default to Live
        
        // Check Group field first (primary source)
        if (groupLower.includes('demo')) {
          finalAccountType = 'Demo';
        } else if (groupLower.includes('live')) {
          finalAccountType = 'Live';
        } else {
          // If Group doesn't contain demo/live, check AccountType field
          const accountTypeFromField = (apiData.AccountType === 'Live' || apiData.accountType === 'Live') ? 'Live' : 'Demo';
          finalAccountType = accountTypeFromField;
        }

        const newBalanceData: BalanceData = {
          balance: balance,
          equity: equity,
          margin: margin,
          freeMargin: freeMargin,
          marginLevel: apiData.MarginLevel ?? apiData.marginLevel ?? 0,
          profit: profit,
          leverage: apiData.Leverage ?? apiData.leverage ?? "1:200",
          totalPL: parseFloat(totalPL.toFixed(2)),
          name: apiData.Name ?? apiData.name ?? 'Test',
          accountGroup: accountGroup,
          accountType: finalAccountType,
        };
        
        // Debug: Log accountType determination
        if (shouldLog || _isInitial) {
          console.log('[Balance][getClientProfile] AccountType determination:', {
            groupValue,
            accountGroup,
            finalAccountType,
            AccountType: apiData.AccountType,
            accountType: apiData.accountType,
            detectedFrom: groupLower.includes('demo') ? 'Group (Demo)' : 
                          groupLower.includes('live') ? 'Group (Live)' : 
                          'AccountType field'
          });
        }

        // Debug: Log extracted values
        if (_isInitial) {
          console.log('[Balance][getClientProfile] Extracted balance data:', {
            balance,
            equity,
            margin,
            freeMargin,
            totalPL,
            profit,
            apiDataKeys: Object.keys(apiData)
          });
        }

        // Always update state - create new object references to force re-render
        setBalances(prev => {
          const current = prev[accountId];
          // Check if values actually changed
          const hasChanged = !current || (
            current.balance !== balance ||
            current.equity !== equity ||
            current.margin !== margin ||
            current.freeMargin !== freeMargin ||
            current.totalPL !== newBalanceData.totalPL
          );
          
          if (hasChanged && current) {
            console.log('[Balance][getClientProfile] Balance updated:', {
              accountId,
              old: { balance: current.balance, equity: current.equity, margin: current.margin },
              new: { balance, equity, margin }
            });
          }
          
          // Always create a new object to ensure React detects the change
          return { ...prev, [accountId]: { ...newBalanceData } };
        });
        setErrors(prev => ({ ...prev, [accountId]: null }));
      } else {
        // Log the actual response structure if success is false
        console.warn('[Balance][getClientProfile] Response structure:', {
          success: result.success,
          hasData: !!(result.data || result.Data),
          keys: Object.keys(result),
          result: JSON.stringify(result).substring(0, 200)
        });
        throw new Error(result.error || result.message || "Failed to load account data.");
      }
    } catch (e) {
      const errorMessage = `Failed to fetch balance for ${accountId}: ${e instanceof Error ? e.message : 'Unknown error'}`;
      console.error(errorMessage);
      setErrors(prev => ({ ...prev, [accountId]: errorMessage }));
    } finally {
      setIsLoading(prev => ({ ...prev, [accountId]: false }));
    }
  }, []);

  // Set up polling for all accounts - separate effect to avoid dependency issues
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const accountIdsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    accountIdsRef.current = accountIds;
  }, [accountIds]);

  React.useEffect(() => {
    if (accountIds.length === 0) return;

    // Initial fetch for all accounts
    const initialFetchPromises = accountIds.map(accountId =>
      fetchAccountBalance(accountId, true)
    );

    // Wait for initial fetches to complete before starting polling
    Promise.all(initialFetchPromises).then(() => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set up polling interval for all accounts (every 300ms for real-time updates)
      intervalRef.current = setInterval(() => {
        accountIdsRef.current.forEach(accountId => {
          fetchAccountBalance(accountId, false);
        });
      }, 300);
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [accountIds, fetchAccountBalance]); // Include missing dependencies

  // Expose refresh function to manually trigger balance updates
  const refreshBalance = React.useCallback((accountId: string) => {
    if (accountId && accountIdsRef.current.includes(accountId)) {
      fetchAccountBalance(accountId, false);
    }
  }, [fetchAccountBalance]);

  return { balances, isLoading, errors, refreshBalance };
}

// Helper function to format date from ISO string
function formatPositionTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
}
// Mock data for economic calendar
const mockCalendarEvents: EventsByDate[] = [
  {
    date: "2025-10-14",
    displayDate: "October 14",
    events: [
      {
        id: "1",
        time: "9:10 AM",
        country: "Italy",
        countryCode: "IT",
        title: "3-Year BTP Auction",
        impact: "low",
        actual: "2.4%",
        forecast: undefined,
        previous: "2.4%",
      },
      {
        id: "2",
        time: "9:10 AM",
        country: "Italy",
        countryCode: "IT",
        title: "7-Year BTP Auction",
        impact: "low",
        actual: "3.1%",
        forecast: undefined,
        previous: "2.8%",
      },
      {
        id: "3",
        time: "9:10 AM",
        country: "Italy",
        countryCode: "IT",
        title: "10-Year BTP Auction",
        impact: "medium",
        actual: "2.2%",
        forecast: undefined,
        previous: "3.6%",
      },
      {
        id: "4",
        time: "9:10 AM",
        country: "Italy",
        countryCode: "IT",
        title: "15-Year BTP Auction",
        impact: "low",
        actual: "3.9%",
        forecast: undefined,
        previous: "4%",
      },
      {
        id: "5",
        time: "9:30 AM",
        country: "Germany",
        countryCode: "DE",
        title: "Industrial Production MoM",
        impact: "medium",
        actual: undefined,
        forecast: "0.3%",
        previous: "1.1%",
      },
      {
        id: "6",
        time: "9:30 AM",
        country: "Germany",
        countryCode: "DE",
        title: "Industrial Production YoY",
        impact: "medium",
        actual: undefined,
        forecast: "-0.9%",
        previous: "-0.1%",
      },
      {
        id: "7",
        time: "9:30 AM",
        country: "Germany",
        countryCode: "DE",
        title: "2-Year Schatz Auction",
        impact: "low",
        actual: "1.9%",
        forecast: undefined,
        previous: "2%",
      },
      {
        id: "8",
        time: "9:30 AM",
        country: "Germany",
        countryCode: "DE",
        title: "Mining Production MoM",
        impact: "low",
        actual: "-1.2%",
        forecast: "0.6%",
        previous: "1.2%",
      },
      {
        id: "9",
        time: "9:30 AM",
        country: "Germany",
        countryCode: "DE",
        title: "Mining Production YoY",
        impact: "low",
        actual: "-0.2%",
        forecast: "1.8%",
        previous: "5.1%",
      },
    ],
  },
  {
    date: "2025-10-17",
    displayDate: "October 17",
    events: [
      {
        id: "10",
        time: "9:35 AM",
        country: "United Kingdom",
        countryCode: "GB",
        title: "BoE Pill Speech",
        impact: "medium",
        actual: undefined,
        forecast: undefined,
        previous: undefined,
      },
      {
        id: "11",
        time: "10:00 AM",
        country: "United States",
        countryCode: "US",
        title: "PPI YoY",
        impact: "high",
        actual: undefined,
        forecast: "-3.7%",
        previous: "-4.3%",
      },
      {
        id: "12",
        time: "10:00 AM",
        country: "United States",
        countryCode: "US",
        title: "PPI MoM",
        impact: "high",
        actual: undefined,
        forecast: "-0.4%",
        previous: "-0.6%",
      },
      {
        id: "13",
        time: "10:30 AM",
        country: "United States",
        countryCode: "US",
        title: "Construction Output YoY",
        impact: "medium",
        actual: undefined,
        forecast: "1.9%",
        previous: "1.3%",
      },
      {
        id: "14",
        time: "11:00 AM",
        country: "European Union",
        countryCode: "EU",
        title: "ECB Donnery Speech",
        impact: "medium",
        actual: undefined,
        forecast: undefined,
        previous: undefined,
      },
      {
        id: "15",
        time: "2:00 PM",
        country: "Canada",
        countryCode: "CA",
        title: "Manufacturing Sales MoM",
        impact: "medium",
        actual: undefined,
        forecast: "0.8%",
        previous: "1.2%",
      },
      {
        id: "16",
        time: "3:30 PM",
        country: "United States",
        countryCode: "US",
        title: "Crude Oil Inventories",
        impact: "high",
        actual: undefined,
        forecast: "-2.5M",
        previous: "-1.5M",
      },
    ],
  },
  {
    date: "2025-10-18",
    displayDate: "October 18",
    events: [
      {
        id: "17",
        time: "1:30 AM",
        country: "Australia",
        countryCode: "AU",
        title: "Employment Change",
        impact: "high",
        actual: undefined,
        forecast: "25.0K",
        previous: "47.5K",
      },
      {
        id: "18",
        time: "1:30 AM",
        country: "Australia",
        countryCode: "AU",
        title: "Unemployment Rate",
        impact: "high",
        actual: undefined,
        forecast: "4.2%",
        previous: "4.1%",
      },
      {
        id: "19",
        time: "5:00 AM",
        country: "France",
        countryCode: "FR",
        title: "CPI MoM",
        impact: "medium",
        actual: undefined,
        forecast: "0.2%",
        previous: "0.5%",
      },
      {
        id: "20",
        time: "5:00 AM",
        country: "France",
        countryCode: "FR",
        title: "CPI YoY",
        impact: "high",
        actual: undefined,
        forecast: "2.1%",
        previous: "1.8%",
      },
      {
        id: "21",
        time: "10:00 AM",
        country: "United States",
        countryCode: "US",
        title: "Retail Sales MoM",
        impact: "high",
        actual: undefined,
        forecast: "0.3%",
        previous: "0.1%",
      },
      {
        id: "22",
        time: "10:00 AM",
        country: "United States",
        countryCode: "US",
        title: "Core Retail Sales MoM",
        impact: "high",
        actual: undefined,
        forecast: "0.2%",
        previous: "0.1%",
      },
      {
        id: "23",
        time: "11:15 AM",
        country: "United States",
        countryCode: "US",
        title: "Industrial Production MoM",
        impact: "medium",
        actual: undefined,
        forecast: "0.3%",
        previous: "0.0%",
      },
      {
        id: "24",
        time: "5:00 PM",
        country: "Japan",
        countryCode: "JP",
        title: "BOJ Policy Rate",
        impact: "high",
        actual: undefined,
        forecast: "-0.10%",
        previous: "-0.10%",
      },
    ],
  },
]



export default function TerminalPage() {
  return <TerminalContent />
}


function TerminalContent() {
  // Initialize WebSocket connection for real-time market data
  const { isConnected: wsConnected, isConnecting: wsConnecting, error: wsError } = useWebSocketConnection()
  
  // Initialize account ID state first
  const [currentAccountId, setCurrentAccountId] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("accountId") || null;
    }
    return null;
  });

  // Initialize SignalR positions connection
  const { 
    positions: signalRPositions, 
    isConnected: positionsConnected, 
    isConnecting: positionsConnecting,
    error: positionsError,
    reconnect: positionsReconnect, // available if needed, but not auto-called
  } = usePositionsSignalR({
    accountId: currentAccountId,
    enabled: true
  });
  
  const [leftPanelView, setLeftPanelView] = React.useState<LeftPanelView>("instruments")
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = React.useState(false)
  const [activeInstrumentTab, setActiveInstrumentTab] = React.useState("eurusd")
  // Lightweight toast notice for trade actions
  const [tradeNotice, setTradeNotice] = React.useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  React.useEffect(() => {
    if (!tradeNotice) return
    const t = setTimeout(() => setTradeNotice(null), 3000)
    return () => clearTimeout(t)
  }, [tradeNotice])
  // State for MT5 accounts and selected account
  const [mt5Accounts, setMt5Accounts] = React.useState<MT5Account[]>([]);

  // Persist selection locally and to server as default
  React.useEffect(() => {
    if (!currentAccountId) { console.warn('[Close] No currentAccountId set; aborting'); return; }
    localStorage.setItem("accountId", currentAccountId);
    // Fire-and-forget server persistence; ignore errors
    fetch('/apis/auth/mt5-default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: currentAccountId })
    }).catch(() => {})
  }, [currentAccountId]);

  // Fetch MT5 accounts on component mount
  React.useEffect(() => {
    const fetchMT5Accounts = async () => {
      try {
        const response = await fetch('/apis/auth/mt5-account');

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.accounts) {
            setMt5Accounts(data.data.accounts);

            // If no account is selected, use server default if present, else first
            if (!currentAccountId && data.data.accounts.length > 0) {
              const serverDefault = data.data.defaultAccountId as string | undefined;
              setCurrentAccountId(serverDefault || data.data.accounts[0].accountId);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching MT5 accounts:', error);
      }
    };

    fetchMT5Accounts();
  }, []);
  const [instrumentTabs, setInstrumentTabs] = React.useState<InstrumentTab[]>([
    { id: "eurusd", symbol: "EUR/USD", countryCode: "EU" },
    { id: "btc", symbol: "BTC", icon: <span className="text-base">â‚¿</span> },
    { id: "us500", symbol: "US500", countryCode: "US" },
    { id: "xauusd", symbol: "XAU/USD", countryCode: "US" },
    { id: "aapl", symbol: "AAPL", icon: <span className="text-base">ðŸŽ</span> },
  ])
  const [hideBalance, setHideBalance] = React.useState(false)
  // ðŸ’¥ FIX: Define the missing state for the right panel
  // const [activePanel, setActivePanel] = React.useState<"order" | "settings" | "calendar">("order"); // â¬…ï¸ NEW STATE DEFINITION

  // Hook for multiple account balances
  const accountIds = useMemo(() => mt5Accounts.map(account => account.accountId), [mt5Accounts]);
  const { balances, refreshBalance } = useMultiAccountBalancePolling(accountIds);

  // Track position changes more reliably - use both length and a position IDs hash
  const positionsHash = React.useMemo(() => {
    return signalRPositions.map(p => `${p.ticket}-${p.symbol}`).sort().join('|');
  }, [signalRPositions]);

  // Trigger balance refresh when positions actually change (new trade opened/closed)
  React.useEffect(() => {
    if (currentAccountId && positionsConnected && refreshBalance && signalRPositions.length >= 0) {
      // Small delay to ensure server has updated balance after trade event
      const timeoutId = setTimeout(() => {
        refreshBalance(currentAccountId);
        console.log('[Balance] Refreshed getClientProfile after position change detected');
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [positionsHash, currentAccountId, positionsConnected, refreshBalance]);

  // Get accountType from MT5Account instead of from getClientProfile
  const currentAccount = React.useMemo(() => {
    return mt5Accounts.find(acc => acc.accountId === currentAccountId);
  }, [mt5Accounts, currentAccountId]);

  // For compatibility with existing code
  const balanceDataFromAPI = balances[currentAccountId || ''] || initialBalanceData;
  
  // Merge accountType: Priority order:
  // 1. From getClientProfile Group field (most reliable)
  // 2. From getClientProfile AccountType field
  // 3. From MT5Account table (fallback)
  const balanceData: BalanceData = React.useMemo(() => {
    // getClientProfile already extracts accountType from Group field, so use that
    // It's already in balanceDataFromAPI.accountType
    // Only fallback to MT5Account if getClientProfile didn't provide it
    let accountType = balanceDataFromAPI.accountType;
    
    // If not available from API, use MT5Account
    if (!accountType || accountType === 'Live') {
      const mt5AccountType = currentAccount?.accountType === 'Demo' ? 'Demo' : 'Live';
      // Prefer API data, but use MT5Account as fallback
      accountType = balanceDataFromAPI.accountType || (mt5AccountType as 'Demo' | 'Live');
    }
    
    return {
      ...balanceDataFromAPI,
      accountType: accountType as 'Demo' | 'Live'
    };
  }, [balanceDataFromAPI, currentAccount?.accountType]);
  
  const isBalanceLoading = false;
  const balanceError = null;

  // Debug: Track balance changes (using ref at component level, not in effect)
  const prevBalanceRef = React.useRef<{ balance: number; equity: number } | null>(null);
  
  React.useEffect(() => {
    if (currentAccountId && balanceData && balanceData.balance > 0) {
      const prev = prevBalanceRef.current;
      if (prev && (prev.balance !== balanceData.balance || prev.equity !== balanceData.equity)) {
        console.log('[Balance][UI Update] Balance changed:', {
          accountId: currentAccountId,
          oldBalance: prev.balance,
          newBalance: balanceData.balance,
          oldEquity: prev.equity,
          newEquity: balanceData.equity,
          totalPL: balanceData.totalPL
        });
      }
      prevBalanceRef.current = { balance: balanceData.balance, equity: balanceData.equity };
    }
  }, [currentAccountId, balanceData.balance, balanceData.equity]);

  // State for user data
  const [userName, setUserName] = React.useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userName') || 'No User';
    }
    return 'No User';
  });
  const [userEmail, setUserEmail] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userEmail') || '';
    }
    return '';
  });
  const [isUserLoading, setIsUserLoading] = React.useState(true);

  // Fetch user data on mount
  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsUserLoading(true);
        const response = await fetch('/apis/auth/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Important: includes cookies for session
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            const name = data.user.name || 'No User';
            setUserName(name);
            // Store in localStorage for persistence
            localStorage.setItem('userName', name);
            // Also store email for reference
            if (data.user.email) {
              setUserEmail(data.user.email);
              localStorage.setItem('userEmail', data.user.email);
            }
          }
        } else {
          // If not authenticated, clear stored data
          localStorage.removeItem('userName');
          localStorage.removeItem('userEmail');
          setUserName('No User');
          setUserEmail('');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setUserName('No User');
        setUserEmail('');
      } finally {
        setIsUserLoading(false);
      }
    };

    fetchUser();
  }, [currentAccountId]);
  const maskEmail = React.useCallback((email: string) => {
    if (!email) return '***';
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    if (!local || local.length === 0) return `***@${domain}`;
    const first = local[0];
    const last = local.length > 1 ? local[local.length - 1] : '';
    const maskLength = Math.max(local.length - 2, 4);
    const masked = '*'.repeat(maskLength);
    return `${first}${masked}${last ? last : ''}@${domain}`;
  }, []);
  const maskedEmail = React.useMemo(() => maskEmail(userEmail), [maskEmail, userEmail]);

  const handleSignOut = React.useCallback(async () => {
    try {
      await fetch('/apis/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      try {
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('accountId');
      } catch {}
      window.location.href = 'https://dashboard.zuperior.com/login';
    }
  }, []);

  const formatBalanceDisplay = (value: number) =>
    isBalanceLoading
      ? "Loading..."
      : balanceError
        ? "Error"
        : hideBalance
          ? "......"
          : formatCurrency(value, 2);

  // const displayEquity = formatBalanceDisplay(balanceData.equity);
  // const displayBalance = formatBalanceDisplay(balanceData.balance);
  // const displayMargin = formatBalanceDisplay(balanceData.margin);
  // const displayFreeMargin = formatBalanceDisplay(balanceData.freeMargin);
  // const displayMarginLevel = isBalanceLoading
  //   ? "Loading..."
  //   : balanceError
  //     ? "Error"
  //     : hideBalance
  //       ? "......"
  //       : `${balanceData.marginLevel.toFixed(2)} %`;

  // const displayTotalPL = formatBalanceDisplay(balanceData.totalPL);
  const [instruments, setInstruments] = useAtom(instrumentsAtom)
  const [isPositionsCollapsed] = useAtom(positionsIsCollapsedAtom)
  const [activePositionsTab, setActivePositionsTab] = useAtom(positionsActiveTabAtom)

  // NEW STATE for loading status and total count (Chunking/Batching state)
  const [totalSymbolsCount, setTotalSymbolsCount] = React.useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = React.useState(true);
  const [isFetchingBackground, setIsFetchingBackground] = React.useState(false);
  // const [error, setError] = React.useState<string | null>(null);
  const isInitialLoadRef = React.useRef(true);

  // --- Utility Function to Merge Data (RE-INTRODUCED) ---
  const mergeInstruments = React.useCallback((newInstruments: Instrument[]) => {
    setInstruments(currentInstruments => {
      // 1. Create a map of existing instruments for quick lookup (to track favorites)
      const currentMap = new Map(currentInstruments.map(i => [i.id, i]));

      // 2. Map the new instruments, overwriting them in the map, but preserving user's 'isFavorite' status
      newInstruments.forEach(newItem => {
          const existingItem = currentMap.get(newItem.id);
          currentMap.set(newItem.id, {
              ...newItem,
              isFavorite: existingItem?.isFavorite ?? newItem.isFavorite,
          });
      });

      // 3. Convert map back to an array
      return Array.from(currentMap.values());
    });
  }, [setInstruments]);

  // Resizable panel dimensions
  const [leftPanelWidth, setLeftPanelWidth] = React.useState(320)
  const [rightPanelWidth, setRightPanelWidth] = React.useState(300)
  const [positionsHeight, setPositionsHeight] = React.useState(300)
  const [pendingOrders, setPendingOrders] = React.useState<Position[]>([])

  const [openTabs] = useAtom(openTabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  const [, addTab] = useAtom(addTabAtom)
  const [, removeTab] = useAtom(removeTabAtom)


   // --- EFFECT 1: INITIAL LOAD (Cache Check or First Chunk) - RE-INTRODUCED ---
  React.useEffect(() => {
    if (!isInitialLoadRef.current) return;
    isInitialLoadRef.current = false;

    setIsLoadingInitial(true);

    // 1. Check Local Storage Cache
    const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cachedData) {
        try {
            const { instruments: cachedInstruments, timestamp, total } = JSON.parse(cachedData);
            if (Date.now() - timestamp < CACHE_TTL_MS && Array.isArray(cachedInstruments)) {
                // Cache HIT: Load from cache instantly
                setInstruments(cachedInstruments);
                setTotalSymbolsCount(total || cachedInstruments.length);
                setIsLoadingInitial(false);
                return; // Stop the initial load process, background fetch will run
            }
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } catch (e) {
            console.error("Failed to parse instrument cache. Clearing and fetching:", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }


    // 2. Fetch Initial Chunk
    const fetchInitialChunk = async () => {
      try {
        // Fetch only the first chunk (0 to INITIAL_CHUNK_LIMIT)
        const url = `/apis/market-data?offset=0&limit=${INITIAL_CHUNK_LIMIT}`;
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
          // Handle 503 Service Unavailable gracefully (often means no data yet)
          if (response.status === 503) {
            console.warn('[Market Data] Service temporarily unavailable - will retry later');
            setIsLoadingInitial(false);
            return; // Exit gracefully without throwing
          }
          let result;
          try {
            result = await response.json();
          } catch {
            result = {};
          }
          throw new Error(result.error || result.message || `HTTP error! status: ${response.status}`);
        }

        let result;
        try {
          result = await response.json();
        } catch (e) {
          console.error('[Market Data] Failed to parse response:', e);
          setIsLoadingInitial(false);
          return;
        }
        if (result.success && Array.isArray(result.data)) {
          // Set the total count based on the API response
          setTotalSymbolsCount(result.total || result.data.length);

          const defaultFavorites = ["EUR/USD", "XAU/USD", "BTCUSD", "ETHUSD", "GBP/USD", "USD/JPY"];
          const instrumentsWithInitialFavorites = (result.data as Instrument[]).map(item => {
              const normalizedSymbol = item.symbol.toUpperCase().replace('/', '');
              const isDefaultFavorite = defaultFavorites.some(fav =>
                  fav.toUpperCase().replace('/', '') === normalizedSymbol
              );
              return {
                  ...item,
                  isFavorite: isDefaultFavorite || item.isFavorite,
              };
          });

          mergeInstruments(instrumentsWithInitialFavorites);
        } else {
          throw new Error(result.error || "Failed to load initial instrument data.");
        }
      } catch (e: unknown) {
        // Don't log network errors that are expected (server down, service unavailable, etc.)
        const error = e instanceof Error ? e : new Error('Unknown error');
        const errorMessage = error.message;
        
        // Only log if it's not a network/server error (5xx)
        if (!errorMessage.includes('HTTP') || (!errorMessage.includes('503') && !errorMessage.includes('502') && !errorMessage.includes('500'))) {
          console.error('[Market Data] Error fetching initial instruments:', errorMessage);
        } else {
          console.warn('[Market Data] Server temporarily unavailable - using cached data if available');
        }
      } finally {
        setIsLoadingInitial(false);
      }
    };

    fetchInitialChunk();

  }, [mergeInstruments, setInstruments]);
  // --- END EFFECT 1 ---


  // --- EFFECT 2: BACKGROUND FETCH (Batch Loading) - RE-INTRODUCED ---
  React.useEffect(() => {
    // Only run if: 1. Initial load is finished. 2. We are not currently fetching. 3. Not all instruments are loaded.
    const isFullListLoaded = instruments.length >= totalSymbolsCount && totalSymbolsCount > 0;
    if (isLoadingInitial || isFetchingBackground || isFullListLoaded) {
      return;
    }

    // Additional guard: Don't start if we're close to total (within 10 items)
    if (totalSymbolsCount > 0 && instruments.length >= totalSymbolsCount - 10) {
      return;
    }

    const fetchRemainingChunks = async () => {
      setIsFetchingBackground(true);

      let currentInstrumentsList: Instrument[] = [...instruments];

      // Fetch the remaining data in chunks
      let currentOffset = currentInstrumentsList.length;
      while (currentOffset < totalSymbolsCount) {
        try {
          const url = `/apis/market-data?offset=${currentOffset}&limit=${BACKGROUND_CHUNK_SIZE}`;
          const response = await fetch(url, { cache: 'no-store' });

          if (!response.ok) {
            break;
          }

          const result = await response.json();

          if (result.success && Array.isArray(result.data)) {
            const newChunk = result.data as Instrument[];

            // Merge the new chunk into the full list while preserving favorites
            currentInstrumentsList = mergeNewChunkIntoFullList(currentInstrumentsList, newChunk);
            currentOffset += newChunk.length;

            // Update the state immediately after each chunk
            // We use the full list here, as mergeInstruments is a function that uses the atom's setter
            setInstruments(currentInstrumentsList);

            // Update the cache with the growing list
            localStorage.setItem(
                LOCAL_STORAGE_KEY,
                JSON.stringify({
                    instruments: currentInstrumentsList,
                    timestamp: Date.now(),
                    total: totalSymbolsCount,
                })
            );

          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }

      setIsFetchingBackground(false);
    };

    // Helper function to safely merge the new chunk while preserving favorite status
    const mergeNewChunkIntoFullList = (currentInstruments: Instrument[], newChunk: Instrument[]) => {
        const currentMap = new Map(currentInstruments.map(i => [i.id, i]));

        newChunk.forEach(newItem => {
            const existingItem = currentMap.get(newItem.id);
            // Add new item, using existing favorite status if available
            currentMap.set(newItem.id, {
                ...newItem,
                isFavorite: existingItem?.isFavorite ?? newItem.isFavorite,
            });
        });

        return Array.from(currentMap.values());
    };

    fetchRemainingChunks();

  }, [isLoadingInitial, isFetchingBackground, instruments, totalSymbolsCount, setInstruments]);
  // --- END EFFECT 2 ---

  // --- DERIVED SELECTED INSTRUMENT DATA ---
  const selectedInstrument = React.useMemo(() => {
    const found = instruments.find(i => i.id === activeInstrumentTab);

    // Fall back to a placeholder object if nothing is found
    return found || {
      id: activeInstrumentTab,
      symbol: activeInstrumentTab.toUpperCase().replace('/', ''),
      bid: 0,
      ask: 0,
      countryCode: "US",
      change1d: 0,
      changePercent1d: 0,
      isFavorite: false,
      category: 'stocks',
      signal: 'up', // Default signal to 'up' or 'neutral'
      description: activeInstrumentTab.toUpperCase().replace('/', ''),
    } as Instrument;
  }, [instruments, activeInstrumentTab]);
  // --- END DERIVED SELECTED INSTRUMENT DATA ---

  // Convert SignalR positions to Position format for the table
  const formattedPositions = React.useMemo((): Position[] => {
    console.log('🔄 [Format] Raw signalR positions:', signalRPositions)
    console.log('🔄 [Format] Count:', signalRPositions.length)
    
    // Map incoming live positions to table rows - USE TICKET AS ID!
    const rows = signalRPositions.map((pos): Position => {
      // Use ticket number as the ID for reliable closing
      const ticketNum = pos.ticket && pos.ticket > 0 ? pos.ticket : 0;
      const posId = ticketNum > 0 ? `ticket-${ticketNum}` : pos.id;
      
      console.log(`🔄 [Format] Mapping position: ticket=${ticketNum}, id=${posId}, symbol=${pos.symbol}`)
      
      return {
        id: posId,  // Use ticket-based ID
        ticket: ticketNum,
        symbol: pos.symbol,
        countryCode: undefined,
        icon: undefined,
        type: pos.type,
        volume: pos.volume,
        openPrice: pos.openPrice,
        currentPrice: pos.currentPrice,
        takeProfit: pos.takeProfit,
        stopLoss: pos.stopLoss,
        position: ticketNum > 0 ? ticketNum.toString() : posId,
        openTime: formatPositionTime(pos.openTime),
        swap: pos.swap,
        pnl: pos.profit,
      }
    })
    // Deduplicate by id to avoid React key collisions if backend sends duplicates
    const byId = new Map<string, Position>()
    rows.forEach(r => byId.set(r.id, r))
    const result = Array.from(byId.values())
    console.log('✅ [Format] Final formatted positions:', result)
    return result
  }, [signalRPositions]);

  // Map from row id to numeric ticket for reliable close calls
  const idToTicket = React.useMemo(() => {
    const m = new Map<string, number>()
    signalRPositions.forEach((p) => {
      // Use the actual ID from the position (which is already formatted by the SSE hook)
      const posId = p.id
      const ticketNum = Number(p.ticket)
      // Store mapping even if ticket is 0, but only if ID exists
      if (posId && ticketNum > 0) {
        m.set(posId, ticketNum)
      }
    })
    
    return m
  }, [signalRPositions])

  // Fallback resolver: match by symbol + volume + openPrice if ticket is missing
  const resolveTicketByFields = React.useCallback((rowId: string): number | null => {
    const row = formattedPositions.find(r => r.id === rowId)
    if (!row) {
      return null
    }
    
    const vol = Number(row.volume)
    const sym = row.symbol
    const price = Number(row.openPrice)
    
    
    
    const match = signalRPositions.find(p => {
      const rawTicket = p.PositionId ?? p.PositionID ?? p.Ticket ?? p.ticket ?? p.Position ?? p.position ?? p.Order ?? p.OrderId ?? p.id ?? p.Id
      const ticketNum = Number(rawTicket)
      if (!ticketNum || ticketNum <= 0) return false
      if (p.symbol !== sym) return false
      if (Math.abs(Number(p.volume) - vol) > 1e-4) return false // Increased tolerance
      if (Math.abs(Number(p.openPrice) - price) > 1e-3) return false // Increased tolerance
      return true
    })
    
    if (match) {
      const rawTicket = match.PositionId ?? match.PositionID ?? match.Ticket ?? match.ticket ?? match.Position ?? match.position ?? match.Order ?? match.OrderId ?? match.id ?? match.Id
      return Number(rawTicket) || null
    }
    
    return null
  }, [formattedPositions, signalRPositions])

  // Live Total P/L from current open positions (sum of live profits)
  const liveTotalPL = React.useMemo(() => {
    try {
      return signalRPositions.reduce((sum, p) => sum + (Number(p.profit) || 0), 0);
    } catch {
      return 0;
    }
  }, [signalRPositions]);

  // Live Equity = Balance + Total P/L (floating)
  const liveEquity = React.useMemo(() => {
    const bal = Number(balanceData.balance) || 0;
    return bal + liveTotalPL;
  }, [balanceData.balance, liveTotalPL]);

  // Closed trades (history) â€“ default period 'month'
  const { closedPositions, isLoading: closedLoading } = useTradeHistory({ accountId: currentAccountId, period: 'month', enabled: true })
  
  // Debug samples (non-intrusive)
  React.useEffect(() => {
    if (signalRPositions.length > 0) {
      console.log('[Positions][RAW sample]', signalRPositions.slice(0, 3))
      console.log('[Positions][FORMATTED sample]', formattedPositions.slice(0, 3))
      // Check for positions without valid tickets
      const noTickets = signalRPositions.filter(p => !p.ticket || p.ticket <= 0)
      if (noTickets.length > 0) {
        console.warn('âš ï¸ [Positions] Found', noTickets.length, 'positions without valid tickets:', noTickets.map(p => ({ id: p.id, symbol: p.symbol })))
      }
    }
  }, [signalRPositions, formattedPositions])

  // Log account switches; hook reacts to accountId change internally
  React.useEffect(() => {
    if (currentAccountId) {
      console.log('[Positions] Switching account', currentAccountId)
    }
  }, [currentAccountId])

  // Note: reconnect is handled inside the hook when accountId changes.
  // Avoid calling reconnect here to prevent double connections.

  // Log positions status for debugging
  React.useEffect(() => {
    if (positionsError) {
      console.error('âŒ Positions Error:', positionsError);
    }
    if (positionsConnected) {
      console.log('âœ… Positions Connected. Count:', formattedPositions.length);
    }
    if (positionsConnecting) {
      console.log('ðŸ”„ Positions Connecting...');
    }
  }, [positionsConnected, positionsConnecting, positionsError, formattedPositions.length]);


  // Sidebar items definition (left as is)
  const sidebarItems: SidebarItem[] = [
    {
      id: "instruments",
      icon: <ListIcon className="h-4 w-4" />,
      label: "Instruments",
      active: leftPanelView === "instruments",
      onClick: () => {
        if (leftPanelView === "instruments") {
          setIsLeftPanelCollapsed(!isLeftPanelCollapsed)
        } else {
          setLeftPanelView("instruments")
          setIsLeftPanelCollapsed(false)
        }
      },
    },
    {
      id: "calendar",
      icon: <Calendar className="h-4 w-4" />,
      label: "Economic Calendar",
      active: leftPanelView === "calendar",
      onClick: () => {
        if (leftPanelView === "calendar") {
          setIsLeftPanelCollapsed(!isLeftPanelCollapsed)
        } else {
          setLeftPanelView("calendar")
          setIsLeftPanelCollapsed(false)
        }
      },
    },
    {
      id: "settings",
      icon: <Settings className="h-4 w-4" />,
      label: "Settings",
      active: leftPanelView === "settings",
      onClick: () => {
        if (leftPanelView === "settings") {
          setIsLeftPanelCollapsed(!isLeftPanelCollapsed)
        } else {
          setLeftPanelView("settings")
          setIsLeftPanelCollapsed(false)
        }
      },
    },
  ]

  // Tab handlers (left as is)
  const handleTabClose = (tabId: string) => {
    // Remove from Jotai store (global state)
    removeTab(tabId)
    
    // Also update local state for backward compatibility
    const newTabs = instrumentTabs.filter((t) => t.id !== tabId)
    if (newTabs.length > 0) {
      setInstrumentTabs(newTabs)
      if (activeInstrumentTab === tabId) {
        const newActiveId = newTabs[0].id
        setActiveInstrumentTab(newActiveId)
        setActiveTabId(newActiveId)
      }
    } else if (openTabs.length > 0 && activeTabId === tabId) {
      // If local tabs are empty but Jotai has tabs, switch to first Jotai tab
      setActiveTabId(openTabs[0].id)
    }
  }

  const handleAddTab = (instrumentId: string) => {
    
    // Add to Jotai store (this handles everything)
    // The addTabAtom will find the instrument, create the tab, and set it as active
    addTab(instrumentId);
    
    // Also update local state for backward compatibility
    const instrument = instruments.find(i => i.id === instrumentId);
    if (instrument) {
      const newTab: InstrumentTab = {
        id: instrument.id,
        symbol: instrument.symbol,
        countryCode: "US",
      };
      
      if (!instrumentTabs.some(tab => tab.id === newTab.id)) {
        setInstrumentTabs([...instrumentTabs, newTab]);
      }
      setActiveInstrumentTab(newTab.id);
    }
  }

  const activeTab = React.useMemo(() => {
    const tab = openTabs.find(tab => tab.id === activeTabId)
    return tab
  }, [openTabs, activeTabId])
  const handleBuy = async (data: OrderData) => {
      try {
        // âœ… Build the payload using the current active instrument
        const order = {
          symbol: selectedInstrument.symbol,
          side: "buy" as const,
          volume: data.volume, // â¬…ï¸ UPDATED: Volume is multiplied by 100
          orderType: data.orderType,
          openPrice: data.openPrice,
          stopLoss: data.stopLoss,
          takeProfit: data.takeProfit,
          accountId: currentAccountId || '0',
          price: data.openPrice || selectedInstrument.ask || 0,
        };

        console.log("ðŸ“¤ Sending BUY order:", order);

        const response = order.orderType === 'pending' ? await placeSellLimit({ accountId: order.accountId, symbol: order.symbol.replace('/', ''), price: Number(order.openPrice || order.price), volume: Number(order.volume), stopLoss: order.stopLoss, takeProfit: order.takeProfit, comment: 'Sell Limit via web' }) : await placeMarketOrder(order);

        console.log("âœ… Buy Order Success:", response);
        console.log(`[Order] Buy placed for ${order.symbol}`);
      } catch (error) {
        console.error("âŒ Buy Order Failed:", error);
        console.error(`[Order] Buy failed for ${selectedInstrument.symbol}. Check console for details.`);
      }
    };

    const handleSell = async (data: OrderData) => {
      try {
        // âœ… Build the payload with all required fields for backend
        const order = {
          symbol: selectedInstrument.symbol,
          side: "sell" as const,
          volume: data.volume, // â¬…ï¸ UPDATED: Volume is multiplied by 100
          orderType: data.orderType,
          openPrice: data.openPrice,
          stopLoss: data.stopLoss,
          takeProfit: data.takeProfit,
          accountId: currentAccountId || '0',
          price: data.openPrice || selectedInstrument.bid || 0,
        };

        console.log("ðŸ“¤ Sending SELL order:", order);

        // âœ… Call your API proxy
        const response = order.orderType === 'pending' ? await placeSellLimit({ accountId: order.accountId, symbol: order.symbol.replace('/', ''), price: Number(order.openPrice || order.price), volume: Number(order.volume), stopLoss: order.stopLoss, takeProfit: order.takeProfit, comment: 'Sell Limit via web' }) : await placeMarketOrder(order);

        console.log("âœ… Sell Order Success:", response);
        console.log(`[Order] Sell placed for ${order.symbol}`);
      } catch (error) {
        console.error("âŒ Sell Order Failed:", error);
        console.error(`[Order] Sell failed for ${selectedInstrument.symbol}. Check console for details.`);
      }
    };


  // Clean submit handlers used by OrderPanel (avoid alerts)
  const handleBuySubmit = async (data: OrderData) => {
    try {
      const chosenSymbol = activeTab?.symbol || selectedInstrument.symbol
      const order = {
        symbol: chosenSymbol,
        side: 'buy' as const,
        volume: data.volume,
        orderType: data.orderType,
        openPrice: data.openPrice,
        stopLoss: data.stopLoss,
        takeProfit: data.takeProfit,
        accountId: currentAccountId || '0',
        price: data.openPrice || selectedInstrument.ask || 0,
      }
      console.log('[Trade][BUY] submitting', { order, activeTabId, chosenSymbol })
      const response = order.orderType === 'pending'
        ? await placeBuyLimit({ accountId: order.accountId, symbol: order.symbol.replace('/', ''), price: Number(order.openPrice || order.price), volume: Number(order.volume), stopLoss: order.stopLoss, takeProfit: order.takeProfit, comment: 'Buy Limit via web' })
        : await placeMarketOrder(order)
      console.log('[Trade][BUY] success', response)
      setTradeNotice({ type: 'success', message: `Buy ${order.symbol} @ ${order.price}` })
      // Immediately refresh balance after trade (SignalR PositionOpened will also trigger, but this ensures quick update)
      if (refreshBalance && currentAccountId) {
        setTimeout(() => refreshBalance(currentAccountId), 200);
      }
      // Add to pending table immediately if pending
      if (order.orderType === 'pending') {
        const orderId = Number((response?.OrderId ?? response?.orderId ?? response?.Id ?? response?.id) || 0)
        setPendingOrders(prev => [
          {
            id: `pending-${orderId || Date.now()}`,
            ticket: orderId || 0,
            symbol: order.symbol.replace('/', ''),
            type: 'Buy',
            volume: Number(order.volume),
            openPrice: Number(order.price) || 0,
            currentPrice: 0,
            takeProfit: order.takeProfit,
            stopLoss: order.stopLoss,
            position: (orderId || '').toString(),
            openTime: new Date().toISOString(),
            swap: 0,
            pnl: 0,
          },
          ...prev,
        ])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Buy order failed'
      console.error('[Trade][BUY] error', err)
      setTradeNotice({ type: 'error', message })
    }
  }

  const handleSellSubmit = async (data: OrderData) => {
    try {
      const chosenSymbol = activeTab?.symbol || selectedInstrument.symbol
      const order = {
        symbol: chosenSymbol,
        side: 'sell' as const,
        volume: data.volume,
        orderType: data.orderType,
        openPrice: data.openPrice,
        stopLoss: data.stopLoss,
        takeProfit: data.takeProfit,
        accountId: currentAccountId || '0',
        price: data.openPrice || selectedInstrument.bid || 0,
      }
      console.log('[Trade][SELL] submitting', { order, activeTabId, chosenSymbol })
      const response = order.orderType === 'pending'
        ? await placeSellLimit({ accountId: order.accountId, symbol: order.symbol.replace('/', ''), price: Number(order.openPrice || order.price), volume: Number(order.volume), stopLoss: order.stopLoss, takeProfit: order.takeProfit, comment: 'Sell Limit via web' })
        : await placeMarketOrder(order)
      console.log('[Trade][SELL] success', response)
      setTradeNotice({ type: 'success', message: `Sell ${order.symbol} @ ${order.price}` })
      // Immediately refresh balance after trade (SignalR PositionOpened will also trigger, but this ensures quick update)
      if (refreshBalance && currentAccountId) {
        setTimeout(() => refreshBalance(currentAccountId), 200);
      }
      if (order.orderType === 'pending') {
        const orderId = Number((response?.OrderId ?? response?.orderId ?? response?.Id ?? response?.id) || 0)
        setPendingOrders(prev => [
          {
            id: `pending-${orderId || Date.now()}`,
            ticket: orderId || 0,
            symbol: order.symbol.replace('/', ''),
            type: 'Sell',
            volume: Number(order.volume),
            openPrice: Number(order.price) || 0,
            currentPrice: 0,
            takeProfit: order.takeProfit,
            stopLoss: order.stopLoss,
            position: (orderId || '').toString(),
            openTime: new Date().toISOString(),
            swap: 0,
            pnl: 0,
          },
          ...prev,
        ])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sell order failed'
      console.error('[Trade][SELL] error', err)
      setTradeNotice({ type: 'error', message })
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {tradeNotice && (
        <div className={`fixed top-4 right-4 z-50 px-3 py-2 rounded shadow-md text-sm ${tradeNotice.type === 'success' ? 'bg-emerald-600/90 text-white' : 'bg-red-600/90 text-white'}`}>
          {tradeNotice.message}
        </div>
      )}
      {/* Top Navbar */}
      <header className="flex items-center h-14 px-4 border-b border-white/8 bg-[#01040D] shrink-0 z-30 gap-4">
        {/* Left: Logo + Instrument Tabs */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <Image src={brandLogo} alt="Zuperior logo" width={40} height={40} className="rounded-sm object-contain" priority />
            <h1 className="text-2xl font-bold gradient-text">Zuperior</h1>
          </div>
          
          {/* Instrument Tabs - takes remaining width */}
          <div className="flex-1 min-w-0">
            <InstrumentTabs
              tabs={openTabs}
              activeTabId={activeTabId}
              onTabChange={setActiveTabId}
              onTabClose={handleTabClose}
              onAddTab={handleAddTab}
            />
          </div>
        </div>

        {/* Right: WebSocket Status, Account, Alerts, User, Deposit */}
          <div className="flex items-center gap-2 shrink-0">
            {/* WebSocket Connection Status */}
            <WebSocketStatus 
              showDetails={false}
              positionsConnected={positionsConnected}
            />
          
          {/* Account Dropdown */}
          <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors group">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white/60">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          balanceData.accountType === 'Live' 
                            ? "bg-warning/20 text-warning" 
                            : "bg-info/20 text-info"
                        )}>
                          {balanceData.accountType}
                        </span>
                        &nbsp;&nbsp;
                        {isUserLoading ? 'Loading...' : userName}
                      </span>

                    </div>
                    {/* 1A: REAL-TIME EQUITY DISPLAY IN HEADER */}
                    <span className="text-sm font-semibold text-success price-font">
                      {hideBalance ? "......" : formatCurrency(liveEquity, 2)} USD
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/40 group-hover:text-white/60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 space-y-3">
                  {/* Hide Balance Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/80">Hide balance</span>
                    <Toggle
                      checked={hideBalance}
                      onCheckedChange={setHideBalance}
                      className="scale-75"
                    />
                  </div>

                  {/* Account Details (UPDATED WITH balanceData) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Balance</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white price-font">
                          {hideBalance ? "......" : formatCurrency(balanceData.balance, 2)} USD
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Total balance in your account</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Equity</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-success price-font">
                          {hideBalance ? "......" : formatCurrency(liveEquity, 2)} USD
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Balance + floating P/L</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Margin</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white price-font">
                          {hideBalance ? "......" : formatCurrency(balanceData.margin, 2)} USD
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Margin used for open positions</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Free margin</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white price-font">
                          {hideBalance ? "......" : formatCurrency(balanceData.freeMargin, 2)} USD
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Available margin for new positions</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Margin level</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white price-font">
                          {/* Format margin level as a percentage with 2 decimal places */}
                          {hideBalance ? "......" : `${balanceData.marginLevel.toFixed(2)} %`}
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Equity / Margin Ã— 100%</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Account leverage</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">1:{balanceData.leverage}</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Maximum leverage for trading</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" variant="outline" asChild>
                    <a 
                      href="https://dashboard.zuperior.com/deposit" 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      Top Up
                    </a>
                  </Button>

                  <Separator className="bg-white/10" />

                  {/* Enhanced Choose an account section */}
                  <div>
                    <span className="text-xs text-white/40">Choose an account</span>
                    <div className="mt-2 space-y-2">
                      {mt5Accounts.map((account) => (
                        <button
                          key={account.id}
                          onClick={() => setCurrentAccountId(account.accountId)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors",
                            currentAccountId === account.accountId
                              ? "bg-primary/20 border border-primary/50"
                              : "bg-white/5 hover:bg-white/10"
                          )}
                        >
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                account.accountType === 'Live'
                                  ? "bg-warning/20 text-warning"
                                  : "bg-info/20 text-info"
                              )}>
                                {account.accountType || 'Live'}
                              </span>
                              <span className="text-xs text-white/60">
                                {account.displayAccountId} 
                              </span>
                            </div>
                            <span className="text-sm font-medium text-white mt-1 price-font">
                              {isBalanceLoading
                                ? "Loading..."
                                : balanceError
                                  ? "Error"
                                  : hideBalance
                                    ? "......"
                                    : `${formatCurrency(
                                        (currentAccountId === account.accountId
                                          ? liveEquity
                                          : balances[account.accountId]?.equity) || 0,
                                        2
                                      )} USD`
                              }
                            </span>
                          </div>
                          {currentAccountId === account.accountId && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-white/10" />

                  {/* Account Actions */}
                  <div className="space-y-1">
                    <a
                      href="https://dashboard.zuperior.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-white/5 rounded transition-colors group"
                    >
                      <span className="text-white/80 group-hover:text-white">Manage Accounts</span>
                      <ChevronDown className="h-4 w-4 text-white/40 -rotate-90" />
                    </a>
                    <button className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-white/5 rounded transition-colors group">
                      <span className="text-white/80 group-hover:text-white">Download Trading Log</span>
                      <ChevronDown className="h-4 w-4 text-white/40 -rotate-90" />
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

          {/* Alerts Button */}
          <Popover>
            <PopoverTrigger asChild>
              <IconButton size="sm" variant="ghost">
                <Bell className="h-4 w-4" />
              </IconButton>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Price alerts</h3>
                  <button className="text-primary hover:text-primary/80 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-white/20 mb-3" />
                  <p className="text-sm text-white/60 text-center mb-4">
                    Get notified instantly about price movements
                  </p>
                  <Button variant="outline" size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    New alert
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* User Button */}
          <Popover>
            <PopoverTrigger asChild>
              <IconButton size="sm" variant="ghost">
                <User className="h-4 w-4" />
              </IconButton>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div className="space-y-1">
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <User className="h-4 w-4" />
                    <span className="font-mono">
                      {isUserLoading ? 'Loading...' : maskedEmail}
                    </span>
                  </div>
                </div>
                <Separator />
                <a
                  href="https://dashboard.zuperior.com/support"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded transition-colors group"
                >
                  <LifeBuoy className="h-4 w-4 text-white/60 group-hover:text-white" />
                  <span className="text-white/80 group-hover:text-white">Support</span>
                </a>
                <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded transition-colors group">
                  <Lightbulb className="h-4 w-4 text-white/60 group-hover:text-white" />
                  <span className="text-white/80 group-hover:text-white">Suggest a feature</span>
                </button>
                <Separator />
                <button
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded transition-colors text-danger group"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Deposit Button */}
          <Button size="lg" className="ml-2" asChild>
            <a 
              href="https://dashboard.zuperior.com/deposit" 
              target="_blank" 
              rel="noreferrer"
            >
              Deposit
            </a>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden gap-1 p-1">
        {/* Left Sidebar */}
        <Sidebar items={sidebarItems} className="shrink-0" />

        <AnimatePresence mode="wait">
          {!isLeftPanelCollapsed && leftPanelView && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: leftPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ width: leftPanelWidth }}
              className="shrink-0 relative"
            >
              <div className="h-full glass-card rounded-lg overflow-hidden flex flex-col">
                {leftPanelView === "instruments" && (
                  <>
                    <div className="px-4 py-3 border-b border-white/10 shrink-0">
                      <h2 className="text-sm font-semibold text-white">Instruments</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <InstrumentList 
                        onSelectInstrument={handleAddTab} 
                        showFilters={true}
                      />
                    </div>
                  </>
                )}

                {leftPanelView === "calendar" && (
                  <>
                    <div className="px-4 py-3 border-b border-white/10 shrink-0">
                      <h2 className="text-sm font-semibold text-white">Economic Calendar</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <EconomicCalendar 
                        eventsByDate={mockCalendarEvents} 
                        showHeaders={false} 
                        showFilters={true}
                        maxHeight="100%" 
                      />
                    </div>
                  </>
                )}

                {leftPanelView === "settings" && (
                  <>
                    <div className="px-4 py-3 border-b border-white/10 shrink-0">
                      <h2 className="text-sm font-semibold text-white">Settings</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <SettingsPanel />
                    </div>
                  </>
                )}
              </div>
              
              {/* Resize Handle for Left Panel */}
              <ResizeHandle
                direction="horizontal"
                onResize={(delta) => {
                  setLeftPanelWidth(prev => Math.max(200, Math.min(600, prev + delta)))
                }}
                className="right-0"
              />
            </motion.div>
          )}
        </AnimatePresence>


        {/* Main Content Area (Chart, Positions, Order Panel + Bottom Summary) */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 gap-1">
          {/* Top Row: Chart + Positions and Order Panel */}
          <div className="flex flex-1 overflow-hidden gap-1 min-h-0">
            {/* Center Column: Chart + Positions */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 gap-1 relative">
              {/* Chart Area */}
              <div className="flex-1 overflow-hidden min-h-0">
                <ChartContainer 
                  symbol={activeTab?.symbol || "XAU/USD"}
                  className="h-full"
                  chartType="tradingview" // Use "lightweight" for simpler chart
                />
              </div>

              {/* Positions Table */}
              <div 
                className={cn(
                  "shrink-0 transition-all duration-300 ease-out overflow-hidden relative",
                  isPositionsCollapsed ? "h-[56px]" : ""
                )}
                style={{ height: isPositionsCollapsed ? '56px' : `${positionsHeight}px` }}
              >
                {/* Resize Handle for Positions Panel */}
                {!isPositionsCollapsed && (
                  <ResizeHandle
                    direction="vertical"
                    onResize={(delta) => {
                      // Negate delta because dragging down should increase height (visual expectation)
                      setPositionsHeight(prev => Math.max(150, Math.min(600, prev - delta)))
                    }}
                    className="top-0"
                  />
                )}
                <PositionsTable
                  key={currentAccountId || 'no-account'}
                  openPositions={formattedPositions}
                  pendingPositions={pendingOrders}
                  closedPositions={closedPositions}
                  accountId={currentAccountId}
                  onClose={async (id) => {
                    try {
                      console.log('[Close] Closing position:', id);
                      if (!currentAccountId) { 
                        console.error('[Close] No account selected'); 
                        setTradeNotice({ type: 'error', message: 'No account selected' });
                        return; 
                      }

                      // Extract position or pending by id
                      let position = formattedPositions.find(p => p.id === id)
                      const isPending = !position ? pendingOrders.some(p => p.id === id) : false
                      if (!position && isPending) { 
                        position = pendingOrders.find(p => p.id === id)! 
                      }

                      if (!position) { 
                        console.error('[Close] Position not found:', id, 'Available positions:', formattedPositions.map(p => ({ id: p.id, ticket: p.ticket })));
                        setTradeNotice({ type: 'error', message: 'Position not found' });
                        return; 
                      }

                      // Try to get positionId from ticket, position string, or id
                      let positionId: number | null = null;
                      
                      if (position.ticket && position.ticket > 0) {
                        positionId = position.ticket;
                      } else if (position.position) {
                        // Extract number from position string (e.g., "ticket-12345" -> 12345)
                        const match = position.position.match(/\d+/);
                        if (match) {
                          positionId = parseInt(match[0], 10);
                        }
                      } else if (id.startsWith('ticket-')) {
                        // Extract from id format "ticket-12345"
                        const match = id.match(/ticket-(\d+)/);
                        if (match) {
                          positionId = parseInt(match[1], 10);
                        }
                      }

                      if (!positionId || positionId === 0) { 
                        console.error('[Close] No valid position ID found. Position:', {
                          id: position.id,
                          ticket: position.ticket,
                          position: position.position,
                          rawPosition: position
                        });
                        setTradeNotice({ type: 'error', message: 'Invalid position ID' });
                        return; 
                      }

                      if (isPending) {
                        console.log('[Pending] Cancel order:', positionId)
                        const res = await cancelPendingOrder({ accountId: currentAccountId, orderId: Number(positionId), comment: 'Cancel via web terminal' })
                        console.log('[Pending] Cancel response:', res)
                        setPendingOrders(prev => prev.filter(p => p.id !== id))
                        setTradeNotice({ type: 'success', message: 'Order cancelled' });
                        return
                      }

                      console.log('[Close] Calling close API with position ID:', positionId, 'accountId:', currentAccountId)
                      const res = await fetch('/apis/trading/close', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accountId: currentAccountId, positionId, volume: 0 }),
                      })
                      
                      if (!res.ok) {
                        const errorText = await res.text().catch(() => 'Unknown error');
                        console.error('[Close] HTTP error:', res.status, errorText);
                        setTradeNotice({ type: 'error', message: `Failed to close: ${res.status}` });
                        return;
                      }

                      const json = await res.json().catch(() => ({} as any))
                      console.log('[Close] API response:', json)
                      
                      if (json.success || json.Success) { 
                        console.log('[Close] Position closed successfully'); 
                        setTradeNotice({ type: 'success', message: 'Position closed successfully' });
                        
                        // Immediately refresh balance using getClientProfile API after closing position
                        if (refreshBalance && currentAccountId) {
                          // Refresh immediately
                          refreshBalance(currentAccountId);
                          // Also refresh after a short delay to ensure server has processed the close
                          setTimeout(() => refreshBalance(currentAccountId), 300);
                          console.log('[Balance] Triggered getClientProfile refresh after position close');
                        }
                      }
                      else { 
                        const errorMsg = json.message || json.Message || json.error || 'Unknown error';
                        console.error('[Close] Failed to close position:', errorMsg, json);
                        setTradeNotice({ type: 'error', message: errorMsg });
                      }
                    } catch (e) {
                      const errorMsg = e instanceof Error ? e.message : 'Unexpected error';
                      console.error('[Close] Unexpected error during close operation:', e)
                      setTradeNotice?.({ type: 'error', message: errorMsg });
                    }
                  }}
                />
              </div>
            </div>

            {/* Right Column: Order Panel */}
            <div 
              style={{ width: `${rightPanelWidth}px` }}
              className="shrink-0 overflow-y-auto relative"
            >
              {/* Resize Handle for Order Panel */}
              <ResizeHandle
                direction="horizontal"
                onResize={(delta) => {
                  setRightPanelWidth(prev => Math.max(250, Math.min(500, prev - delta)))
                }}
                className="left-0"
              />
              <OrderPanel
                    symbol={activeTab?.symbol || "XAU/USD"}
                    countryCode={activeTab?.countryCode || "US"}
                    sellPrice={4354.896}
                    buyPrice={4355.056}
                    spread="0.16 USD"
                    // ✅ PASS THE FUNCTION REFERENCE ONLY, IT WILL RECEIVE THE DATA FROM ORDER PANEL
                    onBuy={handleBuySubmit}
                    onSell={handleSellSubmit}
                    className="w-full h-full"
                />
            </div>
          </div>

          {/* Bottom Account Summary Bar */}
          <div className="h-[40px] shrink-0 flex items-center justify-between px-4 glass-card rounded-lg">
            {/* Left: Account Metrics */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Equity:</span>
                <span className="text-xs font-semibold text-white price-font">
                  {hideBalance ? "......" : `${formatCurrency(liveEquity, 2)} USD`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Free Margin:</span>
                <span className="text-xs font-semibold text-white price-font">
                  {hideBalance ? "......" : formatCurrency(balanceData.freeMargin, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Balance:</span>
                <span className="text-xs font-semibold text-white price-font">
                  {hideBalance ? "......" : formatCurrency(balanceData.balance, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60"> </span>
                <span className="text-xs font-semibold text-white price-font">
                  {hideBalance ? "......" : formatCurrency(balanceData.margin, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Margin level:</span>
                <span className="text-xs font-semibold text-white price-font">
                    {hideBalance ? "......" : `${balanceData.marginLevel.toFixed(2)} %`}
                </span>
              </div>
            </div>

            {/* Right: Total P/L and Close All */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Total P/L, USD:</span>
                <span className={cn(
                  "text-sm font-semibold price-font",
                  liveTotalPL >= 0 ? "text-success" : "text-danger"
                )}>
                  {hideBalance ? "......" : `${liveTotalPL.toFixed(2)} USD`}
                </span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-white transition-colors">
                    Close all
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-1">
                    <button className="w-full px-3 py-2 text-sm text-left hover:bg-white/5 rounded transition-colors text-white">
                      Close all positions
                    </button>
                    <button className="w-full px-3 py-2 text-sm text-left hover:bg-white/5 rounded transition-colors text-white">
                      Close all profitable
                    </button>
                    <button className="w-full px-3 py-2 text-sm text-left hover:bg-white/5 rounded transition-colors text-white">
                      Close all losing
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
