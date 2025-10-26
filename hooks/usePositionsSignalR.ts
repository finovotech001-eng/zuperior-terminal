"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import wsManager from '@/lib/websocket-service';

export interface SignalRPosition {
  id: string;
  ticket: number;
  positionId?: number;
  symbol: string;
  type: 'Buy' | 'Sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  openTime: string;
  swap: number;
  profit: number;
  commission: number;
  comment?: string;
}

interface UsePositionsSignalRProps {
  accountId: string | null;
  enabled?: boolean;
}

interface UsePositionsSignalRReturn {
  positions: SignalRPosition[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => void;
}

// Prefer explicit trading hub URL if provided, else default to the local hub
const SIGNALR_HUB_URL = (process.env.NEXT_PUBLIC_TRADING_HUB_URL
  || (process.env.NEXT_PUBLIC_API_BASE_URL && `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/hubs/mobiletrading`)
  || 'http://18.130.5.209:5003/hubs/mobiletrading');
const RECONNECT_DELAY = 5000; // 5 seconds
const UPDATE_INTERVAL = 300; // 300ms for position updates

export function usePositionsSignalR({
  accountId,
  enabled = true
}: UsePositionsSignalRProps): UsePositionsSignalRReturn {
  const [positions, setPositions] = useState<SignalRPosition[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Authenticate and get access token
  const authenticate = useCallback(async (accId: string) => {
    try {
      console.log(`dY"? Authenticating for account: ${accId}`);
      
      const response = await fetch('/apis/auth/mt5-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId: accId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Authentication failed');
      }

      const data = await response.json();
      
      if (!data.success || !data.data.accessToken) {
        throw new Error('No access token received');
      }

      console.log(` Authentication successful for account: ${accId}`);
      return data.data.accessToken as string;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      console.error(' Authentication error:', errorMessage);
      throw err;
    }
  }, []);

  // Connect to SignalR
  const connect = useCallback(async (token: string, accId: string) => {
    try {
      if (connectionRef.current) {
        await connectionRef.current.stop();
        connectionRef.current = null;
      }

      setIsConnecting(true);
      setError(null);

      console.log(`dY"O Connecting to SignalR hub for account: ${accId}`);

      // Build hub URL with query params
      const qp = new URLSearchParams({
        accountId: accId,
        clientVersion: '1.0.0',
        clientPlatform: 'ReactNative',
        deviceId: `web-${Date.now()}`,
      }).toString();
      const hubUrl = `${SIGNALR_HUB_URL}?${qp}`;

      // Create SignalR connection
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => token || '',
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          withCredentials: false,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: () => RECONNECT_DELAY
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Set up event handlers
      connection.on('PositionUpdate', (data: any) => {
        if (!isMountedRef.current) return;
        
        console.log('dY"S Position update received:', data);
        
        // Handle position update
        if (Array.isArray(data)) {
          const formattedPositions = data.map((pos: any) => ({
            id: (pos.PositionId ?? pos.PositionID ?? pos.Ticket ?? pos.ticket ?? pos.Id ?? pos.id ?? Math.random()).toString(),
            ticket: Number(pos.Ticket ?? pos.ticket ?? pos.PositionId ?? pos.PositionID ?? 0) || 0,
            positionId: Number(pos.PositionId ?? pos.PositionID ?? 0) || undefined,
            symbol: pos.Symbol || pos.symbol || '',
            type: (pos.Type === 0 || pos.type === 0 || pos.Type === 'Buy' || pos.type === 'Buy') ? 'Buy' : 'Sell',
            volume: pos.Volume || pos.volume || 0,
            openPrice: pos.OpenPrice || pos.openPrice || pos.PriceOpen || pos.priceOpen || 0,
            currentPrice: pos.PriceCurrent || pos.priceCurrent || pos.CurrentPrice || pos.currentPrice || 0,
            takeProfit: pos.TakeProfit || pos.takeProfit || pos.TP || pos.tp || undefined,
            stopLoss: pos.StopLoss || pos.stopLoss || pos.SL || pos.sl || undefined,
            openTime: pos.TimeSetup || pos.timeSetup || pos.OpenTime || pos.openTime || new Date().toISOString(),
            swap: pos.Swap || pos.swap || 0,
            profit: pos.Profit || pos.profit || 0,
            commission: pos.Commission || pos.commission || 0,
            comment: pos.Comment || pos.comment || undefined,
          }));
          
          setPositions(formattedPositions);
        } else if (data && typeof data === 'object') {
          // Single position update
          const formattedPosition: SignalRPosition = {
            id: (data.PositionId ?? data.PositionID ?? data.Ticket ?? data.ticket ?? data.Id ?? data.id ?? Math.random()).toString(),
            ticket: Number(data.Ticket ?? data.ticket ?? data.PositionId ?? data.PositionID ?? 0) || 0,
            positionId: Number(data.PositionId ?? data.PositionID ?? 0) || undefined,
            symbol: data.Symbol || data.symbol || '',
            type: (data.Type === 0 || data.type === 0 || data.Type === 'Buy' || data.type === 'Buy') ? 'Buy' : 'Sell',
            volume: data.Volume || data.volume || 0,
            openPrice: data.OpenPrice || data.openPrice || data.PriceOpen || data.priceOpen || 0,
            currentPrice: data.PriceCurrent || data.priceCurrent || data.CurrentPrice || data.currentPrice || 0,
            takeProfit: data.TakeProfit || data.takeProfit || data.TP || data.tp || undefined,
            stopLoss: data.StopLoss || data.stopLoss || data.SL || data.sl || undefined,
            openTime: data.TimeSetup || data.timeSetup || data.OpenTime || data.openTime || new Date().toISOString(),
            swap: data.Swap || data.swap || 0,
            profit: data.Profit || data.profit || 0,
            commission: data.Commission || data.commission || 0,
            comment: data.Comment || data.comment || undefined,
          };
          
          setPositions(prev => {
            const index = prev.findIndex(p => p.id === formattedPosition.id);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = formattedPosition;
              return updated;
            }
            return [...prev, formattedPosition];
          });
        }
      });

      connection.on('PositionClosed', (data: any) => {
        if (!isMountedRef.current) return;
        
        console.log('dY"S Position closed:', data);
        const ticketToRemove = Number(data.Ticket ?? data.ticket ?? data.PositionId ?? data.PositionID ?? data);
        if (!ticketToRemove) return;
        setPositions(prev => prev.filter(p => p.ticket !== ticketToRemove));
      });

      connection.on('PositionOpened', (data: any) => {
        if (!isMountedRef.current) return;
        
        console.log('dYYS Position opened:', data);
        // Trigger a positions refresh
        connection.invoke('GetPositions').catch(err => {
          console.error('Error fetching positions after open:', err);
        });
      });

      connection.onreconnecting(() => {
        if (!isMountedRef.current) return;
        console.log('dY", SignalR reconnecting...');
        setIsConnecting(true);
        setIsConnected(false);
      });

      connection.onreconnected(() => {
        if (!isMountedRef.current) return;
        console.log('\u000e SignalR reconnected');
        setIsConnecting(false);
        setIsConnected(true);
        setError(null);
        
        // Re-subscribe to positions
        connection.invoke('GetPositions').catch(err => {
          console.error('Error fetching positions after reconnect:', err);
        });
      });

      connection.onclose((err) => {
        if (!isMountedRef.current) return;
        console.log('\u000f SignalR connection closed', err);
        setIsConnected(false);
        setIsConnecting(false);
        
        if (err) {
          setError(err.message || 'Connection closed');
          // Try to reconnect after delay
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && accountId) {
              console.log('dY", Attempting to reconnect...');
              reconnect();
            }
          }, RECONNECT_DELAY);
        }
      });

