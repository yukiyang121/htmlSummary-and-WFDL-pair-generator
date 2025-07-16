/**
 * (HTMLsummary, WDFL) generater - Popup UI
 * Handles the extension's popup interface and user interactions
 */


class WFDLValidatorPopup {
  constructor() {
    this.logger = new Logger('Popup');
    this.wsManager = new WebSocketManager();
    this.extensionId = chrome.runtime.id;

    // Statistics
    this.requestCount = 0;
    this.successCount = 0;

    this.init();
  }

  /**
   * Initialize the popup
   */
  async init() {
    this.logger.info('Initializing popup UI');

    // Initialize UI elements
    this.initializeUI();

    // Setup event listeners
    this.setupEventListeners();

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers();

    // Setup UI logging
    this.setupUILogging();

    // Try to auto-connect
    setTimeout(() => this.connect(), 1000);
  }

  /**
   * Initialize UI elements
   */
  initializeUI() {
    document.getElementById('extensionId').textContent = `Extension ID: ${this.extensionId}`;
    // document.getElementById('testWfdl').value = CONFIG.extension.defaultTestWfdl;

    this.updateConnectionStatus();
    this.updateStats();
    this.updateEnvironmentIndicator();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.getElementById('connectBtn').addEventListener('click', () => this.connect());
    document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());
    document.getElementById('testBtn').addEventListener('click', () => this.testValidation());
  }

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocketHandlers() {
    this.wsManager.on('open', () => {
      this.logger.info('WebSocket connection opened');
      this.updateConnectionStatus('Connected');
    });

    this.wsManager.on('close', () => {
      this.logger.info('WebSocket connection closed');
      this.updateConnectionStatus('Disconnected');
    });

    this.wsManager.on('error', (error) => {
      this.logger.error('WebSocket error', { error });
      this.updateConnectionStatus('Error');
    });

    this.wsManager.on('message', (message) => {
      this.handleWebSocketMessage(message);
    });
  }

  /**
   * Setup UI logging integration
   */
  setupUILogging() {
    window.logToUI = (message, level, data) => {
      this.addLogEntry(message, level);
    };
  }

  /**
   * Connect to WebSocket
   */
  async connect() {
    this.logger.info('Connecting to WebSocket...');
    this.updateConnectionStatus('Connecting...');

    try {
      const connected = await this.wsManager.connect();
      if (connected) {
        this.logger.info('Successfully connected to WebSocket');
      } else {
        this.logger.error('Failed to connect to WebSocket');
        this.updateConnectionStatus('Failed');
      }
    } catch (error) {
      this.logger.error('Connection error', { error: error.message });
      this.updateConnectionStatus('Error');
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.logger.info('Disconnecting from WebSocket...');
    this.wsManager.disconnect();
    this.updateConnectionStatus('Disconnected');
  }

  /**
   * Handle WebSocket messages
   * @param {object} message - The WebSocket message
   */
  handleWebSocketMessage(message) {
    this.logger.debug('Received WebSocket message', { type: message.type });

    switch (message.type) {
      case 'wfdl_validation_request':
        this.handleValidationRequest(message);
        break;

      case 'registered':
        this.logger.info('Successfully registered with server');
        break;

      case 'heartbeat_ack':
        this.logger.debug('Heartbeat acknowledged');
        break;

      case 'ack':
        this.logger.info('Validation result acknowledged');
        break;

      case 'error':
        this.logger.error('Server error', { message: message.message });
        break;

      default:
        this.logger.warn('Unknown message type', { type: message.type });
    }
  }

  /**
   * Handle validation requests from WebSocket
   * @param {object} message - The validation request message
   */
  async handleValidationRequest(message) {
    this.logger.info('Processing validation request', { requestId: message.requestId });

    this.requestCount++;
    this.updateStats();

    try {
      const wfdl = message.payload || message.wfdl || message.data || message.content;
      const requestId = message.requestId || message.id;

            // Find a suitable Designer tab
      const tabId = await this.findDesignerTab();

      // Execute validation using chrome.scripting
      const result = await this.executeDesignerValidation(tabId, requestId);

      this.logger.info('Validation completed successfully', { requestId });
      this.successCount++;
      this.updateStats();

      // Send result back to server
      this.sendValidationResult(requestId, result);

    } catch (error) {
      this.logger.error('Validation request failed', {
        requestId: message.requestId,
        error: error.message
      });

      // Send error result back to server
      this.sendValidationResult(message.requestId, {
        success: false,
        error: error.message,
        requestId: message.requestId
      });
    }
  }

  /**
   * Execute validation on a Designer tab using chrome.scripting
   * @param {number} tabId - The tab ID to execute validation on
   * @param {string} requestId - The request ID for tracking
   * @returns {Promise<object>} The validation result
   */
  async executeDesignerValidation(tabId, requestId = null) {
    this.logger.info('Executing Designer validation via chrome.scripting', { tabId, requestId });

    try {
      // Verify the tab is still available and loaded
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        throw new Error('Designer tab no longer exists');
      }

      if (tab.status !== 'complete') {
        throw new Error(`Designer tab is not fully loaded (status: ${tab.status})`);
      }

      if (tab.discarded) {
        throw new Error('Designer tab has been discarded - please refresh the page');
      }

      // Execute validation using the standalone getWFDL function
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: getWFDL,
        world: 'MAIN' // Execute in the page's main world context (bypasses CSP)
      });

      const result = results[0]?.result;

      if (!result) {
        throw new Error('No result from script execution');
      }

      if (!result.success) {
        throw new Error(result.error || 'Validation execution failed');
      }

      // Convert the script result to match the expected format
      const formattedResult = {
        success: true,
        requestId: requestId,
        validationResult: result.data, // The actual validation result
        source: 'wf.exportTrainingData',
        context: {
          url: tab.url,
          title: tab.title,
          tabId: tab.id
        },
        timestamp: new Date().toISOString()
      };

      this.logger.info('Designer validation completed successfully', { requestId });
      return formattedResult;

    } catch (error) {
      this.logger.error('Designer validation failed', {
        error: error.message,
        requestId,
        tabId
      });

      if (error.message.includes('Could not establish connection') ||
          error.message.includes('Receiving end does not exist')) {
        throw new Error('Cannot communicate with Designer page - content script not loaded. Please refresh the Designer page and try again.');
      }

      if (error.message.includes('timeout')) {
        throw new Error('Designer page validation timed out - page may be busy or unresponsive');
      }

      throw new Error(`Designer validation failed: ${error.message}`);
    }
  }

  /**
   * Find a suitable Designer tab for validation
   * @returns {Promise<number>} The tab ID
   */
  async findDesignerTab() {
    // Try to get the active tab first
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (activeTab && CONFIG.designerUrls.isDesignerPage(activeTab.url)) {
      this.logger.info('Using active Designer tab', { title: activeTab.title });
      return activeTab.id;
    }

    // If active tab is not Designer, find any Designer tabs
    const designerTabs = await chrome.tabs.query({
      url: CONFIG.designerUrls.patterns
    });

    if (designerTabs.length === 0) {
      throw new Error('No Webflow Designer tabs found - validation requires Designer page');
    }

    // Filter for loaded tabs
    const loadedTabs = designerTabs.filter(tab =>
      tab.status === 'complete' &&
      !tab.discarded &&
      CONFIG.designerUrls.isDesignerPage(tab.url)
    );

    if (loadedTabs.length === 0) {
      throw new Error('No loaded Designer tabs found - please refresh Designer page');
    }

    const selectedTab = loadedTabs[0];
    this.logger.info('Using first loaded Designer tab', { title: selectedTab.title });
    return selectedTab.id;
  }

  /**
   * Send validation result back to server
   * @param {string} requestId - The request ID
   * @param {object} result - The validation result
   */
  sendValidationResult(requestId, result) {
    if (!this.wsManager.send({
      type: 'validation_result',
      requestId: requestId,
      id: this.extensionId,
      result: result
    })) {
      this.logger.error('Failed to send validation result', { requestId });
    } else {
      this.logger.info('Sent validation result', { requestId });
    }
  }

  /**
   * Get WFDL (directly connects to Chrome Extension)
   */
  // this prints stuff in the activity logger
  async testValidation() {
    // const wfdlString = document.getElementById('testWfdl').value.trim();

    this.logger.info('Starting test validation...');
    this.requestCount++;
    this.updateStats();

        try {
      const tabId = await this.findDesignerTab();
      const result = await this.executeDesignerValidation(tabId);

      this.logger.info('Test validation successful!');
      this.logger.info(`Validation result: ${JSON.stringify(result.validationResult, null, 2)}`);

      this.successCount++;
      this.updateStats();

      // this.logger.info(`components: ${JSON.stringify(result.validationResult.components, null, 2)}` )
      this.displayComponents(result.validationResult.components || {});

    } catch (error) {
      this.logger.error(`Test validation failed: ${error.message}`);
    }
  }

  displayComponents(components) {
  const container = document.getElementById('componentList');
  if (!container) {
    this.logger.warn('Component list container not found');
    return;
  }

  container.innerHTML = ''; // Clear previous entries

  const entries = Object.entries(components);
  if (entries.length === 0) {
    container.textContent = 'No components returned.';
    return;
  }

  entries.forEach(([cid, componentCode], index) => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '20px';

    const header = document.createElement('div');
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '5px';
    header.textContent = `Component ${index + 1} \u2014 cid: ${cid}`;
    wrapper.appendChild(header);

    const codeBlock = document.createElement('pre');
    codeBlock.textContent = componentCode;
    codeBlock.style.whiteSpace = 'pre-wrap';
    codeBlock.style.background = '#ffffff';
    codeBlock.style.border = '1px solid #ced4da';
    codeBlock.style.borderRadius = '6px';
    codeBlock.style.padding = '10px';
    codeBlock.style.fontSize = '11px';
    codeBlock.style.maxHeight = '250px';
    codeBlock.style.overflowY = 'auto';

    wrapper.appendChild(codeBlock);
    container.appendChild(wrapper);
  });
}



  /**
   * Update connection status in UI
   * @param {string} status - The connection status
   */
  updateConnectionStatus(status = 'Disconnected') {
    const statusElement = document.getElementById('connectionStatus');
    const indicatorElement = document.getElementById('statusIndicator');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    statusElement.textContent = status;

    // Update indicator and buttons
    indicatorElement.className = 'status-indicator';
    if (status === 'Connected') {
      indicatorElement.classList.add('connected');
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
    } else if (status === 'Connecting...') {
      indicatorElement.classList.add('connecting');
      connectBtn.disabled = true;
      disconnectBtn.disabled = true;
    } else {
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    }
  }

  /**
   * Update statistics in UI
   */
  updateStats() {
    document.getElementById('requestCount').textContent = this.requestCount;
    document.getElementById('successCount').textContent = this.successCount;
  }

  /**
   * Update environment indicator display
   */
  updateEnvironmentIndicator() {
    const wsUrl = CONFIG.websocket.prodUrl || CONFIG.websocket.devUrl;
    const isProduction = wsUrl.includes('webflowlabs.workers.dev');

    const environmentBadge = document.getElementById('environmentBadge');
    const environmentText = document.getElementById('environmentText');
    const environmentUrl = document.getElementById('environmentUrl');

    if (isProduction) {
      environmentBadge.className = 'environment-badge production';
      environmentText.textContent = 'Production';
      environmentUrl.textContent = CONFIG.websocket.prodUrl;
    } else {
      environmentBadge.className = 'environment-badge development';
      environmentText.textContent = 'Development';
      environmentUrl.textContent = CONFIG.websocket.devUrl;
    }
  }

  /**
   * Add log entry to UI
   * @param {string} message - The log message
   * @param {string} level - The log level
   */
  addLogEntry(message, level = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${level}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

    const activityLog = document.getElementById('activityLog');
    activityLog.appendChild(logEntry);

    // Limit log entries
    while (activityLog.children.length > CONFIG.ui.activityLog.maxEntries) {
      activityLog.removeChild(activityLog.firstChild);
    }

    activityLog.scrollTop = activityLog.scrollHeight;
  }
}

