/**
 * （HTMLsummary, WDFL) generater Configuration
 * Centralized configuration for the Chrome extension
 */

const CONFIG = {
  // WebSocket connection settings
  websocket: {
    // Production WebSocket URL
    prodUrl: 'wss://wfdl-validator-worker.webflowlabs.workers.dev/ws',
    // Development WebSocket URL (fallback)
    devUrl: 'ws://localhost:8787/ws',

    // Connection settings
    reconnectDelay: 2000,
    heartbeatInterval: 30000,
    connectionTimeout: 5000,
    maxReconnectAttempts: 3
  },

  // Webflow Designer URL patterns
  designerUrls: {
    patterns: [
      "https://webflow.com/*",
      "https://*.webflow.com/*",
      "https://*.design.webflow.com/*",
      "https://*.wfdev.io/*",
      "https://*.design.wfdev.io/*"
    ],
    // Helper function to check if URL is a designer page
    isDesignerPage: (url) => {
      return url.includes('.design.webflow.com') ||
             url.includes('.design.wfdev.io') ||
             url.includes('.wfdev.io');
    }
  },

  // Extension settings
  extension: {
    name: 'HTMLsummary, WDFL) generater',
    version: '1.0.3',
    defaultTestWfdl: 'this is a simple string test;'
  },

  // Logging configuration
  logging: {
    enabled: true,
    level: 'info', // 'debug', 'info', 'warn', 'error'
    maxLogEntries: 100
  },

  // UI settings
  ui: {
    popup: {
      width: 450,
      height: 600
    },
    activityLog: {
      maxHeight: 200,
      maxEntries: 50
    }
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else {
  window.CONFIG = CONFIG;
}
