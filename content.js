/**
 * (HTMLsummary, WDFL) generater - Content Script
 * Handles WFDL validation requests on Webflow Designer pages
 */

class WFDLContentScript {
  constructor() {
    this.initialized = false;
    this.logger = new Logger('ContentScript');
    this.validationExecutor = new ValidationExecutor();

    this.init();
  }

  /**
   * Initialize the content script
   */
  init() {
    if (this.initialized) return;

    this.logger.info('Initializing content script', { url: window.location.href });

    // Check if we're on a Designer page
    if (!CONFIG.designerUrls.isDesignerPage(window.location.href)) {
      this.logger.info('Not on Designer page, content script will not be active');
      return;
    }

    this.logger.info('Designer page detected, setting up message listeners');

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    this.initialized = true;
    this.logger.info('Content script initialized successfully');
  }

  /**
   * Handle messages from background script
   * @param {object} message - The message object
   * @param {object} sender - The sender information
   * @param {function} sendResponse - The response function
   */
  async handleMessage(message, sender, sendResponse) {
    this.logger.debug('Received message', { type: message.type });

    try {
      switch (message.type) {
        case 'ping':
          await this.handlePing(sendResponse);
          break;

        case 'get_wfdl':
          await this.handleGetWFDLRequest(message, sendResponse);
          break;

        case 'test_validation':
          await this.handleTestValidation(message, sendResponse);
          break;

        case 'debug_page':
          await this.handleDebugRequest(sendResponse);
          break;

        case 'get_designer_status':
          await this.handleStatusRequest(sendResponse);
          break;

        default:
          this.logger.warn('Unknown message type', { type: message.type });
          sendResponse({
            success: false,
            error: 'Unknown message type',
            timestamp: new Date().toISOString()
          });
      }
    } catch (error) {
      this.logger.error('Error handling message', {
        type: message.type,
        error: error.message
      });

      sendResponse({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle ping requests
   * @param {function} sendResponse - The response function
   */
  async handlePing(sendResponse) {
    const availability = await this.checkGetWFDLAvailability();

    sendResponse({
      success: true,
      message: 'Pong from content script',
      available: availability.available,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle get WFDL requests
   * @param {object} message - The validation message
   * @param {function} sendResponse - The response function
   */
  async handleGetWFDLRequest(sendResponse) {
    this.logger.info('Handling get WFDL request');

    try {
      const result = await this.executeGetWFDL(message.wfdl, message.requestId);
      sendResponse(result);
    } catch (error) {
      this.logger.error('get WFDL failed', {
        requestId: message.requestId,
        error: error.message
      });

      sendResponse({
        success: false,
        error: error.message,
        requestId: message.requestId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle test validation requests
   * @param {object} message - The test message
   * @param {function} sendResponse - The response function
   */
  async handleTestValidation(message, sendResponse) {
    this.logger.info('Handling test validation');

    try {
      const result = await this.executeGetWFDL(message.wfdl);
      sendResponse(result);
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle debug requests
   * @param {function} sendResponse - The response function
   */
  async handleDebugRequest(sendResponse) {
    this.logger.info('Handling debug request');

    try {
      const debugInfo = await this.getDebugInfo();
      sendResponse({
        success: true,
        debugInfo: debugInfo,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle status requests
   * @param {function} sendResponse - The response function
   */
  async handleStatusRequest(sendResponse) {
    const availability = await this.checkGetWFDLAvailability();

    sendResponse({
      success: true,
      available: availability.available,
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Execute WFDL validation
   * @param {string} wfdlString - The WFDL string to validate
   * @param {string} requestId - The request ID
   * @returns {Promise<object>} The validation result
   */
  //was executeValidation
  async executeGetWFDL(wfdlString, requestId = null) {
    this.logger.info('getting WFDL', { requestId });

    try {
      // Execute validation in page context
      const result = await this.executeGetWFDLInPageContext(wfdlString); 

      return {
        success: true,
        requestId: requestId,
        wfdl: wfdlString,
        validationResult: result,
        source: 'wf.exportTrainingData',
        context: {
          url: window.location.href,
          title: document.title
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Getting WFDL execution failed', {
        requestId,
        error: error.message
      });

      throw new Error(`getting WFDL failed: ${error.message}`);
    }
  }

  /**
   * Execute validation in page context
   * @param {string} wfdlString - The WFDL string to validate
   * @returns {Promise<*>} The validation result
   */
  async executeGetWFDLInPageContext(wfdlString) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const resultId = `wfdl_result_${Date.now()}`;

      script.textContent = `
        (function() {
          try {
            console.log('WFDL Extension: Executing get WFDL in page context');

            if (typeof wf === 'undefined' || typeof wf.exportTrainingData !== 'function') {
              window.${resultId} = {
                success: false,
                error: 'wf.exportTrainingData not available in page context'
              };
              return;
            }

            const result = wf.exportTrainingData();
            window.${resultId} = { success: true, data: result };

          } catch (error) {
            window.${resultId} = {
              success: false,
              error: error.message
            };
          }
        })();
      `;

      // Inject and execute the script
      document.head.appendChild(script);
      document.head.removeChild(script);

      // Get the result
      setTimeout(() => {
        const result = window[resultId];
        delete window[resultId];

        if (!result) {
          reject(new Error('No get WFDL result received'));
          return;
        }

        if (result.success) {
          resolve(result.data);
        } else {
          reject(new Error(result.error));
        }
      }, 100);
    });
  }

  /**
   * Check if get WFDL is available
   * @returns {Promise<object>} Availability information
   */
  async checkGetWFDLAvailability() {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      const resultId = `wfdl_check_${Date.now()}`;

      script.textContent = `
        (function() {
          try {
            window.${resultId} = {
              available: typeof wf !== 'undefined' && typeof wf.exportTrainingData === 'function',
              wfType: typeof wf,
              validateType: typeof wf?.exportTrainingData
            };
          } catch (error) {
            window.${resultId} = {
              available: false,
              error: error.message
            };
          }
        })();
      `;

      document.head.appendChild(script);
      document.head.removeChild(script);

      setTimeout(() => {
        const result = window[resultId];
        delete window[resultId];
        resolve(result || { available: false, error: 'No availability result' });
      }, 100);
    });
  }

  /**
   * Get debug information about the page
   * @returns {Promise<object>} Debug information
   */
  async getDebugInfo() {
    const availability = await this.checkGetWFDLAvailability();

    return {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      validation: availability
    };
  }
}

// Initialize content script only on Designer pages
if (CONFIG.designerUrls.isDesignerPage(window.location.href)) {
  const contentScript = new WFDLContentScript();

  // Make it available globally for debugging
  window.wfdlContentScript = contentScript;
} else {
  const logger = new Logger('ContentScript');
  logger.info('Not on Designer page, content script inactive', { url: window.location.href });
}
