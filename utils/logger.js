/**
 * (HTMLsummary, WDFL) generater - Centralized Logger
 * Provides consistent logging functionality across the extension
 */

class Logger {
  constructor(context = 'Extension') {
    this.context = context;
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    this.currentLevel = this.logLevels.info;
  }

  /**
   * Set the logging level
   * @param {string} level - The logging level ('debug', 'info', 'warn', 'error')
   */
  setLevel(level) {
    if (this.logLevels.hasOwnProperty(level)) {
      this.currentLevel = this.logLevels[level];
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {object} data - Additional data to log
   */
  debug(message, data = null) {
    this._log('debug', message, data);
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {object} data - Additional data to log
   */
  info(message, data = null) {
    this._log('info', message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {object} data - Additional data to log
   */
  warn(message, data = null) {
    this._log('warn', message, data);
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {object} data - Additional data to log
   */
  error(message, data = null) {
    this._log('error', message, data);
  }

  /**
   * Internal logging method
   * @param {string} level - The logging level
   * @param {string} message - The message to log
   * @param {object} data - Additional data to log
   */
  _log(level, message, data = null) {
    if (this.logLevels[level] < this.currentLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.context}] [${level.toUpperCase()}] ${message}`;

    // Console logging
    const consoleMethod = level === 'error' ? console.error :
                         level === 'warn' ? console.warn :
                         level === 'debug' ? console.debug :
                         console.log;

    if (data) {
      consoleMethod(logMessage, data);
    } else {
      consoleMethod(logMessage);
    }

    // UI logging (for popup)
    if (typeof window !== 'undefined' && window.logToUI) {
      window.logToUI(message, level, data);
    }
  }

  /**
   * Create a child logger with a specific context
   * @param {string} context - The context for the child logger
   * @returns {Logger} A new logger instance
   */
  child(context) {
    const childLogger = new Logger(`${this.context}:${context}`);
    childLogger.setLevel(Object.keys(this.logLevels).find(key => this.logLevels[key] === this.currentLevel));
    return childLogger;
  }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
} else {
  window.Logger = Logger;
}
