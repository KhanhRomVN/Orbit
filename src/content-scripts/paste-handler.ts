// src/content-scripts/paste-handler.ts - SAFE VERSION
import { logger } from '../shared/utils/logger';
import { sanitizeHTML } from '../shared/utils/html-sanitizer';

export class PasteHandler {
  /**
   * Paste content to the currently active element on the page
   */
  async pasteContent(content: string, contentType?: string): Promise<boolean> {
    logger.info('🎯 PasteHandler.pasteContent called', {
      contentLength: content?.length || 0,
      contentType: contentType || 'unknown',
      hasContent: !!content
    });

    // Validate input
    if (!content || typeof content !== 'string') {
      logger.error('❌ Invalid content provided to pasteContent');
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
      logger.warn('❌ No active element found, searching for focusable elements...');

      // Try to find any focusable element as fallback
      const focusableSelectors = [
        'input:not([disabled]):not([readonly])',
        'textarea:not([disabled]):not([readonly])',
        '[contenteditable="true"]',
        '[contenteditable=""]'
      ];

      const focusableElements = document.querySelectorAll(focusableSelectors.join(', '));
      logger.info(`🔍 Found ${focusableElements.length} potentially focusable elements`);

      if (focusableElements.length > 0) {
        const firstFocusable = focusableElements[0] as HTMLElement;
        logger.info('🎯 Attempting to focus first focusable element:', {
          tagName: firstFocusable.tagName,
          type: (firstFocusable as HTMLInputElement).type
        });

        try {
          firstFocusable.focus();

          // Wait a moment for focus to take effect
          await new Promise(resolve => setTimeout(resolve, 100));

          // Retry with newly focused element
          return this.pasteContent(content, contentType);
        } catch (focusError) {
          logger.error('❌ Failed to focus element:', focusError);
          return false;
        }
      }

      logger.error('❌ No focusable elements found on page');
      return false;
    }

    try {
      // Special handling for different content types
      if (contentType === 'image' && content.startsWith('data:image/')) {
        logger.info('🖼️ Handling image content');
        return this.insertContent(activeElement, content, 'image');
      } else if (contentType === 'html' && this.isHtmlContent(content)) {
        logger.info('🌐 Handling HTML content - will be sanitized');
        // ALWAYS sanitize HTML content for security
        const sanitizedContent = sanitizeHTML(content);
        return this.insertContent(activeElement, sanitizedContent, 'html');
      } else if (contentType === 'url' && this.isUrlContent(content)) {
        logger.info('🔗 Handling URL content');
        return this.insertContent(activeElement, content, 'url');
      } else {
        logger.info('📝 Handling text content');
        return this.insertContent(activeElement, content, 'text');
      }
    } catch (error) {
      logger.error('💥 Error pasting content:', error);
      return false;
    }
  }

