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
    ],
  },
  
  // Optimize static file serving
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Improve chunk loading reliability and optimize production builds
  webpack: (config, { isServer, dev }) => {
    // Exclude datafeed files from server-side bundling (browser-only)
    if (isServer) {
      // Use IgnorePlugin to completely ignore datafeed files during server build
      const webpack = require('webpack');
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /datafeeds\/(custom-datafeed|signalr-datafeed)\.js$/,
        })
      );
      
      // Also set alias to false to prevent any imports
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/datafeeds/custom-datafeed.js': false,
        '@/datafeeds/signalr-datafeed.js': false,
      };
    }
    
    // Production optimizations
    if (!dev) {
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