// Function that will be injected and executed in the target page
// This bypasses CSP by creating a script element directly in the DOM
// This function directly changes the console. 
function getWFDL() {
  try {
    // Create a script element to inject the code
    const script = document.createElement('script');

    // Create the validation code
    const validationCode = `
      console.log('WFDL Extension: Executing getWFDL');
      console.log('wf object type:', typeof wf);
      console.log('wf.exportTrainingData type:', typeof wf?.exportTrainingData);

      if (typeof wf === 'undefined' || typeof wf.exportTrainingData !== 'function') {
        console.error('wf.exportTrainingData not available');
        window.__wfdlValidationError = 'wf.exportTrainingData not available in page context';
        throw new Error('wf.exportTrainingData not available in page context');
      }

      console.log('Calling wf.exportTrainingData');
      const result = wf.exportTrainingData();
      console.log('WFDL result:', result);

      // Store result for extension to retrieve
      window.__wfdlValidationResult = result;
    `;

    // Wrap the validation code to capture any return value
    const wrappedCode = `
      (function() {
        try {
          ${validationCode}
        } catch (error) {
          window.__wfdlValidationError = error.message;
          throw error;
        }
      })();
    `;

    script.textContent = wrappedCode;

    // Inject the script into the page
    (document.head || document.documentElement).appendChild(script);

    // Clean up the script element
    script.remove();

    // Check if there was an error
    if (window.__wfdlValidationError) {
      const error = window.__wfdlValidationError;
      delete window.__wfdlValidationError;
      return { success: false, error: error };
    }

    // Get the result
    const result = window.__wfdlValidationResult;
    delete window.__wfdlValidationResult;

    return { success: true, data: result };

  } catch (error) {
    return { success: false, error: `JavaScript Error: ${error.message}` };
  }
}