  /**
   * Insert content into the active element with type-specific handling
   */
  private insertContent(element: HTMLElement, content: string, type: string): boolean {
    try {
      logger.info(`📝 Inserting ${type} content into ${element.tagName}`);

      // For input and textarea elements
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return this.pasteToInput(element, content, type);
      }
      // For contenteditable elements
      else if (element.isContentEditable) {
        return this.pasteToContentEditable(element, content, type);
      }
      else {
        logger.warn('❌ Active element is not editable:', {
          tagName: element.tagName,
          contentEditable: element.getAttribute('contenteditable'),
          disabled: (element as any).disabled,
          readonly: (element as any).readonly
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
      // Trigger events in the correct order for maximum compatibility
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

      // Special handling for React and Vue.js
      const reactKeys = Object.keys(element).find(key =>
        key.startsWith('__reactInternalInstance') || key.startsWith('_reactInternalFiber')
      );

      if (reactKeys) {
        logger.debug('🔄 Detected React component, triggering additional events');
        // React specific events
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        element.dispatchEvent(new Event('focus', { bubbles: true }));
      }

    } catch (error) {
      logger.warn('⚠️ Some input events failed to trigger:', error);
    }
  }

  /**
   * Paste content to input or textarea elements
   */
  private pasteToInput(element: HTMLInputElement | HTMLTextAreaElement, content: string, type: string): boolean {
    logger.info('📝 Pasting to input element:', {
      tagName: element.tagName,
      type: element.type,
      disabled: element.disabled,
      readOnly: element.readOnly,
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd,
      contentType: type
    });

    if (element.disabled || element.readOnly) {
      logger.warn('⚠️ Element is disabled or readonly');
      return false;
    }

    try {
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;

      logger.info(`📍 Inserting content at position ${start}-${end}`);

      // For image data URLs in regular inputs, we might want to just insert the URL
      let insertContent = content;
      if (type === 'image' && content.startsWith('data:image/') && element.tagName === 'INPUT') {
        // For regular inputs, data URLs might be too long, so we could truncate or provide alternative
        if (content.length > 2000) {
          insertContent = '[Image data - too large for text field]';
          logger.info('🖼️ Image data URL truncated for input field');
        }
      }

      // Insert content at cursor position
      const newValue = element.value.substring(0, start) + insertContent + element.value.substring(end);
      element.value = newValue;

      // Set cursor position after inserted content
      const newCursorPos = start + insertContent.length;
      element.selectionStart = element.selectionEnd = newCursorPos;

      logger.info(`🎯 New cursor position: ${newCursorPos}, value length: ${newValue.length}`);

      // Trigger input events for frameworks like React/Vue to detect changes
      this.triggerInputEvents(element);

      // Ensure the element is focused
      element.focus();

      logger.info('✅ Input paste completed successfully');
      return true;

    } catch (error) {
      logger.error('❌ Failed to paste to input:', error);
      return false;
    }
  }

  /**
   * SAFE: Paste content to contentEditable elements using DOM methods instead of innerHTML
   */
  private pasteToContentEditable(element: HTMLElement, content: string, type: string): boolean {
    logger.info('📝 Pasting to contentEditable element', { contentType: type });

    try {
      const selection = window.getSelection();
      logger.info('🎯 Current selection:', {
        hasSelection: !!selection,
        rangeCount: selection?.rangeCount || 0,
        isCollapsed: selection?.isCollapsed
      });

      // Ensure we have a selection
      if (!selection || selection.rangeCount === 0) {
        logger.info('❌ No selection found, creating one at end of element');

        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false); // Collapse to end
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      const range = selection!.getRangeAt(0);

      // Clear existing selection
      range.deleteContents();

      let nodeToInsert: Node;

      // Handle different content types for contentEditable
      if (type === 'html') {
        logger.info('🌐 Inserting sanitized HTML content using safe DOM methods');
        nodeToInsert = this.createSafeHTMLFragment(content);
      } else if (type === 'url') {
        logger.info('🔗 Inserting URL as link');
        const link = document.createElement('a');
        link.href = this.sanitizeURL(content);
        link.textContent = content;
        link.target = '_blank';
        link.rel = 'noopener noreferrer'; // Security: prevent window.opener access
        nodeToInsert = link;
      } else if (type === 'image' && content.startsWith('data:image/')) {
        logger.info('🖼️ Inserting image');
        const img = document.createElement('img');
        img.src = content;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.alt = 'Pasted image';
        nodeToInsert = img;
      } else {
        logger.info('📝 Inserting as text');
        nodeToInsert = document.createTextNode(content);
      }

      // Insert the content
      range.insertNode(nodeToInsert);

      // Move cursor to end of inserted content
      range.setStartAfter(nodeToInsert);
      range.setEndAfter(nodeToInsert);
      selection!.removeAllRanges();
      selection!.addRange(range);

      // Trigger input events for frameworks to detect changes
      this.triggerInputEvents(element);

      // Ensure the element is focused
      element.focus();

      logger.info('✅ ContentEditable paste completed successfully');
      return true;

    } catch (error) {
      logger.error('❌ Failed to paste to contentEditable:', error);
      return false;
    }
  }

  /**
   * SAFE: Create HTML fragment using DOM methods instead of innerHTML
   */
  private createSafeHTMLFragment(html: string): DocumentFragment {
    // First sanitize the HTML
    const sanitizedHTML = sanitizeHTML(html);

    // Use DOMParser instead of innerHTML for security
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedHTML, 'text/html');

    // Create a document fragment and move all body children to it
    const fragment = document.createDocumentFragment();
    while (doc.body.firstChild) {
      fragment.appendChild(doc.body.firstChild);
    }

    return fragment;
  }

  /**
   * SAFE: Sanitize URLs to prevent javascript: and other dangerous protocols
   */
  private sanitizeURL(url: string): string {
    try {
      const urlObj = new URL(url);

      // Only allow safe protocols
      const safeProtocols = ['http:', 'https:', 'ftp:', 'mailto:'];
      if (!safeProtocols.includes(urlObj.protocol)) {
        return '#'; // Return safe fallback
      }

      return urlObj.href;
    } catch {
      // If URL parsing fails, return safe fallback
      return '#';
    }
  }

  /**
   * Check if content appears to be HTML
   */
  private isHtmlContent(content: string): boolean {
    const trimmed = content.trim();
    return trimmed.includes('<') && trimmed.includes('>') &&
      (trimmed.includes('</') || trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE'));
  }

  /**
   * Check if content is a URL
   */
  private isUrlContent(content: string): boolean {
    try {
      new URL(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if the current active element can receive pasted content
   */
  isActiveElementPasteable(): boolean {
    const activeElement = document.activeElement as HTMLElement | null;
    logger.debug('🔍 Checking if active element is pasteable:', activeElement?.tagName);

    if (!activeElement) {
      return false;
    }

    // Check if element is an input/textarea
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
      const inputElement = activeElement as HTMLInputElement | HTMLTextAreaElement;
      return !inputElement.disabled && !inputElement.readOnly;
    }

    // Check if element is contentEditable
    return activeElement.isContentEditable;
  }

  /**
   * Get information about the currently active element
   */
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