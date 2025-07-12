# WFDL Validator Chrome Extension

A Chrome extension that connects to a Cloudflare Worker WebSocket server and executes WFDL (Webflow Design Language) validation on Webflow Designer pages using the `wf.validateWFDL()` API.

## 🚀 Features

- **WebSocket Communication**: Real-time connection to Cloudflare Worker for validation requests
- **WFDL Validation**: Execute `wf.validateWFDL()` directly on Webflow Designer pages
- **CSP Bypass**: Uses script injection to bypass Content Security Policy restrictions
- **Test Interface**: Built-in test UI for manual validation testing
- **Debug Tools**: Comprehensive debugging and diagnostic information
- **Auto-reconnection**: Automatic WebSocket reconnection with configurable retry limits
- **Activity Logging**: Real-time activity log with multiple log levels
- **Extension Management**: Proper lifecycle management and error handling

## 📁 File Structure

```
chrome-extension/
├── 📄 manifest.json          # Extension manifest (MV3)
├── 🎮 popup.html             # Extension popup UI
├── 🎮 popup.js               # Popup logic and WebSocket management
├── 🔧 background.js          # Service worker for lifecycle management
├── 📄 content.js             # Content script for Designer page interaction
├── ⚙️ config.js              # Centralized configuration
├── 📁 utils/                 # Utility modules
│   ├── 📄 logger.js          # Centralized logging utility
│   ├── 📄 websocket-manager.js # WebSocket connection management
│   └── 📄 validation-executor.js # WFDL validation execution (for content scripts)
├── 📁 icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── 📄 README.md              # This file
```

## 🏗️ Architecture

### Components Overview

#### 🎮 **Popup (`popup.js` + `popup.html`)**
- **Purpose**: Main user interface and WebSocket client
- **Key Features**:
  - WebSocket connection management
  - WFDL validation testing
  - Activity logging and statistics
  - Debug information gathering
- **Size**: 598 lines (refactored from 600+ lines)

#### 🔧 **Background Service Worker (`background.js`)**
- **Purpose**: Extension lifecycle and message routing
- **Key Features**:
  - Extension installation/startup handling
  - Message routing between components
  - Designer tab discovery and management
- **Size**: 158 lines (refactored from 208 lines)

#### 📄 **Content Script (`content.js`)**
- **Purpose**: Interacts with Webflow Designer pages
- **Key Features**:
  - WFDL validation execution in page context
  - Designer page detection
  - Page context script injection
- **Size**: 355 lines (refactored from 411 lines)

#### ⚙️ **Configuration (`config.js`)**
- **Purpose**: Centralized configuration management
- **Key Features**:
  - WebSocket connection settings
  - Designer URL patterns
  - UI configuration
  - Logging configuration

#### 📁 **Utility Modules (`utils/`)**

##### 📄 **Logger (`utils/logger.js`)**
- Consistent logging across all components
- Multiple log levels (debug, info, warn, error)
- UI integration for popup logging
- Context-aware logging with timestamps

##### 📄 **WebSocket Manager (`utils/websocket-manager.js`)**
- Centralized WebSocket connection management
- Automatic reconnection with configurable limits
- Heartbeat mechanism
- Event-driven architecture

##### 📄 **Validation Executor (`utils/validation-executor.js`)**
- WFDL validation execution for content scripts
- Tab verification and management
- Debug information gathering
- Error handling and reporting

## 🛠️ Installation

### Development Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd wfdl-validator-worker/chrome-extension
   ```

2. **Load extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `chrome-extension` folder

3. **Verify installation**:
   - Extension icon should appear in Chrome toolbar
   - Click the icon to open the popup interface

### Production Installation

1. **Package the extension**:
   ```bash
   # Zip the chrome-extension folder
   zip -r wfdl-validator-extension.zip chrome-extension/
   ```

2. **Install via Chrome Web Store** (when published):
   - Search for "WFDL Validator" in Chrome Web Store
   - Click "Add to Chrome"

## 🎯 Usage

### Basic Usage

1. **Open a Webflow Designer page**:
   - Navigate to any `*.design.webflow.com` or `*.design.wfdev.io` page

2. **Open the extension popup**:
   - Click the WFDL Validator icon in Chrome toolbar

3. **Connect to WebSocket server**:
   - Click "Connect" button
   - Status indicator should turn green when connected

4. **Test WFDL validation**:
   - Enter WFDL string in the test area
   - Click "Send Test Request"
   - View results in activity log

### WebSocket Server Integration

The extension connects to a Cloudflare Worker WebSocket server that forwards validation requests:

1. **Server sends validation request** → Extension receives via WebSocket
2. **Extension finds Designer tab** → Executes `wf.validateWFDL()`
3. **Extension sends result back** → Server receives validation response

### Supported URLs

The extension only works on Webflow Designer pages:
- `https://*.design.webflow.com/*`
- `https://*.design.wfdev.io/*`
- `https://*.wfdev.io/*`

## ⚙️ Configuration

### WebSocket Configuration

Edit `config.js` to modify WebSocket settings:

