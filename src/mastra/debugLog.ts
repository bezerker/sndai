export function debugLog(...args: any[]) {
  if (process.env.DEBUG) {
    console.log(...args);
  }
} 