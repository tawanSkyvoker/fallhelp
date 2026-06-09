// Polyfill TextEncoder/TextDecoder for jsdom
// This runs via setupFiles (before test env), so Node.js globals are available
const { TextEncoder, TextDecoder } = require('util');
Object.assign(globalThis, { TextEncoder, TextDecoder });
