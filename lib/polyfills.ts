// Polyfills for Node.js environment
// This file is imported in server-side code to ensure 'self' is available
// CRITICAL: This must run before any SignalR code executes

// Set 'self' globally in Node.js where it doesn't exist
if (typeof globalThis !== 'undefined') {
  // @ts-ignore
  globalThis.self = globalThis;
} else if (typeof global !== 'undefined') {
  // @ts-ignore
  global.self = global;
}

// Also define it on the module.exports for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  // @ts-ignore
  module.exports.self = globalThis || global || {};
}

export {};

