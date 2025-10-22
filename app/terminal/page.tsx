"use client"

import * as React from "react"
import { useMemo } from "react"
import { useAtom } from "jotai"
import { motion, AnimatePresence } from "framer-motion"
import { placeMarketOrder } from "@/components/trading/placeOrder";
import { cn, formatCurrency } from "@/lib/utils"
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
import { IconButton } from "@/components/ui/icon-button"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { BalanceDisplay } from "@/components/trading/balance-display"
import { 
  instrumentsAtom, 
  positionsIsCollapsedAtom,
  openTabsAtom,
  activeTabIdAtom,
  addTabAtom,
  removeTabAtom
} from "@/lib/store"

type LeftPanelView = "instruments" | "calendar" | "settings" | null

interface MT5Account {
  id: string
  accountId: string
  name:string
  displayAccountId: string
  equity:number
  linkedAt: string
}


const LOCAL_STORAGE_KEY = 'zuperior_instruments_cache';
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache life
const INITIAL_CHUNK_LIMIT = 100;
const BACKGROUND_CHUNK_SIZE = 500;



// 🚀 UPDATED TYPE DEFINITION for Account Balance
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

// 🚀 INITIAL STATE & MOCK DATA (Retained for fallback)
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
// Mock positions data (rest remains the same)
const mockOpenPositions: Position[] = [
  {
    id: "1",
    symbol: "XAU/USD",
    countryCode: "US",
    type: "Sell",
    volume: 1,
    openPrice: 4362.406,
    currentPrice: 4346.564,
    takeProfit: undefined,
    stopLoss: undefined,
    position: "148849313",
    openTime: "Oct 17, 5:21:25 AM",
    swap: 0,
    pnl: 1584.2,
  },
]

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


