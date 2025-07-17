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

        case 'prepare_component_screenshot':
          await this.prepareComponentScreenshot(message, sendResponse);
          break;

        case 'crop_component_screenshot':
          await this.cropComponentScreenshot(message, sendResponse);
          break;

        case 'cleanup_component_screenshot':
          await this.cleanupComponentScreenshot(message, sendResponse);
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
  async handleGetWFDLRequest(message, sendResponse) {
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
   * Handle debug requests for page state
   * @param {function} sendResponse - The response function  
   */
  async handleDebugRequest(sendResponse) {
    this.logger.info('Handling debug request');

    try {
      // Execute script to get debug info from page
      const result = await this.executeScript(this.getDebugInfo);

      sendResponse({
        success: true,
        debugInfo: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Debug request failed', { error: error.message });
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
   * Prepare a component for screenshot by finding its DOM element and getting bounds
   * @param {object} message - The message containing componentId and options
   * @param {function} sendResponse - The response function
   */
  async prepareComponentScreenshot(message, sendResponse) {
    this.logger.info('Preparing component for screenshot', { componentId: message.componentId });

    try {
      // Execute script in page context to find component and get bounds
      const result = await this.executeScript(this.findComponentAndGetBounds, message.componentId, message.options);

      if (!result.success) {
        throw new Error(result.error || 'Failed to find component');
      }

      sendResponse({
        success: true,
        componentBounds: result.bounds,
        elementInfo: result.elementInfo
      });

    } catch (error) {
      this.logger.error('Component preparation failed', { error: error.message, componentId: message.componentId });
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Crop the full page screenshot to just the component area
   * @param {object} message - The message containing screenshot data and bounds
   * @param {function} sendResponse - The response function
   */
  async cropComponentScreenshot(message, sendResponse) {
    this.logger.info('Cropping component screenshot', { componentId: message.componentId });

    try {
      // Execute script to crop the image
      const result = await this.executeScript(
        this.cropImageToComponent,
        message.screenshotDataUrl,
        message.componentBounds,
        message.componentId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to crop image');
      }

      sendResponse({
        success: true,
        croppedImage: result.croppedImage
      });

    } catch (error) {
      this.logger.error('Image cropping failed', { error: error.message, componentId: message.componentId });
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Clean up any temporary elements or highlighting from component screenshot
   * @param {object} message - The cleanup message
   * @param {function} sendResponse - The response function
   */
  async cleanupComponentScreenshot(message, sendResponse) {
    this.logger.info('Cleaning up component screenshot', { componentId: message.componentId });

    try {
      // Execute cleanup script
      await this.executeScript(this.cleanupComponentHighlight, message.componentId);

      sendResponse({
        success: true
      });

    } catch (error) {
      this.logger.error('Cleanup failed', { error: error.message, componentId: message.componentId });
      sendResponse({
        success: false,
        error: error.message
      });
    }
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

  /**
   * Script function to find a component by ID and get its bounds
   * This function is injected into the page context
   * @param {string} componentId - The component ID to find
   * @param {object} options - Screenshot options
   * @returns {object} Component bounds and element info
   */
  findComponentAndGetBounds(componentId, options = {}) {
    try {
      // Try multiple strategies to find the component
      let element = null;
      let searchStrategy = 'unknown';

      // Strategy 1: Direct data attribute search
      element = document.querySelector(`[data-w-id="${componentId}"]`);
      if (element) {
        searchStrategy = 'data-w-id';
      }

      // Strategy 2: Try other common Webflow attributes
      if (!element) {
        element = document.querySelector(`[data-component-id="${componentId}"]`);
        if (element) searchStrategy = 'data-component-id';
      }

      // Strategy 3: Try ID attribute
      if (!element) {
        element = document.getElementById(componentId);
        if (element) searchStrategy = 'id';
      }

      // Strategy 4: Use Webflow internal APIs if available
      if (!element && typeof wf !== 'undefined' && wf.getComponentElement) {
        try {
          element = wf.getComponentElement(componentId);
          if (element) searchStrategy = 'wf-api';
        } catch (e) {
          // Webflow API method might not exist
        }
      }

      if (!element) {
        return {
          success: false,
          error: `Component with ID "${componentId}" not found. Tried multiple search strategies.`
        };
      }

      // Scroll element into view if needed
      if (options.scrollIntoView !== false) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Get element bounds
      const rect = element.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      // Add some padding around the component
      const padding = options.padding || 10;

      const bounds = {
        x: Math.max(0, rect.left + scrollX - padding),
        y: Math.max(0, rect.top + scrollY - padding),
        width: rect.width + (padding * 2),
        height: rect.height + (padding * 2),
        viewportX: Math.max(0, rect.left - padding),
        viewportY: Math.max(0, rect.top - padding)
      };

      // Optionally highlight the component
      if (options.highlight !== false) {
        this.highlightElement(element, componentId);
      }

      return {
        success: true,
        bounds: bounds,
        elementInfo: {
          tagName: element.tagName,
          className: element.className,
          searchStrategy: searchStrategy,
          hasContent: element.textContent.length > 0,
          childCount: element.children.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Error finding component: ${error.message}`
      };
    }
  }

  /**
   * Script function to crop a screenshot to component bounds
   * This function is injected into the page context
   * @param {string} screenshotDataUrl - The full page screenshot
   * @param {object} bounds - Component bounds
   * @param {string} componentId - Component ID for reference
   * @returns {object} Cropped image result
   */
  cropImageToComponent(screenshotDataUrl, bounds, componentId) {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = function() {
          // Set canvas size to component bounds
          canvas.width = bounds.width;
          canvas.height = bounds.height;

          // Crop the image to the component area
          ctx.drawImage(
            img,
            bounds.viewportX, bounds.viewportY, bounds.width, bounds.height,
            0, 0, bounds.width, bounds.height
          );

          // Convert to data URL
          const croppedDataUrl = canvas.toDataURL('image/png');

          resolve({
            success: true,
            croppedImage: croppedDataUrl
          });
        };

        img.onerror = function() {
          resolve({
            success: false,
            error: 'Failed to load screenshot image'
          });
        };

        img.src = screenshotDataUrl;

      } catch (error) {
        resolve({
          success: false,
          error: `Error cropping image: ${error.message}`
        });
      }
    });
  }

  /**
   * Script function to highlight an element temporarily
   * This function is injected into the page context
   * @param {Element} element - Element to highlight
   * @param {string} componentId - Component ID for reference
   */
  highlightElement(element, componentId) {
    // Remove any existing highlights
    this.removeExistingHighlights();

    // Create highlight overlay
    const highlight = document.createElement('div');
    highlight.id = `wfdl-highlight-${componentId}`;
    highlight.style.cssText = `
      position: absolute;
      border: 3px solid #ff6b6b;
      background-color: rgba(255, 107, 107, 0.1);
      pointer-events: none;
      z-index: 999999;
      box-shadow: 0 0 10px rgba(255, 107, 107, 0.5);
    `;

    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    highlight.style.left = (rect.left + scrollX) + 'px';
    highlight.style.top = (rect.top + scrollY) + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';

    document.body.appendChild(highlight);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (document.getElementById(`wfdl-highlight-${componentId}`)) {
        document.getElementById(`wfdl-highlight-${componentId}`).remove();
      }
    }, 3000);
  }

  /**
   * Script function to remove existing highlights
   * This function is injected into the page context
   */
  removeExistingHighlights() {
    const existingHighlights = document.querySelectorAll('[id^="wfdl-highlight-"]');
    existingHighlights.forEach(highlight => highlight.remove());
  }

  /**
   * Script function to clean up component highlighting
   * This function is injected into the page context
   * @param {string} componentId - Component ID to clean up
   */
  cleanupComponentHighlight(componentId) {
    try {
      // Remove specific highlight
      const highlight = document.getElementById(`wfdl-highlight-${componentId}`);
      if (highlight) {
        highlight.remove();
      }

      // Also remove any other highlights as cleanup
      this.removeExistingHighlights();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Cleanup error: ${error.message}`
      };
    }
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
