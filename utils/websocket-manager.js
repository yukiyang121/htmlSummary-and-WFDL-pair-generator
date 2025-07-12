/**
 * (HTMLsummary, WDFL) generater - WebSocket Manager
 * Centralized WebSocket connection management
 */

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.heartbeatInterval = null;
    this.logger = new Logger('WebSocketManager');
    this.extensionId = chrome.runtime.id;
    this.connectionPromise = null;

    // Event listeners
    this.eventListeners = {
      open: [],
      close: [],
      error: [],
      message: []
    };
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise<boolean>} Connection success status
   */
  async connect() {
    if (this.isConnected) {
      this.logger.warn('Already connected to WebSocket');
      return true;
    }

    if (this.connectionPromise) {
      this.logger.info('Connection already in progress');
      return this.connectionPromise;
    }

    this.connectionPromise = this._attemptConnection();
    return this.connectionPromise;
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (!this.isConnected || !this.ws) {
      this.logger.warn('Not connected to WebSocket');
      return;
    }

    this.logger.info('Disconnecting from WebSocket');

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close connection
    this.ws.close(1000, 'User requested disconnect');
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Send a message through the WebSocket
   * @param {object} message - The message to send
   * @returns {boolean} Whether the message was sent successfully
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      this.logger.error('Cannot send message: not connected');
      return false;
    }

    try {
      const messageString = JSON.stringify(message);
      this.ws.send(messageString);
      this.logger.debug('Message sent', { type: message.type });
      return true;
    } catch (error) {
      this.logger.error('Error sending message', { error: error.message });
      return false;
    }
  }

  /**
   * Add an event listener
   * @param {string} event - The event type ('open', 'close', 'error', 'message')
   * @param {function} callback - The callback function
   */
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    } else {
      this.logger.warn(`Unknown event type: ${event}`);
    }
  }

  /**
   * Remove an event listener
   * @param {string} event - The event type
   * @param {function} callback - The callback function to remove
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      const index = this.eventListeners[event].indexOf(callback);
      if (index > -1) {
        this.eventListeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Get connection status
   * @returns {object} Connection status information
   */
  getStatus() {
    return {
      connected: this.isConnected,
      extensionId: this.extensionId,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.ws ? this.ws.readyState : null
    };
  }

  /**
   * Attempt to establish WebSocket connection
   * @returns {Promise<boolean>} Connection success status
   */
  async _attemptConnection() {
    return new Promise((resolve, reject) => {
      try {
        // Use production URL by default, fallback to dev URL for local development
        const wsUrl = CONFIG.websocket.prodUrl || CONFIG.websocket.devUrl;
        this.logger.info('Connecting to WebSocket', { url: wsUrl });

        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          this.logger.error('Connection timeout');
          this.ws.close();
          reject(new Error('Connection timeout'));
        }, CONFIG.websocket.connectionTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.logger.info('WebSocket connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.connectionPromise = null;

          // Register with server
          this._registerExtension();

          // Start heartbeat
          this._startHeartbeat();

          // Notify listeners
          this._emitEvent('open');

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this._handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.logger.info('WebSocket connection closed', {
            code: event.code,
            reason: event.reason
          });

          this.isConnected = false;
          this.connectionPromise = null;

          // Clear heartbeat
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }

          // Notify listeners
          this._emitEvent('close', event);

          // Attempt reconnection if not a clean disconnect
          if (event.code !== 1000) {
            this._attemptReconnection();
          }

          resolve(false);
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          this.logger.error('WebSocket error', { error });
          this.isConnected = false;
          this.connectionPromise = null;

          // Notify listeners
          this._emitEvent('error', error);

          reject(error);
        };

      } catch (error) {
        this.logger.error('Failed to create WebSocket connection', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Register extension with the server
   */
  _registerExtension() {
    const registrationMessage = {
      type: 'register',
      id: this.extensionId,
      timestamp: new Date().toISOString()
    };

    this.send(registrationMessage);
  }

  /**
   * Start heartbeat mechanism
   */
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'heartbeat',
          id: this.extensionId,
          timestamp: new Date().toISOString()
        });
      }
    }, CONFIG.websocket.heartbeatInterval);
  }

  /**
   * Handle incoming WebSocket messages
   * @param {string} data - The message data
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data);
      this.logger.debug('Received message', { type: message.type });

      // Handle system messages
      if (message.type === 'registered') {
        this.logger.info('Successfully registered with server');
      } else if (message.type === 'heartbeat_ack') {
        this.logger.debug('Heartbeat acknowledged');
      } else if (message.type === 'error') {
        this.logger.error('Server error', { message: message.message });
      }

      // Notify listeners
      this._emitEvent('message', message);

    } catch (error) {
      this.logger.error('Error parsing message', { error: error.message });
    }
  }

  /**
   * Attempt to reconnect after connection loss
   */
  _attemptReconnection() {
    if (this.reconnectAttempts >= CONFIG.websocket.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`Attempting reconnection (${this.reconnectAttempts}/${CONFIG.websocket.maxReconnectAttempts})`);

    setTimeout(() => {
      if (!this.isConnected) {
        this.connect().catch(error => {
          this.logger.error('Reconnection failed', { error: error.message });
        });
      }
    }, CONFIG.websocket.reconnectDelay);
  }

  /**
   * Emit event to all listeners
   * @param {string} event - The event type
   * @param {*} data - The event data
   */
  _emitEvent(event, data = null) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.logger.error('Error in event listener', { event, error: error.message });
        }
      });
    }
  }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketManager;
} else {
  window.WebSocketManager = WebSocketManager;
}