// Hook for single account balance polling
function useAccountDataPolling(accountId: string | null): { data: BalanceData, isLoading: boolean, error: string | null } {
  // ✅ Always call hooks first - never conditionally
  const [data, setData] = React.useState<BalanceData>(initialBalanceData);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(accountId ? null : "Account ID not set.");
  const mockData = useMockBalancePolling(initialBalanceData);

  const fetchBalance = React.useCallback(async (isInitial = false) => {
    // Early return inside the callback is fine
    if (!accountId) {
      setIsLoading(false);
      setError("Account ID not set.");
      return;
    }

    const API_PATH = `/apis/user/${accountId}/getClientProfile`;

    if (isInitial) {
        setIsLoading(true);
    }

    try {
      const response = await fetch(API_PATH, { cache: 'no-store' });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: `HTTP status ${response.status}` }));
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const apiData = result.data as any; // Data object from the response

        // 🔑 MAPPING LOGIC: Handle common casing (PascalCase/CamelCase)
        const balance = apiData.Balance ?? apiData.balance ?? 0;
        const equity = apiData.Equity ?? apiData.equity ?? 0;
        const margin = apiData.Margin ?? apiData.MarginUsed ?? apiData.marginUsed ?? 0;
        const freeMargin = apiData.FreeMargin ?? apiData.freeMargin ?? 0;
        const totalPL = equity - balance;
        const name = apiData.Name ?? apiData.name ?? 'Test';
        const rawGroup = apiData.Group ?? apiData.group ?? 'Standard';
        const lowerCaseGroup = rawGroup.split('\\').pop()?.toLowerCase() || 'standard';
        const accountGroup = lowerCaseGroup.charAt(0).toUpperCase() + lowerCaseGroup.slice(1);

        setData({
          balance: balance,
          equity: equity,
          margin: margin,
          freeMargin: freeMargin,
          marginLevel: apiData.MarginLevel ?? apiData.marginLevel ?? 0,
          profit: apiData.profit ?? apiData.profit ?? 0,
          leverage: apiData.Leverage ?? apiData.leverage ?? "1:200",
          totalPL: parseFloat(totalPL.toFixed(2)),
          name:name,
          accountGroup:accountGroup,
          accountType: (apiData.AccountType === 'Live' || apiData.accountType === 'Live') ? 'Live' : 'Demo',
        });
        setError(null);
      } else {
        throw new Error(result.error || "Failed to load account data: API success=false or missing data.");
      }
    } catch (e) {
      const errorMessage = `Failed to fetch balance from ${API_PATH}: ${e instanceof Error ? e.message : 'Unknown error'}`;
      console.error(errorMessage);
      setError(errorMessage);
      // Fallback to mock data on error
      if (isInitial) {
        setData(mockData);
        setError(`API Error: ${e instanceof Error ? e.message : 'Unknown error'}. Using mock data.`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [accountId, mockData]);

  // Initial fetch and set up polling - only when accountId is available
  React.useEffect(() => {
    if (!accountId) {
      setIsLoading(false);
      return;
    }

    fetchBalance(true);
    const interval = setInterval(() => fetchBalance(false), 6000);

    return () => clearInterval(interval);
  }, [accountId, fetchBalance]);

  const finalData = error && !isLoading ? mockData : data;

  return { data: finalData, isLoading, error };
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

  // Fetch balance for a specific account
  const fetchAccountBalance = React.useCallback(async (accountId: string, isInitial = false) => {
    const API_PATH = `/apis/user/${accountId}/getClientProfile`;

    try {
      const response = await fetch(API_PATH, { cache: 'no-store' });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: `HTTP status ${response.status}` }));
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const apiData = result.data as any;

        const balance = apiData.Balance ?? apiData.balance ?? 0;
        const equity = apiData.Equity ?? apiData.equity ?? 0;
        const margin = apiData.Margin ?? apiData.MarginUsed ?? apiData.marginUsed ?? 0;
        const freeMargin = apiData.FreeMargin ?? apiData.freeMargin ?? 0;
        const totalPL = equity - balance;

        const newBalanceData: BalanceData = {
          balance: balance,
          equity: equity,
          margin: margin,
          freeMargin: freeMargin,
          marginLevel: apiData.MarginLevel ?? apiData.marginLevel ?? 0,
          profit: apiData.profit ?? apiData.profit ?? 0,
          leverage: apiData.Leverage ?? apiData.leverage ?? "1:200",
          totalPL: parseFloat(totalPL.toFixed(2)),
          name: apiData.Name ?? apiData.name ?? 'Test',
          accountGroup: (apiData.Group ?? apiData.group ?? 'Standard').split('\\').pop()?.toLowerCase() || 'standard',
          accountType: (apiData.AccountType === 'Live' || apiData.accountType === 'Live') ? 'Live' : 'Demo',
        };

        setBalances(prev => ({ ...prev, [accountId]: newBalanceData }));
        setErrors(prev => ({ ...prev, [accountId]: null }));
      } else {
        throw new Error(result.error || "Failed to load account data.");
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

      // Set up polling interval for all accounts
      intervalRef.current = setInterval(() => {
        accountIdsRef.current.forEach(accountId => {
          fetchAccountBalance(accountId, false);
        });
      }, 6000);
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [accountIds.length]); // Only depend on length, not the function or array

  return { balances, isLoading, errors };
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
  const [leftPanelView, setLeftPanelView] = React.useState<LeftPanelView>("instruments")
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = React.useState(false)
  const [activeInstrumentTab, setActiveInstrumentTab] = React.useState("eurusd")
  // State for MT5 accounts and selected account
  const [mt5Accounts, setMt5Accounts] = React.useState<MT5Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(true);

  // Initialize account ID from localStorage or use default (first account)
  const [currentAccountId, setCurrentAccountId] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("accountId") || null;
    }
    return null;
  });

  // Effect to handle account ID changes
  React.useEffect(() => {
    if (currentAccountId) {
      localStorage.setItem("accountId", currentAccountId);
    }
  }, [currentAccountId]);

  // Fetch MT5 accounts on component mount
  React.useEffect(() => {
    const fetchMT5Accounts = async () => {
      try {
        setIsLoadingAccounts(true);
        const response = await fetch('/apis/auth/mt5-account');

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.accounts) {
            setMt5Accounts(data.data.accounts);

            // If no account is selected, use the first one as default
            if (!currentAccountId && data.data.accounts.length > 0) {
              setCurrentAccountId(data.data.accounts[0].accountId);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching MT5 accounts:', error);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchMT5Accounts();
  }, []);
  const [instrumentTabs, setInstrumentTabs] = React.useState<InstrumentTab[]>([
    { id: "eurusd", symbol: "EUR/USD", countryCode: "EU" },
    { id: "btc", symbol: "BTC", icon: <span className="text-base">₿</span> },
    { id: "us500", symbol: "US500", countryCode: "US" },
    { id: "xauusd", symbol: "XAU/USD", countryCode: "US" },
    { id: "aapl", symbol: "AAPL", icon: <span className="text-base">🍎</span> },
  ])
  const [hideBalance, setHideBalance] = React.useState(false)
  // 💥 FIX: Define the missing state for the right panel
  const [activePanel, setActivePanel] = React.useState<"order" | "settings" | "calendar">("order"); // ⬅️ NEW STATE DEFINITION

  // Hook for multiple account balances
  const accountIds = useMemo(() => mt5Accounts.map(account => account.accountId), [mt5Accounts]);
  const { balances } = useMultiAccountBalancePolling(accountIds);

  // For compatibility with existing code
  const balanceData = balances[currentAccountId || ''] || initialBalanceData;
  const isBalanceLoading = false;
  const balanceError = null;

  // State for user data
  const [userName, setUserName] = React.useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userName') || 'No User';
    }
    return 'No User';
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
              localStorage.setItem('userEmail', data.user.email);
            }
          }
        } else {
          // If not authenticated, clear stored data
          localStorage.removeItem('userName');
          localStorage.removeItem('userEmail');
          setUserName('No User');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setUserName('No User');
      } finally {
        setIsUserLoading(false);
      }
    };

    fetchUser();
  }, []);
  const formatBalanceDisplay = (value: number) =>
    isBalanceLoading
      ? "Loading..."
      : balanceError
        ? "Error"
        : hideBalance
          ? "••••••"
          : formatCurrency(value, 2);

  const displayEquity = formatBalanceDisplay(balanceData.equity);
  const displayBalance = formatBalanceDisplay(balanceData.balance);
  const displayMargin = formatBalanceDisplay(balanceData.margin);
  const displayFreeMargin = formatBalanceDisplay(balanceData.freeMargin);
  const displayMarginLevel = isBalanceLoading
    ? "Loading..."
    : balanceError
      ? "Error"
      : hideBalance
        ? "••••••"
        : `${balanceData.marginLevel.toFixed(2)} %`;

  const displayTotalPL = formatBalanceDisplay(balanceData.totalPL);
  const [instruments, setInstruments] = useAtom(instrumentsAtom)
  const [isPositionsCollapsed] = useAtom(positionsIsCollapsedAtom)

  // NEW STATE for loading status and total count (Chunking/Batching state)
  const [totalSymbolsCount, setTotalSymbolsCount] = React.useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = React.useState(true);
  const [isFetchingBackground, setIsFetchingBackground] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
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

  const [openTabs] = useAtom(openTabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  const [, addTab] = useAtom(addTabAtom)
  const [, removeTab] = useAtom(removeTabAtom)


   // --- EFFECT 1: INITIAL LOAD (Cache Check or First Chunk) - RE-INTRODUCED ---
  React.useEffect(() => {
    if (!isInitialLoadRef.current) return;
    isInitialLoadRef.current = false;

    setIsLoadingInitial(true);
    setError(null);

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
          const result = await response.json();
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
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
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error('Error fetching initial instruments:', errorMessage);
        setError(`Failed to load instruments. Error: ${errorMessage}`);
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
            console.error(`Background fetch failed at offset ${currentOffset}: ${response.status}`);
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
            console.error("Background fetch failed to load data:", result.error);
            break;
          }
        } catch (e) {
          console.error("Background fetch network error:", e);
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

  // Get selected MT5 account
  const selectedAccount = React.useMemo(() => {
    return mt5Accounts.find(account => account.accountId === currentAccountId);
  }, [mt5Accounts, currentAccountId]);


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
    const newTabs = instrumentTabs.filter((t) => t.id !== tabId)
    if (newTabs.length > 0) {
      setInstrumentTabs(newTabs)
      if (activeInstrumentTab === tabId) {
        setActiveInstrumentTab(newTabs[0].id)
      }
    }
  }

  const handleAddTab = (instrumentId: string) => {
    console.log("Add tab:", instrumentId)
    // Logic to add the new tab if it doesn't exist
    const instrument = instruments.find(i => i.id === instrumentId);
    if (instrument) {
      const newTab: InstrumentTab = {
        id: instrument.id,
        symbol: instrument.symbol,
        // countryCode is not a required property on Instrument, use a placeholder
        countryCode: "US",
      };
      if (!instrumentTabs.some(tab => tab.id === newTab.id)) {
        setInstrumentTabs([...instrumentTabs, newTab]);
      }
      setActiveInstrumentTab(newTab.id);
    }
  }

  const activeTab = React.useMemo(() => {
    return openTabs.find(tab => tab.id === activeTabId)
  }, [openTabs, activeTabId])
  const handleBuy = async (data: OrderData) => {
      try {
        // ✅ Build the payload using the current active instrument
        const order = {
          symbol: 'BTC/USD',
          side: "buy" as const,
          volume: data.volume * 100, // ⬅️ UPDATED: Volume is multiplied by 100
          orderType: data.orderType,
          openPrice: data.openPrice,
          stopLoss: data.stopLoss,
          takeProfit: data.takeProfit,
          accountId: localStorage.getItem("accountId"),
          price: data.openPrice || selectedInstrument.ask || 0,
        };

        console.log("📤 Sending BUY order:", order);

        const response = await placeMarketOrder(order);

        console.log("✅ Buy Order Success:", response);
        alert(`Buy Order Placed Successfully for ${order.symbol}!`);
      } catch (error) {
        console.error("❌ Buy Order Failed:", error);
        alert(`Buy Order Failed for ${selectedInstrument.symbol}! Check console.`);
      }
    };

    const handleSell = async (data: OrderData) => {
      try {
        // ✅ Build the payload with all required fields for backend
        const order = {
          symbol: selectedInstrument.symbol,
          side: "sell" as const,
          volume: data.volume * 100, // ⬅️ UPDATED: Volume is multiplied by 100
          orderType: data.orderType,
          openPrice: data.openPrice,
          stopLoss: data.stopLoss,
          takeProfit: data.takeProfit,
          accountId: localStorage.getItem("accountId") || "",
          price: data.openPrice || selectedInstrument.bid || 0,
        };

        console.log("📤 Sending SELL order:", order);

        // ✅ Call your API proxy
        const response = await placeMarketOrder(order);

        console.log("✅ Sell Order Success:", response);
        alert(`Sell Order Placed Successfully for ${order.symbol}!`);
      } catch (error) {
        console.error("❌ Sell Order Failed:", error);
        alert(`Sell Order Failed for ${selectedInstrument.symbol}! Check console.`);
      }
    };


  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Navbar */}
      <header className="flex items-center h-14 px-4 border-b border-white/8 bg-[#01040D] shrink-0 z-30 gap-4">
        {/* Left: Logo + Instrument Tabs */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="text-xl font-bold gradient-text shrink-0">Zuperior</h1>
          
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

        {/* Right: Account, Alerts, User, Deposit */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Account Dropdown */}
          <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors group">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white/60">
                        <span className="bg-warning/20 text-warning">Live&nbsp;&nbsp;</span>
                            {isUserLoading ? 'Loading...' : userName}
                      </span>

                    </div>
                    {/* 🚀 1A: REAL-TIME EQUITY DISPLAY IN HEADER */}
                    <span className="text-sm font-semibold text-success price-font">
                      {hideBalance ? "••••••" : formatCurrency(balanceData.equity, 2)} USD
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
                          {hideBalance ? "••••••" : formatCurrency(balanceData.balance, 2)} USD
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
                          {hideBalance ? "••••••" : formatCurrency(balanceData.equity, 2)} USD
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
                          {hideBalance ? "••••••" : formatCurrency(balanceData.margin, 2)} USD
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
                          {hideBalance ? "••••••" : formatCurrency(balanceData.freeMargin, 2)} USD
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
                          {hideBalance ? "••••••" : `${balanceData.marginLevel.toFixed(2)} %`}
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-white/40" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Equity / Margin × 100%</p>
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

                  <Button className="w-full" variant="outline">
                    Top Up
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
                                  // 'Live' === 'Live'
                                  "bg-warning/20 text-warning"
                                  // : "bg-success/20 text-success"
                              )}>
                                {/* {balanceData.accountType} */}
                                Live
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
                                    ? "••••••"
                                    : `${formatCurrency(balances[account.accountId]?.equity || 0, 2)} USD`
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
                    <button className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-white/5 rounded transition-colors group">
                      <span className="text-white/80 group-hover:text-white">Manage Accounts</span>
                      <ChevronDown className="h-4 w-4 text-white/40 -rotate-90" />
                    </button>
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
                    <span className="font-mono">f****0@gmail.com</span>
                  </div>
                </div>
                <Separator />
                <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded transition-colors group">
                  <LifeBuoy className="h-4 w-4 text-white/60 group-hover:text-white" />
                  <span className="text-white/80 group-hover:text-white">Support</span>
                </button>
                <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded transition-colors group">
                  <Lightbulb className="h-4 w-4 text-white/60 group-hover:text-white" />
                  <span className="text-white/80 group-hover:text-white">Suggest a feature</span>
                </button>
                <Separator />
                <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded transition-colors text-danger group">
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Deposit Button */}
          <Button size="lg" className="ml-2">
            Deposit
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
                        onSelectInstrument={(id) => console.log("Selected:", id)} 
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
                  openPositions={mockOpenPositions}
                  pendingPositions={[]}
                  closedPositions={[]}
                  onClose={(id) => console.log("Close position:", id)}
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
                    onBuy={handleBuy}
                    onSell={handleSell}
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
                  {hideBalance ? "••••••" : formatCurrency(balanceData.equity, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Free Margin:</span>
                <span className="text-xs font-semibold text-white price-font">
                  {hideBalance ? "••••••" : formatCurrency(balanceData.freeMargin, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Balance:</span>
                <span className="text-xs font-semibold text-white price-font">
                  {hideBalance ? "••••••" : formatCurrency(balanceData.balance, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60"> </span>
                <span className="text-xs font-semibold text-white price-font">
                  {hideBalance ? "••••••" : formatCurrency(balanceData.margin, 2)} USD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Margin level:</span>
                <span className="text-xs font-semibold text-white price-font">
                    {hideBalance ? "••••••" : `${balanceData.marginLevel.toFixed(2)} %`}
                </span>
              </div>
            </div>

            {/* Right: Total P/L and Close All */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Total P/L, USD:</span>
                <span className="text-sm font-semibold text-success price-font">
                  {hideBalance ? "••••••" : `${balanceData.totalPL.toFixed(2)} USD`}
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

