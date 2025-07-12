/**
 * (HTMLsummary, WDFL) generater - Validation Executor
 * Centralized WFDL validation execution logic
 */

class ValidationExecutor {
  constructor() {
    this.logger = new Logger('ValidationExecutor');
  }

  /**
   * Execute WFDL validation on a Designer page
   * @param {number} tabId - The tab ID to execute validation on
   * @param {string} wfdlString - The WFDL string to validate
   * @param {string} requestId - The request ID for tracking
   * @returns {Promise<object>} The validation result
   */
  //was executeValidation
  async executeGetWFDL(tabId, wfdlString, requestId = null) {
    this.logger.info('getting WFDL', { tabId, requestId });

    try {
      // Verify tab is available and loaded
      const tab = await this._verifyTab(tabId);

      // Execute validation using chrome.scripting API 
      const result = await this._executeScriptGetWFDL(tabId, wfdlString);

      if (!result.success) {
        throw new Error(result.error || 'Getting WFDL failed');
      }

      // Format the result consistently
      // const formattedResult = this._formatValidationResult(result.data, wfdlString, requestId, tab); 
      const formattedResult = result;

      this.logger.info('Got WFDL successfully', { requestId });
      return formattedResult;

    } catch (error) {
      this.logger.error('Gettng WFDL failed', { error: error.message, requestId });
      throw error;
    }
  }

  /**
   * Test if validation is available on a tab
   * @param {number} tabId - The tab ID to test
   * @returns {Promise<object>} Availability test result
   */
  // async testValidationAvailability(tabId) {
  //   this.logger.info('Testing validation availability', { tabId });

  //   try {
  //     const tab = await this._verifyTab(tabId);

  //     // Test if wf.validateWFDL is available
  //     const result = await chrome.scripting.executeScript({
  //       target: { tabId: tabId },
  //       func: this._testWfdlAvailability,
  //       world: 'MAIN'
  //     });

  //     const availability = result[0]?.result || { available: false };

  //     this.logger.info('Validation availability test completed', {
  //       tabId,
  //       available: availability.available
  //     });

  //     return {
  //       available: availability.available,
  //       wfType: availability.wfType,
  //       validateType: availability.validateType,
  //       error: availability.error,
  //       tab: {
  //         id: tab.id,
  //         url: tab.url,
  //         title: tab.title
  //       }
  //     };

  //   } catch (error) {
  //     this.logger.error('Availability test failed', { error: error.message, tabId });
  //     return {
  //       available: false,
  //       error: error.message,
  //       tab: null
  //     };
  //   }
  // }

  /**
   * Get debug information from a Designer page
   * @param {number} tabId - The tab ID to debug
   * @returns {Promise<object>} Debug information
   */
  async getDebugInfo(tabId) {
    this.logger.info('Getting debug information', { tabId });

    try {
      const tab = await this._verifyTab(tabId);

      const result = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: this._getPageDebugInfo,
        world: 'MAIN'
      });

      const debugInfo = result[0]?.result || {};

      return {
        ...debugInfo,
        tab: {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          status: tab.status
        }
      };

    } catch (error) {
      this.logger.error('Debug info retrieval failed', { error: error.message, tabId });
      return {
        error: error.message,
        tab: null
      };
    }
  }

  /**
   * Verify that a tab is available and ready for validation
   * @param {number} tabId - The tab ID to verify
   * @returns {Promise<object>} The tab object
   */
  async _verifyTab(tabId) {
    const tab = await chrome.tabs.get(tabId);

    if (!tab) {
      throw new Error('Tab no longer exists');
    }

    if (tab.status !== 'complete') {
      throw new Error(`Tab is not fully loaded (status: ${tab.status})`);
    }

    if (tab.discarded) {
      throw new Error('Tab has been discarded - please refresh the page');
    }

    if (!CONFIG.designerUrls.isDesignerPage(tab.url)) {
      throw new Error('Not on a Webflow Designer page');
    }

    return tab;
  }

  /**
   * Execute validation script on the page
   * @param {number} tabId - The tab ID
   * @param {string} wfdlString - The WFDL string to validate
   * @returns {Promise<object>} The script execution result
   */
  async _executeScriptGetWFDL(tabId, wfdlString) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: this._executeWfdlGet,
      args: [wfdlString], //not sure what to do if there is no arguments
      world: 'MAIN' // Execute in the page's main world context
    });

    return results[0]?.result || { success: false, error: 'No result from script execution' };
  }

  /**
   * Format validation result consistently
   * @param {*} validationResult - The raw validation result
   * @param {string} wfdlString - The WFDL string that was validated
   * @param {string} requestId - The request ID
   * @param {object} tab - The tab information
   * @returns {object} Formatted validation result
   */
  _formatValidationResult(validationResult, wfdlString, requestId, tab) {
    return {
      success: true,
      requestId: requestId,
      wfdl: wfdlString,
      validationResult: validationResult,
      source: 'wf.validateWFDL',
      context: {
        url: tab.url,
        title: tab.title,
        tabId: tab.id
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Script function to execute extractTrainingData()
   * This function is injected into the page context
   * @returns {object} output of the extractTrainingData() (WFDL of the page)
   */
  _executeWfdlGet(notuse) {
    try {
      // Check if wf.extractTrainingData() is available
      if (typeof wf === 'undefined' || typeof wf.extractTrainingData !== 'function') {
        return {
          success: false,
          error: 'wf.extractTrainingData not available in page context'
        };
      }

      // Execute extractTrainingData()
      const result = wf.extractTrainingData();

      return {
        success: true,
        data: result
      };

    } catch (error) {
      return {
        success: false,
        error: `get WFDL failed: ${error.message}`
      };
    }
  }

  /**
   * Script function to test WFDL availability
   * This function is injected into the page context
   * @returns {object} Availability test result
   */
  _testWfdlAvailability() {
    try {
      return {
        available: typeof wf !== 'undefined' && typeof wf.validateWFDL === 'function',
        wfType: typeof wf,
        validateType: typeof wf?.validateWFDL,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Script function to get page debug information
   * This function is injected into the page context
   * @returns {object} Debug information
   */
  _getPageDebugInfo() {
    try {
      const info = {
        wf: typeof wf,
        'window.wf': typeof window.wf,
        webflow: typeof webflow,
        'window.webflow': typeof window.webflow,
        Webflow: typeof Webflow,
        'window.Webflow': typeof window.Webflow,
        timestamp: new Date().toISOString()
      };

      // Get wf object properties if available
      if (typeof wf !== 'undefined' && wf) {
        try {
          info['wf.properties'] = Object.keys(wf);
          info['wf.validateWFDL'] = typeof wf.validateWFDL;
        } catch (e) {
          info['wf.error'] = e.message;
        }
      }

      // Search for validation-related keys
      const windowKeys = Object.keys(window);
      info.validationKeys = windowKeys.filter(key =>
        key.toLowerCase().includes('valid') ||
        key.toLowerCase().includes('wfdl') ||
        key.toLowerCase().includes('webflow')
      );

      return info;

    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationExecutor;
} else {
  window.ValidationExecutor = ValidationExecutor;
}
