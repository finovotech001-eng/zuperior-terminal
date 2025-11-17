// Bootstrap file to define 'self' before any SignalR code executes
// This runs before Next.js starts and ensures 'self' exists globally
// CRITICAL: Must run before any modules load
if (typeof globalThis !== 'undefined') {
  if (!globalThis.self) {
    globalThis.self = globalThis;
  }
} else if (typeof global !== 'undefined') {
  if (!global.self) {
    global.self = global;
  }
}

