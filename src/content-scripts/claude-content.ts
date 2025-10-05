(function () {
  "use strict";

  // DOM Selectors cho Claude.ai
  const SELECTORS = {
    inputArea:
      '.ProseMirror[contenteditable="true"][aria-label="Write your prompt to Claude"]',
    sendButton: 'button[aria-label="Send message"]',
    stopButton: 'button[aria-label="Stop response"]',
    copyButton: 'button[data-testid="action-bar-copy"]',
  };

  interface SendPromptResponse {
    success: boolean;
    response?: string;
    error?: string;
    errorType?:
      | "timeout"
      | "rate_limit"
      | "network"
      | "dom_not_found"
      | "unknown";
  }

  class ClaudeAssistant {
    private currentPrompt = "";
    private readonly MAX_WAIT_TIME = 120000; // 2 phút timeout

    constructor() {
      this.setupMessageListener();
      console.log("[ClaudeContent] ✅ Initialized");
    }

    private setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        (async () => {
          try {
            console.log("[ClaudeContent] 📩 Received message:", request.action);

            switch (request.action) {
              case "ping":
                sendResponse({ success: true });
                break;

              case "sendPrompt":
                const result = await this.sendPrompt(request.prompt);
                sendResponse(result);
                break;

              default:
                sendResponse({
                  success: false,
                  error: "Unknown action",
                  errorType: "unknown",
                });
            }
          } catch (error) {
            console.error("[ClaudeContent] ❌ Error handling message:", error);
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            sendResponse({
              success: false,
              error: errorMessage,
              errorType: "unknown",
            });
          }
        })();

        return true; // Keep message channel open
      });
    }

    async sendPrompt(prompt: string): Promise<SendPromptResponse> {
      try {
        this.currentPrompt = prompt;
        console.log(
          "[ClaudeContent] 📝 Sending prompt:",
          prompt.substring(0, 50) + "..."
        );

        // 1. Tìm input area
        const inputArea = this.findInputArea();
        if (!inputArea) {
          return {
            success: false,
            error:
              "Input area not found. Make sure you're on claude.ai chat page.",
            errorType: "dom_not_found",
          };
        }

        // 2. Nhập prompt vào input
        await this.setPrompt(inputArea, prompt);
        console.log("[ClaudeContent] ✅ Prompt set successfully");

        // 3. Tìm và click send button
        const sendButton = this.findSendButton();
        if (!sendButton || sendButton.disabled) {
          return {
            success: false,
            error: "Send button not available or disabled",
            errorType: "dom_not_found",
          };
        }

        sendButton.click();
        console.log("[ClaudeContent] ✅ Send button clicked");

        // 4. Chờ response
        const response = await this.waitForResponse();

        if (response.success) {
          console.log(
            "[ClaudeContent] ✅ Response received:",
            response.response?.substring(0, 100) + "..."
          );
          return response;
        } else {
          return response;
        }
      } catch (error) {
        console.error("[ClaudeContent] ❌ Error sending prompt:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
          errorType: "unknown",
        };
      }
    }

    private findInputArea(): HTMLElement | null {
      const element = document.querySelector(
        SELECTORS.inputArea
      ) as HTMLElement;
      if (element && element.isContentEditable) {
        return element;
      }
      return null;
    }

    private findSendButton(): HTMLButtonElement | null {
      return document.querySelector(SELECTORS.sendButton) as HTMLButtonElement;
    }

    private findStopButton(): HTMLButtonElement | null {
      return document.querySelector(SELECTORS.stopButton) as HTMLButtonElement;
    }

    private findCopyButton(): HTMLButtonElement | null {
      return document.querySelector(SELECTORS.copyButton) as HTMLButtonElement;
    }

    private async setPrompt(
      inputArea: HTMLElement,
      prompt: string
    ): Promise<void> {
      // Focus input area
      inputArea.focus();

      // Clear existing content
      inputArea.innerHTML = "";

      // Set new content
      const p = document.createElement("p");
      p.textContent = prompt;
      inputArea.appendChild(p);

      // Trigger events để Claude.ai detect change
      const events = ["input", "change", "keydown", "keyup"];
      events.forEach((eventType) => {
        inputArea.dispatchEvent(new Event(eventType, { bubbles: true }));
      });

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    private async waitForResponse(): Promise<SendPromptResponse> {
      return new Promise((resolve) => {
        const startTime = Date.now();
        let lastCheckHadStopButton = false;

        const checkInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;

          // Check timeout (2 phút)
          if (elapsed > this.MAX_WAIT_TIME) {
            clearInterval(checkInterval);
            console.error("[ClaudeContent] ⏱️ Timeout after 2 minutes");
            resolve({
              success: false,
              error:
                "Response timeout after 2 minutes. Claude might be overloaded or rate limited.",
              errorType: "timeout",
            });
            return;
          }

          const stopButton = this.findStopButton();
          const copyButton = this.findCopyButton();

          // Track nếu có stop button (đang generate)
          if (stopButton) {
            lastCheckHadStopButton = true;
          }

          // Response hoàn thành khi:
          // 1. Stop button biến mất
          // 2. Copy button xuất hiện (đảm bảo có response)
          // 3. Trước đó đã từng thấy stop button (đảm bảo đã bắt đầu generate)
          if (!stopButton && copyButton && lastCheckHadStopButton) {
            clearInterval(checkInterval);

            // Đợi thêm 500ms để đảm bảo DOM đã render xong
            setTimeout(() => {
              const response = this.extractLatestResponse();
              if (response) {
                resolve({
                  success: true,
                  response: response,
                });
              } else {
                resolve({
                  success: false,
                  error: "Could not extract response from page",
                  errorType: "dom_not_found",
                });
              }
            }, 500);
          }
        }, 1000); // Check mỗi giây
      });
    }

    private extractLatestResponse(): string | null {
      // Tìm tất cả message blocks trong conversation
      // Claude.ai structure: có nhiều div chứa messages, AI response thường ở cuối

      // Strategy 1: Tìm div gần copy button gần nhất
      const copyButtons = document.querySelectorAll(SELECTORS.copyButton);
      if (copyButtons.length > 0) {
        const lastCopyButton = copyButtons[copyButtons.length - 1];

        // Traverse lên để tìm message container
        let messageContainer =
          lastCopyButton.closest('[data-testid*="message"]') ||
          lastCopyButton.closest('div[class*="message"]');

        if (messageContainer) {
          // Lấy text content, loại bỏ button text
          const clone = messageContainer.cloneNode(true) as HTMLElement;

          // Xóa các button/action bar
          clone.querySelectorAll("button").forEach((btn) => btn.remove());

          const text = clone.innerText.trim();
          if (text) return text;
        }
      }

      // Strategy 2: Tìm các message block theo class pattern
      const possibleSelectors = [
        '[class*="font-claude-message"]',
        '[data-testid="message"]',
        ".group.relative",
        '[role="article"]',
      ];

      for (const selector of possibleSelectors) {
        const messages = document.querySelectorAll(selector);
        if (messages.length > 0) {
          // Lấy message cuối cùng (của AI)
          for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i] as HTMLElement;
            const text = message.innerText?.trim();

            // Bỏ qua message của user (thường chứa prompt)
            if (text && !text.includes(this.currentPrompt)) {
              return text;
            }
          }
        }
      }

      // Strategy 3: Fallback - lấy toàn bộ text sau input area
      console.warn("[ClaudeContent] ⚠️ Using fallback extraction method");
      const bodyText = document.body.innerText;
      const promptIndex = bodyText.lastIndexOf(this.currentPrompt);

      if (promptIndex !== -1) {
        const afterPrompt = bodyText
          .substring(promptIndex + this.currentPrompt.length)
          .trim();
        // Lấy 5000 ký tự đầu (tránh lấy quá nhiều)
        return afterPrompt.substring(0, 5000);
      }

      return null;
    }
  }

  // Initialize content script
  new ClaudeAssistant();
})();