// Initialize the popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Load required scripts
  const scripts = [
    'config.js',
    'utils/logger.js',
    'utils/websocket-manager.js'
  ];

  let loadedScripts = 0;

  scripts.forEach(script => {
    const scriptElement = document.createElement('script');
    scriptElement.src = script;
    scriptElement.onload = () => {
      loadedScripts++;
      if (loadedScripts === scripts.length) {
        // All scripts loaded, initialize popup
        new WFDLValidatorPopup();
      }
    };
    document.head.appendChild(scriptElement);
  });
});


// process input image
document.getElementById('sendToGemini').addEventListener('click', async () => {
  const fileInput = document.getElementById('screenshotInput');
  const output = document.getElementById('summaryOutput');

  if (!fileInput.files.length) {
    alert('Please upload a screenshot first.');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async () => {
    const base64Image = reader.result; // data:image/png;base64,...

    output.textContent = "Calling Gemini...";

    // if (base64Image){
    //   output.textContent = "has image!!";
    // }

    try {
      const summary = await callGeminiWithScreenshot(base64Image);
      output.textContent = summary || "No summary returned."; //this overwrites "Calling Gemini"
    } catch (err) {
      output.textContent = "Error: " + err.message;
    }
  };
  reader.readAsDataURL(file);
});

// Save API Key
document.getElementById('saveApiKey').addEventListener('click', () => {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) {
    alert("Please enter a valid API key.");
    return;
  }
  chrome.storage.local.set({ geminiApiKey: key }, () => {
    alert("API key saved.");
  });
});

