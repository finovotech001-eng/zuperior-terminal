/**
 * TradingView Charting Library type definitions
 */

interface TradingViewWidgetOptions {
  debug?: boolean;
  fullscreen?: boolean;
  symbol?: string;
  interval?: string;
  container?: HTMLElement;
  library_path?: string;
  locale?: string;
  disabled_features?: string[];
  enabled_features?: string[];
  overrides?: Record<string, any>;
  theme?: string;
  charts_storage_url?: string;
  charts_storage_api_version?: string;
  client_id?: string;
  user_id?: string;
  autosize?: boolean;
  datafeed?: any;
}

interface TradingViewWidget {
  onChartReady(callback: () => void): void;
  setSymbol(symbol: string, interval: string, callback?: () => void): void;
  remove(): void;
}

interface TradingView {
  widget: (options: TradingViewWidgetOptions) => TradingViewWidget;
}

declare global {
  interface Window {
    TradingView?: TradingView;
  }
}

