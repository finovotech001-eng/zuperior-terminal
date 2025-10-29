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
      
      // Build hub URL - use original HTTP URL
      const hubUrl = `${SIGNALR_HUB_URL}?${qp}`;

      // Create SignalR connection using a custom HTTP client that proxies negotiate requests
      // This avoids CORS issues by routing negotiate through our Next.js API
      class ProxyHttpClient extends signalR.HttpClient {
        get(url: string, options?: signalR.HttpRequest): Promise<signalR.HttpResponse> {
          // If this is a negotiate request, route it through our proxy
          if (url.includes('/negotiate')) {
            const urlObj = new URL(url);
            const proxyUrl = `/apis/signalr/negotiate?hub=mobiletrading&${urlObj.searchParams.toString()}`;
            console.log('[SignalR] Proxying negotiate request to:', proxyUrl);
            
            return fetch(proxyUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options?.headers,
              },
            }).then(async (response) => {
              const data = await response.json();
              return new signalR.HttpResponse(
                response.status,
                response.statusText,
                JSON.stringify(data)
              );
            });
          }
          
          // For non-negotiate requests, use fetch directly
          return fetch(url, {
            method: options?.method || 'GET',
            headers: options?.headers,
            body: options?.content,
          }).then(async (response) => {
            const content = await response.text();
            return new signalR.HttpResponse(
              response.status,
              response.statusText,
              content
            );
          });
        }

        post(url: string, options?: signalR.HttpRequest): Promise<signalR.HttpResponse> {
          return fetch(url, {
            method: 'POST',
            headers: options?.headers,
            body: options?.content,
          }).then(async (response) => {
            const content = await response.text();
            return new signalR.HttpResponse(
              response.status,
              response.statusText,
              content
            );
          });
        }

        delete(url: string, options?: signalR.HttpRequest): Promise<signalR.HttpResponse> {
          return fetch(url, {
            method: 'DELETE',
            headers: options?.headers,
          }).then(async (response) => {
            const content = await response.text();
            return new signalR.HttpResponse(
              response.status,
              response.statusText,
              content
            );
          });
        }

        send(request: signalR.HttpRequest): Promise<signalR.HttpResponse> {
          const url = request.url || '';
          const method = request.method || 'GET';
          
          // If this is a negotiate request, route it through our proxy
          if (url.includes('/negotiate')) {
            const urlObj = new URL(url);
            const proxyUrl = `/apis/signalr/negotiate?hub=mobiletrading&${urlObj.searchParams.toString()}`;
            console.log('[SignalR] Proxying negotiate request to:', proxyUrl);
            
            return fetch(proxyUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...request.headers,
              },
            }).then(async (response) => {
              const data = await response.json();
              return new signalR.HttpResponse(
                response.status,
                response.statusText,
                JSON.stringify(data)
              );
            });
          }
          
          // For other requests, use fetch directly
          return fetch(url, {
            method: method,
            headers: request.headers,
            body: request.content,
          }).then(async (response) => {
            const content = await response.text();
            return new signalR.HttpResponse(
              response.status,
              response.statusText,
              content
            );
          });
        }
      }

      // Create SignalR connection
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => token || '',
          httpClient: new ProxyHttpClient(),
          transport: signalR.HttpTransportType.LongPolling, // Use LongPolling to avoid mixed content issues on HTTPS
          withCredentials: false,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: () => RECONNECT_DELAY
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Helper to format positions
      const formatSinglePosition = (pos: any): SignalRPosition => ({
        id: (pos.PositionId ?? pos.PositionID ?? pos.Ticket ?? pos.ticket ?? pos.Id ?? pos.id ?? Math.random()).toString(),
        ticket: Number(pos.Ticket ?? pos.ticket ?? pos.PositionId ?? pos.PositionID ?? 0) || 0,
        positionId: Number(pos.PositionId ?? pos.PositionID ?? 0) || undefined,
        symbol: pos.Symbol || pos.symbol || '',
        type: (pos.Type === 0 || pos.type === 0 || pos.Type === 'Buy' || pos.type === 'Buy') ? 'Buy' as const : 'Sell' as const,
        volume: pos.Volume || pos.volume || 0,
        openPrice: pos.OpenPrice || pos.openPrice || pos.PriceOpen || pos.priceOpen || 0,
        currentPrice: pos.PriceCurrent ?? pos.priceCurrent ?? pos.CurrentPrice ?? pos.currentPrice ?? 0,
        takeProfit: pos.TakeProfit || pos.takeProfit || pos.TP || pos.tp || undefined,
        stopLoss: pos.StopLoss || pos.stopLoss || pos.SL || pos.sl || undefined,
        openTime: pos.TimeSetup || pos.timeSetup || pos.OpenTime || pos.openTime || new Date().toISOString(),
        swap: pos.Swap || pos.swap || 0,
        profit: pos.Profit || pos.profit || 0,
        commission: pos.Commission || pos.commission || 0,
        comment: pos.Comment || pos.comment || undefined,
      });

      const formatPositions = (data: any): SignalRPosition[] => {
        if (Array.isArray(data)) {
          return data.map((pos: any) => formatSinglePosition(pos));
        } else if (data && typeof data === 'object') {
          return [formatSinglePosition(data)];
        }
        return [];
      };

      // Handle position updates - listen to multiple event names
      const handlePositionUpdate = (data: any, eventName: string) => {
        if (!isMountedRef.current) return;
        
        console.log(`[SignalR] ${eventName} received:`, data);
        
        const formattedPositions = formatPositions(data);
        
        if (Array.isArray(data)) {
          // Full list replacement
          setPositions(formattedPositions);
        } else {
          // Single position update
          const formattedPosition = formattedPositions[0];
          if (formattedPosition) {
            setPositions(prev => {
              const index = prev.findIndex(p => p.id === formattedPosition.id || p.ticket === formattedPosition.ticket);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = formattedPosition;
                return updated;
              }
              return [...prev, formattedPosition];
            });
          }
        }
      };

      // Register handlers for all possible event names
      connection.on('PositionUpdate', (data: any) => handlePositionUpdate(data, 'PositionUpdate'));
      connection.on('positions', (data: any) => handlePositionUpdate(data, 'positions'));
      connection.on('Positions', (data: any) => handlePositionUpdate(data, 'Positions'));
      connection.on('PositionsUpdate', (data: any) => handlePositionUpdate(data, 'PositionsUpdate'));

      connection.on('PositionClosed', (data: any) => {
        if (!isMountedRef.current) return;
        
        console.log('dY"S Position closed:', data);
        const ticketToRemove = Number(data.Ticket ?? data.ticket ?? data.PositionId ?? data.PositionID ?? data);
        if (!ticketToRemove) return;
        setPositions(prev => prev.filter(p => p.ticket !== ticketToRemove));
      });

      connection.on('PositionOpened', async (data: any) => {
        if (!isMountedRef.current) return;
        
        console.log('✅ Position opened:', data);
        // Trigger a positions refresh
        try {
          const positions = await tryInvokeWithResult(
            'GetPositions',
            'GetOpenPositions',
            ['GetPositionsByAccount', accId],
          );
          if (positions) {
            const formatted = formatPositions(positions);
            if (formatted.length > 0) {
              setPositions(formatted);
            }
          }
        } catch (err) {
          console.error('Error fetching positions after open:', err);
        }
      });

      connection.onreconnecting(() => {
        if (!isMountedRef.current) return;
        console.log('dY", SignalR reconnecting...');
        setIsConnecting(true);
        setIsConnected(false);
      });

      connection.onreconnected(async () => {
        if (!isMountedRef.current) return;
        console.log('✅ SignalR reconnected');
        setIsConnecting(false);
        setIsConnected(true);
        setError(null);
        
        // Re-subscribe and fetch positions after reconnect
        try {
          // Helper functions defined below - they'll be available in closure
          const reconnectTryInvoke = async (...candidates: Array<string | [string, ...any[]]>): Promise<boolean> => {
            for (const c of candidates) {
              try {
                if (Array.isArray(c)) {
                  await connection.invoke(c[0], ...c.slice(1));
                } else {
                  await connection.invoke(c);
                }
                return true;
              } catch (err) {
                console.log(`❌ Reconnect failed for: ${Array.isArray(c) ? c[0] : c}`);
              }
            }
            return false;
          };

          const reconnectTryInvokeWithResult = async (...candidates: Array<string | [string, ...any[]]>): Promise<any> => {
            for (const c of candidates) {
              try {
                let res: any;
                if (Array.isArray(c)) {
                  res = await connection.invoke(c[0], ...c.slice(1));
                } else {
                  res = await connection.invoke(c);
                }
                return res;
              } catch (err) {
                console.log(`❌ Reconnect fetch failed for: ${Array.isArray(c) ? c[0] : c}`);
              }
            }
            return null;
          };

          // Try setting account again
          await reconnectTryInvoke(
            ['SetAccountId', accId],
            ['SelectAccount', accId],
            ['SetLogin', parseInt(accId, 10)],
            ['SetLogin', accId],
          );
          
          // Try subscribing again
          await reconnectTryInvoke(
            'SubscribeToPositions',
            'SubscribePositions',
            ['SubscribeToPositions', accId],
          );
          
          // Try fetching positions
          const positions = await reconnectTryInvokeWithResult(
            'GetPositions',
            'GetOpenPositions',
            ['GetPositionsByAccount', accId],
          );
          
          if (positions) {
            const formatted = formatPositions(positions);
            if (formatted.length > 0) {
              setPositions(formatted);
            }
          }
        } catch (err) {
          console.error('Error fetching positions after reconnect:', err);
        }
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
      console.log('✅ SignalR connected successfully');
      
      connectionRef.current = connection;
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      // Helper to try multiple method names
      const tryInvoke = async (...candidates: Array<string | [string, ...any[]]>): Promise<boolean> => {
        for (const c of candidates) {
          try {
            if (Array.isArray(c)) {
              await connection.invoke(c[0], ...c.slice(1));
            } else {
              await connection.invoke(c);
            }
            console.log(`✅ Successfully called method: ${Array.isArray(c) ? c[0] : c}`);
            return true;
          } catch (err) {
            console.log(`❌ Failed to call method: ${Array.isArray(c) ? c[0] : c}`, err);
          }
        }
        return false;
      };

      const tryInvokeWithResult = async (...candidates: Array<string | [string, ...any[]]>): Promise<any> => {
        for (const c of candidates) {
          try {
            let res: any;
            if (Array.isArray(c)) {
              res = await connection.invoke(c[0], ...c.slice(1));
            } else {
              res = await connection.invoke(c);
            }
            console.log(`✅ Successfully got result from: ${Array.isArray(c) ? c[0] : c}`, res);
            return res;
          } catch (err) {
            console.log(`❌ Failed to get result from: ${Array.isArray(c) ? c[0] : c}`, err);
          }
        }
        return null;
      };

      // Set account/login after connection (required by some hubs)
      console.log('📝 Setting account/login...');
      await tryInvoke(
        ['SetAccountId', accId],
        ['SelectAccount', accId],
        ['SetLogin', parseInt(accId, 10)],
        ['SetLogin', accId],
      );

      // Small delay after setting account
      await new Promise(res => setTimeout(res, 200));

      // Subscribe to positions using multiple method names
      console.log('📡 Subscribing to positions...');
      await tryInvoke(
        'SubscribeToPositions',
        'SubscribePositions',
        'Subscribe',
        ['SubscribePositionsForAccount', accId],
        ['SubscribeToPositions', accId],
        ['SubscribeToPositionsForLogin', parseInt(accId, 10)],
        ['SubscribeToPositionsForLogin', accId],
        ['SubscribeForPositions', accId],
        ['SubscribeAccountPositions', accId],
        ['SubscribePositionsByLogin', parseInt(accId, 10)],
      );

      // Get initial positions using multiple method names
      console.log('📥 Fetching initial positions...');
      const initialPositions = await tryInvokeWithResult(
        'GetPositions',
        'GetOpenPositions',
        'Positions',
        ['GetPositionsByLogin', parseInt(accId, 10)],
        ['GetPositionsByLoginEx', parseInt(accId, 10)],
        ['GetPositionsByAccount', accId],
        ['GetAccountPositions', accId],
        'GetPositionsList',
        'OpenPositions',
        'GetTrades',
        'GetPositionsSnapshot',
        ['GetPositionsForAccount', accId],
      );

      // If we got positions from initial fetch, set them
      if (initialPositions) {
        const formatted = formatPositions(initialPositions);
        if (formatted.length > 0) {
          console.log(`✅ Received ${formatted.length} initial positions`);
          setPositions(formatted);
        }
      }

      // Set up periodic position updates (every 300ms)
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      
      updateIntervalRef.current = setInterval(async () => {
        if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
          try {
            // Try multiple method names for periodic updates
            const positions = await tryInvokeWithResult(
              'GetPositions',
              'GetOpenPositions',
              ['GetPositionsByAccount', accId],
            );
            if (positions) {
              const formatted = formatPositions(positions);
              if (formatted.length > 0) {
                setPositions(formatted);
              }
            }
          } catch (err) {
            console.error('Error in periodic position update:', err);
          }
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