// Load stored key into input (optional UX)
chrome.storage.local.get(['geminiApiKey'], (result) => {
  if (result.geminiApiKey) {
    document.getElementById('apiKeyInput').value = result.geminiApiKey;
  }
});



async function callGeminiWithScreenshot(base64Image) {
  // Return a promise because chrome.storage is async
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['geminiApiKey'], async (result) => {
      const GEMINI_API_KEY = result.geminiApiKey;

      if (!GEMINI_API_KEY) {
        reject(new Error('No Gemini API key found. Please save it in the extension.'));
        return;
      }

      // Strip "data:image/png;base64," prefix if present
      const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { // prompt
                  text: `You are helping me create training data for an AI that generates structured component code (WFDL) from visual summaries. 
                          This image shows a UI component from a Webflow site. Please describe the layout, content, and structure in plain English as if you were labeling this component for training. Be concise but specific.
                          Avoid explaining *how* to code it — just describe *what* it is.
                          Output format: A short summary.`
                },
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: imageData
                  }
                }
              ]
            }]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          reject(new Error(`Gemini API call failed: ${errText}`));
          return;
        }

        const data = await response.json();
        const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary returned";
        resolve(summary);
      } catch (err) {
        reject(new Error(`Gemini request error: ${err.message}`));
      }
    });
  });
}
