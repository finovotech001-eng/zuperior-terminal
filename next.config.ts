/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
  // Production optimizations (swcMinify is enabled by default in Next.js 15)
  compress: true,
  poweredByHeader: false,
  
  // Improve HMR reliability (dev only)
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  
  // Exclude large files from build tracing (charting library is static)
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-*',
      'node_modules/@esbuild/**/*',
      'node_modules/esbuild/**/*',
      'node_modules/webpack/**/*',
      'public/charting_library/**/*',
      'public/datafeeds/**/*',
    ],
  },
  
  // Optimize static file serving
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  webpack: (config, { isServer, dev }) => {
    // Exclude browser-only files from server-side bundling
    if (isServer) {
      const webpack = require('webpack');
      config.plugins = config.plugins || [];
      
      // Ignore datafeed files completely
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /datafeeds\/(custom-datafeed|signalr-datafeed)\.js$/,
        })
      );
      
      // Ignore TradingView charting library bundles (they use 'self' which doesn't exist in Node.js)
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /charting_library\/(bundles|charting_library\..*\.js)$/,
        })
      );
      
      // Mark chart-container and SignalR as external for server builds (prevents bundling)
      config.externals = config.externals || [];
      const externalsConfig: any = {
        '@/components/chart/chart-container': 'commonjs @/components/chart/chart-container',
        './chart/chart-container': 'commonjs ./chart/chart-container',
        '../chart/chart-container': 'commonjs ../chart/chart-container',
        '@microsoft/signalr': 'commonjs @microsoft/signalr', // Exclude SignalR from server bundles
      };
      
      if (Array.isArray(config.externals)) {
        config.externals.push(externalsConfig);
      } else if (typeof config.externals === 'object') {
        Object.assign(config.externals, externalsConfig);
      } else {
        config.externals = [config.externals, externalsConfig];
      }
      
      // Set aliases to false to prevent imports
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/components/chart/chart-container': false,
        '@/datafeeds/custom-datafeed.js': false,
        '@/datafeeds/signalr-datafeed.js': false,
        '/datafeeds/custom-datafeed.js': false,
        '/datafeeds/signalr-datafeed.js': false,
        '/charting_library': false,
      };
      
      const path = require('path');
      
      // Note: SignalR polyfills are handled via direct imports in API routes and hooks
      // We don't inject polyfills at the webpack level as it breaks the runtime
      
      // Replace chart-container module with stub during server build to prevent 'self' errors
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /components[\\/]chart[\\/]chart-container|chart-container/,
          path.resolve(__dirname, 'lib/chart-stub.ts')
        )
      );
      
      // Also prevent any dynamic imports from resolving to the real file
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@/components/chart/chart-container': false,
      };
    }
    
    // Production optimizations (client only)
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    if (!isServer && dev) {
      // Development HMR optimizations
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    
    return config;
  },
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/favicon-32x32.png',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
