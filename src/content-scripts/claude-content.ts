(function () {
  "use strict";

  // Define proper interfaces for better type safety
  interface SendPromptResponse {
    success: boolean;
    response?: string;
    error?: string;
  }

  class ClaudeAssistant {
    private currentPrompt = "";

    constructor() {
      this.setupMessageListener();
      console.log("Claude Assistant content script loaded");
    }

    private setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        (async () => {
          try {
            switch (request.action) {
              case "ping":
                sendResponse({ success: true });
                break;

              case "sendPrompt":
                const result = await this.sendPrompt(request.prompt);
                sendResponse(result);
                break;

              default:
                sendResponse({ success: false, error: "Unknown action" });
            }
          } catch (error) {
            console.error("Error handling message:", error);
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            sendResponse({ success: false, error: errorMessage });
          }
        })();

        return true;
      });
    }

    async sendPrompt(prompt: string): Promise<SendPromptResponse> {
      try {
        this.currentPrompt = prompt;

        // Find the input area
        const inputArea = this.findInputArea();
        if (!inputArea) {
          return { success: false, error: "Input area not found" };
        }

        // Clear and set the prompt
        await this.setPrompt(inputArea, prompt);

        // Click send button
        const sendButton = this.findSendButton();
        if (!sendButton || sendButton.disabled) {
          return { success: false, error: "Send button not available" };
        }

        sendButton.click();

        // Wait for response
        const response = await this.waitForResponse();
        return { success: true, response };
      } catch (error) {
        console.error("Error sending prompt:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
      }
    }

    private findInputArea(): HTMLElement | null {
      // Try multiple selectors for the input area
      const selectors = [
        '[contenteditable="true"][aria-label="Write your prompt to Claude"]',
        '[contenteditable="true"]',
        ".ProseMirror",
        'div[contenteditable="true"]',
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector) as HTMLElement;
        if (element && element.isContentEditable) {
          return element;
        }
      }
      return null;
    }

    private findSendButton(): HTMLButtonElement | null {
      const selectors = [
        'button[aria-label="Send message"]',
        "button:has(svg)",
        'button[type="button"]',
      ];

      for (const selector of selectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          if (
            button.textContent?.includes("Send") ||
            button.getAttribute("aria-label")?.includes("Send")
          ) {
            return button as HTMLButtonElement;
          }
        }
      }
      return null;
    }

    private findStopButton(): HTMLButtonElement | null {
      return document.querySelector(
        'button[aria-label="Stop response"]'
      ) as HTMLButtonElement;
    }

    private async setPrompt(
      inputArea: HTMLElement,
      prompt: string
    ): Promise<void> {
      // Focus the input area
      inputArea.focus();

      // Clear existing content
      inputArea.innerHTML = "";

      // Create paragraph element with the prompt
      const p = document.createElement("p");
      p.textContent = prompt;
      inputArea.appendChild(p);

      // Trigger input events
      const events = ["input", "change", "keydown", "keyup"];
      events.forEach((eventType) => {
        inputArea.dispatchEvent(new Event(eventType, { bubbles: true }));
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    private async waitForResponse(): Promise<string> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Response timeout after 2 minutes"));
        }, 120000);

        const checkInterval = setInterval(() => {
          // Check if stop button is gone and send button is back
          const stopButton = this.findStopButton();
          const sendButton = this.findSendButton();

          if (!stopButton && sendButton && !sendButton.disabled) {
            // Response is complete, get the latest response
            const response = this.getLatestResponse();
            if (response) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              resolve(response);
            }
          }
        }, 1000);
      });
    }

    private getLatestResponse(): string | null {
      // Find the latest response in the conversation
      const messageSelectors = [
        '[data-testid="message"]',
        ".message",
        '[class*="message"]',
      ];

      let latestResponse = null;

      for (const selector of messageSelectors) {
        const messages = document.querySelectorAll(selector);
        for (let i = messages.length - 1; i >= 0; i--) {
          const message = messages[i];
          const text = message.textContent?.trim();
          if (text && text.length > 0 && !text.includes(this.currentPrompt)) {
            latestResponse = text;
            break;
          }
        }
        if (latestResponse) break;
      }

      return latestResponse;
    }
  }

  // Initialize the content script
  new ClaudeAssistant();
})();
