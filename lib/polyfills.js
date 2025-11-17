// Polyfills for Node.js environment - CommonJS version for immediate execution
// This must run synchronously before any SignalR code executes
// CRITICAL: This file uses CommonJS so it executes immediately

// Set 'self' globally in Node.js where it doesn't exist
if (typeof globalThis !== 'undefined') {
  globalThis.self = globalThis;
} else if (typeof global !== 'undefined') {
  global.self = global;
} else {
  // Fallback
  var self = {};
}