      // Start connection
      await connection.start();
      console.log('\u000e SignalR connected successfully');
      
      connectionRef.current = connection;
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      // Subscribe to positions
      await connection.invoke('SubscribeToPositions');
      console.log('dY"S Subscribed to positions');

      // Get initial positions
      await connection.invoke('GetPositions');
      console.log('dY"S Requested initial positions');

      // Set up periodic position updates (every 300ms)
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      
      updateIntervalRef.current = setInterval(() => {
        if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
          connectionRef.current.invoke('GetPositions').catch(err => {
            console.error('Error in periodic position update:', err);
          });
        }
      }, UPDATE_INTERVAL);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      console.error('\u000f SignalR connection error:', errorMessage);
      setError(errorMessage);
      setIsConnecting(false);
      setIsConnected(false);
      
      // Try to reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && accountId) {
          console.log('dY", Attempting to reconnect after error...');
          reconnect();
        }
      }, RECONNECT_DELAY);
    }
  }, [accountId]);

  // Reconnect function
  const reconnect = useCallback(() => {
    if (!accountId) return;
    
    console.log('dY", Reconnecting...');
    setError(null);
    
    // Re-authenticate and connect
    authenticate(accountId)
      .then(token => {
        setAccessToken(token);
        try { wsManager.setToken(token) } catch {}
        return connect(token, accountId);
      })
      .catch(err => {
        console.error('\u000f Reconnect failed:', err);
        setError(err instanceof Error ? err.message : 'Reconnection failed');
      });
  }, [accountId, authenticate, connect]);

  // Initial connection effect
  useEffect(() => {
    if (!enabled || !accountId) {
      // Clean up if disabled or no account
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      setPositions([]);
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    // Authenticate and connect
    authenticate(accountId)
      .then(token => {
        setAccessToken(token);
        try { wsManager.setToken(token) } catch {}
        return connect(token, accountId);
      })
      .catch(err => {
        console.error('\u000f Initial connection failed:', err);
        setError(err instanceof Error ? err.message : 'Connection failed');
        setIsConnecting(false);
      });

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      
      if (connectionRef.current) {
        console.log('dY"O Disconnecting SignalR...');
        connectionRef.current.stop().catch(err => {
          console.error('Error stopping connection:', err);
        });
        connectionRef.current = null;
      }
    };
  }, [accountId, enabled, authenticate, connect]);

  // Reset mounted flag on mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    positions,
    isConnected,
    isConnecting,
    error,
    reconnect
  };
}
