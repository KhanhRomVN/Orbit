// Manager for content script communication

export class ContentScriptManager {
  static async injectContentScript(tabId: number): Promise<void> {
    try {
      // Kiểm tra xem content script đã được inject chưa
      const isInjected = await this.isContentScriptInjected(tabId);
      if (isInjected) {
        console.log(`Content script already injected in tab ${tabId}`);
        return;
      }

      console.log(`Injecting content script into tab ${tabId}`);
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-main.js']
      });

      // Chờ một chút để content script khởi tạo
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log(`Content script injected successfully in tab ${tabId}`);
    } catch (error) {
      console.error('Failed to inject content script:', error);
      throw error;
    }
  }

  static async sendMessageToTab(tabId: number, message: any, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Sending message to tab ${tabId} (attempt ${i + 1}/${retries})`);

        // Đảm bảo content script đã được inject
        await this.injectContentScript(tabId);

        // Send message - use direct value pasting for clipboard items
        const finalMessage = {
          ...message,
          // Always use direct paste for clipboard items
          action: message.action === 'pasteClipboardItem' ? 'pasteDirectValue' : message.action
        };

        // Gửi message
        const response = await chrome.tabs.sendMessage(tabId, finalMessage);

        if (response && response.success) {
          console.log(`Message sent successfully to tab ${tabId}`);
          return response;
        } else {
          console.warn(`Message failed in tab ${tabId}, response:`, response);
        }
      } catch (error) {
        console.error(`Failed to send message to tab ${tabId} (attempt ${i + 1}):`, error);

        if (i === retries - 1) {
          throw error;
        }

        // Chờ trước khi retry
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    throw new Error(`Failed to send message after ${retries} attempts`);
  }

  static async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        console.warn('No active tab found');
        return null;
      }

      console.log('Active tab:', {
        id: tab.id,
        url: tab.url,
        title: tab.title
      });

      return tab;
    } catch (error) {
      console.error('Failed to get active tab:', error);
      return null;
    }
  }

  static async isContentScriptInjected(tabId: number): Promise<boolean> {
    try {
      // Timeout cho ping message
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { action: 'ping' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 1000)
        )
      ]);

      const isInjected = response && response.success === true;
      console.log(`Content script ${isInjected ? 'is' : 'is not'} injected in tab ${tabId}`);
      return isInjected;
    } catch (error) {
      console.log(`Content script not detected in tab ${tabId}:`, error);
      return false;
    }
  }

  static isTabSupported(tab: chrome.tabs.Tab): boolean {
    if (!tab.url) {
      console.warn('Tab URL is undefined');
      return false;
    }

    const unsupportedUrls = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'about:',
      'edge://',
      'safari-extension://'
    ];

    const isSupported = !unsupportedUrls.some(prefix => tab.url!.startsWith(prefix));

    if (!isSupported) {
      console.warn(`Tab URL not supported: ${tab.url}`);
    }

    return isSupported;
  }
}