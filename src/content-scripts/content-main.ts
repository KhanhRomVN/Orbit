// Firefox Content Script - Compatible with both Firefox and Chrome

// Type declarations for Firefox browser API (must be at global scope)
declare const browser: typeof chrome;

(function () {
  'use strict';

  // Firefox/Chrome API compatibility layer
  const browserAPI = (function () {
    if (typeof (globalThis as any).browser !== 'undefined') {
      return (globalThis as any).browser; // Firefox
    } else if (typeof (globalThis as any).chrome !== 'undefined') {
      return (globalThis as any).chrome; // Chrome
    }
    throw new Error('No browser API available');
  })();

  // Inline Logger
  class ContentLogger {
    log(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: any): void {
      const consoleMethod = (console as any)[level] || console.log;
      consoleMethod(`[content-script]`, message, context || '');
    }

    info(message: string, context?: any): void { this.log('info', message, context); }
    warn(message: string, context?: any): void { this.log('warn', message, context); }
    error(message: string, context?: any): void { this.log('error', message, context); }
    debug(message: string, context?: any): void { this.log('debug', message, context); }
  }

  const logger = new ContentLogger();

  // Inline PasteHandler
  class PasteHandler {
    async pasteContent(content: string, contentType?: string): Promise<boolean> {
      logger.info('🎯 PasteHandler.pasteContent called', {
        contentLength: content?.length || 0,
        contentType: contentType || 'unknown',
        hasContent: !!content
      });

      if (!content || typeof content !== 'string') {
        logger.error('❌ Invalid content provided to pasteContent', { content });
        return false;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      logger.info('📍 Active element info:', {
        hasActiveElement: !!activeElement,
        tagName: activeElement?.tagName,
        type: (activeElement as HTMLInputElement)?.type,
        isContentEditable: activeElement?.isContentEditable,
        id: activeElement?.id || 'no-id',
        className: activeElement?.className || 'no-class'
      });

      if (!activeElement) {
        logger.warn('❌ No active element found, searching for focusable elements...', {});

        const focusableSelectors = [
          'input:not([disabled]):not([readonly])',
          'textarea:not([disabled]):not([readonly])',
          '[contenteditable="true"]',
          '[contenteditable=""]'
        ];

        const focusableElements = document.querySelectorAll(focusableSelectors.join(', '));
        logger.info(`🔍 Found ${focusableElements.length} potentially focusable elements`, {});

        if (focusableElements.length > 0) {
          const firstFocusable = focusableElements[0] as HTMLElement;
          logger.info('🎯 Attempting to focus first focusable element:', {
            tagName: firstFocusable.tagName,
            type: (firstFocusable as HTMLInputElement).type
          });

          try {
            firstFocusable.focus();
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.pasteContent(content, contentType);
          } catch (focusError) {
            logger.error('❌ Failed to focus element:', focusError);
            return false;
          }
        }

        logger.error('❌ No focusable elements found on page', {});
        return false;
      }

      try {
        if (contentType === 'image' && content.startsWith('data:image/')) {
          logger.info('🖼️ Handling image content', {});
          return this.insertContent(activeElement, content, 'image');
        } else if (contentType === 'html' && this.isHtmlContent(content)) {
          logger.info('🌐 Handling HTML content', {});
          return this.insertContent(activeElement, content, 'html');
        } else if (contentType === 'url' && this.isUrlContent(content)) {
          logger.info('🔗 Handling URL content', {});
          return this.insertContent(activeElement, content, 'url');
        } else {
          logger.info('📝 Handling text content', {});
          return this.insertContent(activeElement, content, 'text');
        }
      } catch (error) {
        logger.error('💥 Error pasting content:', error);
        return false;
      }
    }

    private insertContent(element: HTMLElement, content: string, type: string): boolean {
      try {
        logger.info(`📝 Inserting ${type} content into ${element.tagName}`, {});

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          return this.pasteToInput(element, content, type);
        } else if (element.isContentEditable) {
          return this.pasteToContentEditable(element, content, type);
        } else {
          logger.warn('❌ Active element is not editable:', {
            tagName: element.tagName,
            contentEditable: element.getAttribute('contenteditable'),
            disabled: (element as HTMLInputElement).disabled,
            readOnly: (element as HTMLInputElement).readOnly
          });
          return false;
        }
      } catch (error) {
        logger.error('💥 Error inserting content:', error);
        return false;
      }
    }

    private triggerInputEvents(element: HTMLElement): void {
      try {
        const events = [
          new Event('focus', { bubbles: true }),
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new KeyboardEvent('keydown', { bubbles: true, key: 'v', ctrlKey: true }),
          new KeyboardEvent('keyup', { bubbles: true, key: 'v', ctrlKey: true })
        ];

        events.forEach(event => {
          try {
            element.dispatchEvent(event);
          } catch (e) {
            // Ignore individual event errors
          }
        });

        const reactKeys = Object.keys(element).find(key =>
          key.startsWith('__reactInternalInstance') || key.startsWith('_reactInternalFiber')
        );

        if (reactKeys) {
          logger.debug('🔄 Detected React component, triggering additional events', {});
          element.dispatchEvent(new Event('blur', { bubbles: true }));
          element.dispatchEvent(new Event('focus', { bubbles: true }));
        }

      } catch (error) {
        logger.warn('⚠️ Some input events failed to trigger:', error);
      }
    }

    private pasteToInput(element: HTMLInputElement | HTMLTextAreaElement, content: string, type: string): boolean {
      logger.info('📝 Pasting to input element:', {
        tagName: element.tagName,
        type: (element as HTMLInputElement).type,
        disabled: element.disabled,
        readOnly: element.readOnly,
        selectionStart: element.selectionStart,
        selectionEnd: element.selectionEnd,
        contentType: type
      });

      if (element.disabled || element.readOnly) {
        logger.warn('⚠️ Element is disabled or readonly', {});
        return false;
      }

      try {
        const start = element.selectionStart || 0;
        const end = element.selectionEnd || 0;

        logger.info(`📍 Inserting content at position ${start}-${end}`, {});

        let insertContent = content;
        if (type === 'image' && content.startsWith('data:image/') && element.tagName === 'INPUT') {
          if (content.length > 2000) {
            insertContent = '[Image data - too large for text field]';
            logger.info('🖼️ Image data URL truncated for input field', {});
          }
        }

        const newValue = element.value.substring(0, start) + insertContent + element.value.substring(end);
        element.value = newValue;

        const newCursorPos = start + insertContent.length;
        element.selectionStart = element.selectionEnd = newCursorPos;

        logger.info(`🎯 New cursor position: ${newCursorPos}, value length: ${newValue.length}`, {});

        this.triggerInputEvents(element);
        element.focus();

        logger.info('✅ Input paste completed successfully', {});
        return true;

      } catch (error) {
        logger.error('❌ Failed to paste to input:', error);
        return false;
      }
    }

    private pasteToContentEditable(element: HTMLElement, content: string, type: string): boolean {
      logger.info('📝 Pasting to contentEditable element', { contentType: type });

      try {
        const selection = window.getSelection();
        logger.info('🎯 Current selection:', {
          hasSelection: !!selection,
          rangeCount: selection?.rangeCount || 0,
          isCollapsed: selection?.isCollapsed
        });

        if (!selection || selection.rangeCount === 0) {
          logger.info('❌ No selection found, creating one at end of element', {});

          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }

        const range = selection!.getRangeAt(0);
        range.deleteContents();

        let nodeToInsert: Node;

        if (type === 'html' && this.isHtmlContent(content)) {
          logger.info('🌐 Inserting HTML content', {});
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;

          const fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
          nodeToInsert = fragment;
        } else if (type === 'url') {
          logger.info('🔗 Inserting URL as link', {});
          const link = document.createElement('a');
          link.href = content;
          link.textContent = content;
          link.target = '_blank';
          nodeToInsert = link;
        } else if (type === 'image' && content.startsWith('data:image/')) {
          logger.info('🖼️ Inserting image', {});
          const img = document.createElement('img');
          img.src = content;
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          nodeToInsert = img;
        } else {
          logger.info('📝 Inserting as text', {});
          nodeToInsert = document.createTextNode(content);
        }

        range.insertNode(nodeToInsert);

        range.setStartAfter(nodeToInsert);
        range.setEndAfter(nodeToInsert);
        selection!.removeAllRanges();
        selection!.addRange(range);

        this.triggerInputEvents(element);
        element.focus();

        logger.info('✅ ContentEditable paste completed successfully', {});
        return true;

      } catch (error) {
        logger.error('❌ Failed to paste to contentEditable:', error);
        return false;
      }
    }

    private isHtmlContent(content: string): boolean {
      const trimmed = content.trim();
      return trimmed.includes('<') && trimmed.includes('>') &&
        (trimmed.includes('</') || trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE'));
    }

    private isUrlContent(content: string): boolean {
      try {
        new URL(content);
        return true;
      } catch {
        return false;
      }
    }

    isActiveElementPasteable(): boolean {
      const activeElement = document.activeElement as HTMLElement | null;
      logger.debug('🔍 Checking if active element is pasteable:', activeElement?.tagName);

      if (!activeElement) {
        return false;
      }

      if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
        const inputElement = activeElement as HTMLInputElement | HTMLTextAreaElement;
        return !inputElement.disabled && !inputElement.readOnly;
      }

      return activeElement.isContentEditable;
    }

    getActiveElementInfo(): {
      tagName: string;
      type: string;
      canPaste: boolean;
      selectionStart?: number;
      selectionEnd?: number;
    } | null {
      const activeElement = document.activeElement as HTMLElement | null;

      if (!activeElement) {
        return null;
      }

      const info = {
        tagName: activeElement.tagName,
        type: 'unknown',
        canPaste: this.isActiveElementPasteable()
      };

      if (activeElement.tagName === 'INPUT') {
        const inputElement = activeElement as HTMLInputElement;
        return {
          ...info,
          type: inputElement.type || 'text',
          selectionStart: inputElement.selectionStart || 0,
          selectionEnd: inputElement.selectionEnd || 0
        };
      }

      if (activeElement.tagName === 'TEXTAREA') {
        const textareaElement = activeElement as HTMLTextAreaElement;
        return {
          ...info,
          type: 'textarea',
          selectionStart: textareaElement.selectionStart || 0,
          selectionEnd: textareaElement.selectionEnd || 0
        };
      }

      if (activeElement.isContentEditable) {
        return {
          ...info,
          type: 'contenteditable'
        };
      }

      return info;
    }
  }

  // Main Content Script Class
  class ContentScriptMain {
    private pasteHandler: PasteHandler;

    constructor() {
      logger.info('🎯 ContentScriptMain initializing...', {
        url: window.location.href,
        title: document.title
      });
      this.pasteHandler = new PasteHandler();
      this.initialize();
      logger.info('✅ ContentScriptMain initialized successfully', {});
    }

    initialize(): void {
      logger.info('📡 Setting up message listener...', {});

      browserAPI.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response: any) => void) => {
        logger.info('📨 Content script received message:', {
          action: message.action,
          hasContent: !!message.content,
          contentType: message.contentType,
          contentLength: message.content?.length || 0
        });

        this.handleMessage(message, _sender, sendResponse);
        return true;
      });

      const activeElement = document.activeElement as HTMLElement | null;
      logger.info('🌐 Content script loaded on page:', {
        url: window.location.href,
        title: document.title,
        activeElementTag: activeElement?.tagName,
        isContentEditable: activeElement?.isContentEditable,
        readyState: document.readyState
      });

      if (document.readyState !== 'complete') {
        window.addEventListener('load', () => {
          logger.info('🔄 Page fully loaded, content script ready', {});
        });
      }
    }

    async handleMessage(message: any, _sender: any, sendResponse: (response: any) => void): Promise<void> {
      const startTime = Date.now();
      logger.info(`🔄 Processing message action: ${message.action}`, {});

      try {
        switch (message.action) {
          case 'ping':
            logger.info('🏓 Responding to ping', {});
            sendResponse({ success: true, timestamp: Date.now() });
            break;

          case 'pasteClipboardItem':
          case 'pasteDirectValue':
            await this.handlePasteRequest(message, sendResponse);
            break;

          case 'getActiveElementInfo':
            const elementInfo = this.pasteHandler.getActiveElementInfo();
            logger.info('📍 Returning active element info:', elementInfo);
            sendResponse({ success: true, elementInfo });
            break;

          case 'checkPasteability':
            const canPaste = this.pasteHandler.isActiveElementPasteable();
            logger.info(`✅ Element pasteable: ${canPaste}`, {});
            sendResponse({ success: true, canPaste });
            break;

          case 'showAlert':
            logger.info(`🚨 Showing alert: ${message.message}`, {});
            alert(message.message);
            sendResponse({ success: true });
            break;

          default:
            logger.warn(`❓ Unknown action: ${message.action}`, {});
            sendResponse({
              success: false,
              error: `Unknown action: ${message.action}`
            });
        }

        const duration = Date.now() - startTime;
        logger.info(`⏱️ Message processing completed in ${duration}ms`, {});

      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`💥 Content script error after ${duration}ms:`, error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        sendResponse({
          success: false,
          error: errorMessage,
          duration
        });
      }
    }

    async handlePasteRequest(message: any, sendResponse: (response: any) => void): Promise<void> {
      logger.info(`📋 Handling paste request:`, {
        hasContent: !!message.content,
        contentLength: message.content?.length || 0,
        contentType: message.contentType || 'unknown',
        itemId: message.itemId
      });

      if (!message.content || typeof message.content !== 'string') {
        logger.error('❌ Invalid content in paste request', {});
        sendResponse({
          success: false,
          error: 'Invalid or missing content'
        });
        return;
      }

      if (message.content.length === 0) {
        logger.warn('⚠️ Empty content provided', {});
        sendResponse({
          success: false,
          error: 'Content is empty'
        });
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      logger.info('🎯 Current active element before paste:', {
        hasElement: !!activeElement,
        tagName: activeElement?.tagName,
        type: (activeElement as HTMLInputElement)?.type,
        isContentEditable: activeElement?.isContentEditable,
        id: activeElement?.id || 'no-id',
        className: activeElement?.className || 'no-class',
        disabled: (activeElement as HTMLInputElement)?.disabled,
        readOnly: (activeElement as HTMLInputElement)?.readOnly
      });

      if (document.readyState === 'loading') {
        logger.warn('⚠️ Document still loading, waiting...', {});
        await new Promise<void>(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
          }
        });
      }

      try {
        const pasteSuccess = await this.pasteHandler.pasteContent(
          message.content,
          message.contentType
        );

        logger.info(`📝 Paste operation result: ${pasteSuccess ? 'SUCCESS' : 'FAILED'}`, {});

        if (pasteSuccess) {
          const postPasteElement = document.activeElement as HTMLElement | null;
          const verification = this.verifyPasteSuccess(message.content, postPasteElement);

          sendResponse({
            success: true,
            itemId: message.itemId,
            verification: verification
          });
        } else {
          sendResponse({
            success: false,
            error: 'Paste operation failed - no suitable element found or content could not be inserted',
            activeElementInfo: this.pasteHandler.getActiveElementInfo()
          });
        }

      } catch (error) {
        logger.error('💥 Paste operation threw error:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown paste error',
          activeElementInfo: this.pasteHandler.getActiveElementInfo()
        });
      }
    }

    verifyPasteSuccess(expectedContent: string, element: HTMLElement | null): {
      verified: boolean;
      reason: string;
      actualLength?: number;
      expectedLength?: number;
      elementType?: string;
      error?: string;
    } {
      if (!element) return { verified: false, reason: 'no_element' };

      try {
        let actualContent = '';

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          actualContent = element.value;
        } else if (element.isContentEditable) {
          actualContent = element.textContent || element.innerText || '';
        }

        const contentMatches = actualContent.includes(expectedContent.substring(0, 100));

        return {
          verified: contentMatches,
          reason: contentMatches ? 'content_found' : 'content_not_found',
          actualLength: actualContent.length,
          expectedLength: expectedContent.length,
          elementType: element.tagName.toLowerCase()
        };
      } catch (error) {
        return {
          verified: false,
          reason: 'verification_error',
          error: error instanceof Error ? error.message : 'unknown'
        };
      }
    }
  }

  // Initialize content script
  logger.info('🚀 Starting ContentScriptMain...', {});
  try {
    new ContentScriptMain();
  } catch (error) {
    logger.error('💥 Failed to initialize ContentScriptMain:', error);
  }

})();