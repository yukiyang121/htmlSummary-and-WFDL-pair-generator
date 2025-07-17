/**
 * HTMLsummary, WDFL) generater - Background Service Worker
 * Handles extension lifecycle and message routing
 */

// Import utilities
importScripts('config.js');
importScripts('utils/logger.js');

// Initialize logger
const logger = new Logger('Background');

// Extension state
let extensionId = null;

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(() => {
  logger.info('Extension installed');
  extensionId = chrome.runtime.id;
  logger.info(`Extension ID: ${extensionId}`);
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
  logger.info('Extension started');
  extensionId = chrome.runtime.id;
});

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.debug('Background received message', { type: request.type, sender: sender.tab?.id });

  switch (request.type) {
    case 'get_extension_status':
      sendResponse({
        success: true,
        extensionId: extensionId || chrome.runtime.id,
        timestamp: new Date().toISOString()
      });
      break;

    case 'connection_status':
      // Forward connection status updates to popup if it's listening
      forwardToPopup(request);
      sendResponse({ success: true });
      break;

    case 'capture_component_screenshot':
      handleComponentScreenshot(request, sender, sendResponse);
      return true; // Keep message channel open for async response

    default:
      logger.warn('Unknown message type', { type: request.type });
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

/**
 * Handle get WFDL requests from WebSocket (via popup)
 * @param {object} messageData - The validation request data
 * @returns {Promise<object>} The validation result
 */
async function handleGetWFDLRequest(messageData) {
  logger.info('Handling get WFDL request', { requestId: messageData.requestId });

  try {
    // Find active Designer tabs
    const designerTabs = await chrome.tabs.query({
      url: CONFIG.designerUrls.patterns
    });

    if (designerTabs.length === 0) {
      throw new Error('No Webflow Designer tabs found');
    }

    // Filter for loaded and active tabs
    const loadedTabs = designerTabs.filter(tab =>
      tab.status === 'complete' &&
      !tab.discarded &&
      CONFIG.designerUrls.isDesignerPage(tab.url)
    );

    if (loadedTabs.length === 0) {
      throw new Error('No loaded Designer tabs found - please refresh Designer page');
    }

    // Use the first loaded tab (or active tab if available)
    const activeTab = loadedTabs.find(tab => tab.active) || loadedTabs[0];

    logger.info('Using Designer tab', {
      tabId: activeTab.id,
      title: activeTab.title,
      url: activeTab.url
    });

    // Send get_WFDL request to content script
    const result = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'get_wfdl',
      wfdl: messageData.payload || messageData.wfdl,
      requestId: messageData.requestId
    });

    logger.info('got WFDL of the page', { requestId: messageData.requestId });
    return result;

  } catch (error) {
    logger.error('get WFDL failed', {
      error: error.message,
      requestId: messageData.requestId
    });

    return {
      success: false,
      error: error.message,
      requestId: messageData.requestId,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Forward messages to popup
 * @param {object} message - The message to forward
 */
function forwardToPopup(message) {
  // This is a placeholder for forwarding to popup
  // In practice, popup would need to maintain a connection
  logger.debug('Forwarding message to popup', { type: message.type });
}

/**
 * Handle component screenshot capture requests
 * @param {object} request - The screenshot request
 * @param {object} sender - The sender information  
 * @param {function} sendResponse - The response function
 */
async function handleComponentScreenshot(request, sender, sendResponse) {
  try {
    logger.info('Handling component screenshot request', { 
      componentId: request.componentId, 
      tabId: request.tabId 
    });

    // First, prepare the component for screenshot in the content script
    const prepResult = await chrome.tabs.sendMessage(request.tabId, {
      type: 'prepare_component_screenshot',
      componentId: request.componentId,
      options: request.options || {}
    });

    if (!prepResult.success) {
      throw new Error(prepResult.error || 'Failed to prepare component for screenshot');
    }

    // Capture the visible tab
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(
      undefined, // Use current window
      { format: 'png', quality: 100 }
    );

    // Send the coordinates back to content script to crop the image
    const cropResult = await chrome.tabs.sendMessage(request.tabId, {
      type: 'crop_component_screenshot',
      screenshotDataUrl: screenshotDataUrl,
      componentBounds: prepResult.componentBounds,
      componentId: request.componentId
    });

    if (!cropResult.success) {
      throw new Error(cropResult.error || 'Failed to crop component screenshot');
    }

    // Clean up any highlighting in the content script
    chrome.tabs.sendMessage(request.tabId, {
      type: 'cleanup_component_screenshot',
      componentId: request.componentId
    }).catch(err => logger.warn('Cleanup failed', err));

    sendResponse({
      success: true,
      screenshot: cropResult.croppedImage,
      componentId: request.componentId,
      bounds: prepResult.componentBounds
    });

  } catch (error) {
    logger.error('Component screenshot failed', { error: error.message });
    
    // Clean up on error
    if (request.tabId) {
      chrome.tabs.sendMessage(request.tabId, {
        type: 'cleanup_component_screenshot',
        componentId: request.componentId
      }).catch(() => {});
    }

    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle extension context menu actions (if any)
 */
chrome.action.onClicked.addListener(async (tab) => {
  logger.info('Extension icon clicked', { tabId: tab.id });

  // Check if we're on a Designer page
  if (CONFIG.designerUrls.isDesignerPage(tab.url)) {
    logger.info('On Designer page, popup will handle actions');
  } else {
    logger.info('Not on Designer page', { url: tab.url });
  }
});

logger.info('Background script loaded successfully');