```javascript
const CONFIG = {
  websocket: {
    devUrl: 'ws://localhost:8787/ws',        // Development URL
    // prodUrl: 'wss://your-worker.workers.dev/ws', // Production URL
    reconnectDelay: 2000,                    // Reconnection delay (ms)
    heartbeatInterval: 30000,                // Heartbeat interval (ms)
    connectionTimeout: 5000,                 // Connection timeout (ms)
    maxReconnectAttempts: 3                  // Max reconnection attempts
  }
};
```

### Logging Configuration

```javascript
const CONFIG = {
  logging: {
    enabled: true,
    level: 'info',        // 'debug', 'info', 'warn', 'error'
    maxLogEntries: 100
  }
};
```

### UI Configuration

```javascript
const CONFIG = {
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
```

## 🔧 Development

### Development Setup

1. **Prerequisites**:
   - Chrome browser
   - Access to Webflow Designer
   - Cloudflare Worker WebSocket server (optional for testing)

2. **Development workflow**:
   ```bash
   # Make changes to extension files
   # Reload extension in chrome://extensions/
   # Test on Designer pages
   ```

3. **Live reloading**:
   - Use the "Reload" button in `chrome://extensions/`
   - Or disable/enable the extension to reload

### Testing

#### Manual Testing

1. **Test WebSocket connection**:
   - Open popup → Click "Connect"
   - Verify green status indicator

2. **Test WFDL validation**:
   - Open Designer page
   - Enter test WFDL in popup
   - Click "Send Test Request"
   - Verify validation result

3. **Test debug functionality**:
   - Open Designer page
   - Click "Debug Page" in popup
   - Verify `wf.validateWFDL` availability

#### Automated Testing

Currently manual testing only. Future improvements:
- Unit tests for utility modules
- Integration tests for WebSocket communication
- E2E tests for Designer page interaction

### Code Quality

The extension follows these principles:
- **Separation of concerns**: Each file has a single responsibility
- **Modular architecture**: Reusable utility modules
- **Consistent error handling**: Unified error patterns
- **Comprehensive logging**: Debug information at all levels
- **Configuration management**: Centralized settings

## 🐛 Troubleshooting

### Common Issues

#### WebSocket Connection Failed
```
Error: Connection timeout
```
**Solution**:
- Verify WebSocket server is running
- Check `config.js` for correct WebSocket URL
- Ensure network connectivity

#### Validation Not Working
```
Error: wf.validateWFDL not available in page context
```
**Solution**:
- Ensure you're on a Webflow Designer page
- Refresh the Designer page
- Check browser console for JavaScript errors

#### Content Script Not Loading
```
Error: Cannot communicate with Designer page
```
**Solution**:
- Refresh the Designer page
- Check if extension is properly loaded
- Verify manifest.json permissions

#### Extension Not Visible
**Solution**:
- Check Chrome toolbar (may be hidden)
- Go to `chrome://extensions/` and verify extension is enabled
- Try reloading the extension

### Debug Information

Use the "Debug Page" button in the popup to get detailed information:
- `wf` object availability
- `wf.validateWFDL` function status
- Page context information
- Designer page detection

### Log Levels

Set appropriate log level in `config.js`:
- **debug**: Verbose logging for development
- **info**: Standard operation logging
- **warn**: Warning messages only
- **error**: Error messages only

## 📊 Performance

### Optimizations

- **Lazy loading**: Utility modules loaded on demand
- **Event-driven**: Minimal background processing
- **Efficient DOM**: Script injection with cleanup
- **Connection pooling**: Single WebSocket connection

### Resource Usage

- **Memory**: ~2-5MB typical usage
- **CPU**: Minimal when idle, brief spikes during validation
- **Network**: WebSocket connection + validation requests only

## 🔒 Security

### Content Security Policy (CSP)

The extension bypasses CSP restrictions by:
- Using `chrome.scripting.executeScript()` with `world: 'MAIN'`
- Injecting scripts directly into page DOM
- Cleaning up injected scripts immediately

### Permissions

The extension requires these permissions:
```json
{
  "permissions": [
    "activeTab",    // Access to current tab
    "scripting",    // Script injection capability
    "tabs",         // Tab information access
    "storage"       // Extension storage
  ],
  "host_permissions": [
    "https://webflow.com/*",
    "https://*.webflow.com/*",
    "https://*.design.webflow.com/*",
    "https://*.wfdev.io/*",
    "https://*.design.wfdev.io/*"
  ]
}
```

## 🚀 Future Improvements

### Planned Features

1. **Enhanced Testing**:
   - Unit test framework
   - Automated integration tests
   - Performance benchmarking

2. **UI Improvements**:
   - Dark mode support
   - Better error visualization
   - Export/import functionality

3. **Advanced Features**:
   - Validation result caching
   - Batch validation support
   - Custom validation rules

4. **Developer Experience**:
   - TypeScript definitions
   - Hot reload during development
   - Better debugging tools

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[Include your license information here]

## 🤝 Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the debug information

---

**Version**: 1.0.0
**Last Updated**: 2024
**Compatibility**: Chrome MV3, Webflow Designer
