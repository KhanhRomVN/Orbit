import React, { useState, useMemo } from "react";
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image,
  Link,
  Edit3,
  Save,
  X,
  Heart,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { ClipboardItem } from "../../../types/clipboard";
import {
  sanitizeHTML,
  isSafeHTML,
  extractTextFromHTML,
} from "../../../shared/utils/html-sanitizer";

interface ClipboardContentViewerProps {
  item: ClipboardItem | null;
  onCopyToClipboard: (content: string) => void;
  onUpdateItem?: (id: string, updates: Partial<ClipboardItem>) => void;
  onToggleFavorite?: (id: string) => void;
}

const ClipboardContentViewer: React.FC<ClipboardContentViewerProps> = ({
  item,
  onCopyToClipboard,
  onUpdateItem,
  onToggleFavorite,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showRawContent] = useState(false);
  const [htmlRenderMode, setHtmlRenderMode] = useState<"safe" | "raw" | "text">(
    "safe"
  );

  // Memoize HTML safety check and sanitization
  const htmlInfo = useMemo(() => {
    if (!item || item.type !== "html") return null;

    const isContentSafe = isSafeHTML(item.content);
    const sanitizedContent = sanitizeHTML(item.content);
    const textContent = extractTextFromHTML(item.content);

    return {
      isContentSafe,
      sanitizedContent,
      textContent,
    };
  }, [item]);

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-lg bg-card-background">
        <div className="text-center text-text-secondary p-4">
          <FileText size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-base font-medium mb-1">No item selected</p>
          <p className="text-sm">Select a clipboard item to view its content</p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getItemIcon = () => {
    switch (item.type) {
      case "image":
        return <Image size={18} className="text-blue-500" />;
      case "url":
        return <Link size={18} className="text-green-500" />;
      case "html":
        return <FileText size={18} className="text-orange-500" />;
      default:
        return <FileText size={18} className="text-gray-500" />;
    }
  };

  const handleStartEdit = () => {
    setEditTitle(item.title);
    setEditContent(item.content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (
      onUpdateItem &&
      (editTitle !== item.title || editContent !== item.content)
    ) {
      onUpdateItem(item.id, {
        title: editTitle.trim() || item.title,
        content: editContent,
        size: new Blob([editContent]).size,
      });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle("");
    setEditContent("");
  };

  const handleDownload = () => {
    const blob = new Blob([item.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenUrl = () => {
    if (item.type === "url") {
      window.open(item.content, "_blank");
    }
  };

  const handleToggleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite(item.id);
    }
  };

  const renderSafeHTMLContent = (content: string) => {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded border border-border-default p-3 max-h-72 overflow-auto text-sm">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    );
  };

  const renderTextContent = (content: string) => {
    return (
      <div className="bg-input-background rounded p-3 max-h-72 overflow-auto">
        <pre className="whitespace-pre-wrap break-words text-sm font-mono text-text-primary">
          {content}
        </pre>
      </div>
    );
  };

  const renderContent = () => {
    const content = isEditing ? editContent : item.content;

    if (item.type === "image" && content.startsWith("data:image")) {
      return (
        <div className="space-y-3">
          <img
            src={content}
            alt={item.title}
            className="max-w-full max-h-72 object-contain rounded border border-border-default mx-auto"
          />
          {showRawContent && (
            <div className="bg-input-background rounded p-3 text-xs">
              <pre className="text-text-secondary whitespace-pre-wrap break-all">
                {content.substring(0, 150)}...
              </pre>
            </div>
          )}
        </div>
      );
    }

    if (item.type === "html" && !isEditing) {
      return (
        <div className="space-y-3">
          {/* HTML Security Warning */}
          {htmlInfo && !htmlInfo.isContentSafe && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <AlertTriangle
                size={16}
                className="text-yellow-600 dark:text-yellow-400"
              />
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                This HTML content contains potentially unsafe elements. Viewing
                in safe mode.
              </span>
            </div>
          )}

          {/* Render mode controls */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">View mode:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setHtmlRenderMode("safe")}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  htmlRenderMode === "safe"
                    ? "bg-primary text-white"
                    : "bg-button-second-bg text-text-secondary hover:bg-button-second-bg-hover"
                }`}
              >
                <Shield size={12} className="inline mr-1" />
                Safe HTML
              </button>
              <button
                onClick={() => setHtmlRenderMode("text")}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  htmlRenderMode === "text"
                    ? "bg-primary text-white"
                    : "bg-button-second-bg text-text-secondary hover:bg-button-second-bg-hover"
                }`}
              >
                <FileText size={12} className="inline mr-1" />
                Text Only
              </button>
              <button
                onClick={() => setHtmlRenderMode("raw")}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  htmlRenderMode === "raw"
                    ? "bg-primary text-white"
                    : "bg-button-second-bg text-text-secondary hover:bg-button-second-bg-hover"
                }`}
              >
                <Eye size={12} className="inline mr-1" />
                Raw HTML
              </button>
            </div>
          </div>

          {/* Content based on render mode */}
          {htmlRenderMode === "safe" &&
            htmlInfo &&
            renderSafeHTMLContent(htmlInfo.sanitizedContent)}

          {htmlRenderMode === "text" &&
            htmlInfo &&
            renderTextContent(htmlInfo.textContent)}

          {htmlRenderMode === "raw" && renderTextContent(content)}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-56 p-3 border border-border-default rounded bg-input-background text-text-primary font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Content..."
          />
        ) : (
          renderTextContent(content)
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-card-background rounded-lg p-4 overflow-auto flex flex-col">
      {/* Header - More compact */}
      <div className="flex items-start justify-between mb-4 flex-shrink-0">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {getItemIcon()}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-base font-semibold bg-input-background border border-border-default rounded px-2 py-1 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Title..."
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary truncate">
                  {item.title}
                </h2>
                {item.isFavorite && (
                  <Heart
                    size={14}
                    className="text-red-500 fill-current flex-shrink-0"
                  />
                )}
                {/* Security indicator for HTML */}
                {item.type === "html" &&
                  htmlInfo &&
                  !htmlInfo.isContentSafe && (
                    <AlertTriangle
                      size={14}
                      className="text-yellow-500 flex-shrink-0"
                    />
                  )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
              <span>{formatTime(item.timestamp)}</span>
              <span>•</span>
              <span>{formatFileSize(item.size)}</span>
              <span>•</span>
              <span className="capitalize">{item.type}</span>
            </div>
          </div>
        </div>

        {/* Actions - More compact buttons */}
        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-2 py-1 bg-primary text-white text-xs rounded hover:bg-primary/90 transition-colors"
              >
                <Save size={12} />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-2 py-1 bg-button-second-bg text-text-primary text-xs rounded hover:bg-button-second-bg-hover transition-colors"
              >
                <X size={12} />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onCopyToClipboard(item.content)}
                className="flex items-center gap-1 px-2 py-1 bg-primary text-white text-xs rounded hover:bg-primary/90 transition-colors"
                title="Copy to clipboard"
              >
                <Copy size={12} />
                Copy
              </button>

              {onToggleFavorite && (
                <button
                  onClick={handleToggleFavorite}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    item.isFavorite
                      ? "bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400"
                      : "bg-button-second-bg hover:bg-button-second-bg-hover text-text-primary"
                  }`}
                  title={
                    item.isFavorite ? "Remove favorite" : "Set as favorite"
                  }
                >
                  <Heart
                    size={12}
                    className={item.isFavorite ? "fill-current" : ""}
                  />
                </button>
              )}

              {onUpdateItem && (
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1 px-2 py-1 bg-button-second-bg text-text-primary text-xs rounded hover:bg-button-second-bg-hover transition-colors"
                  title="Edit item"
                >
                  <Edit3 size={12} />
                </button>
              )}

              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2 py-1 bg-button-second-bg text-text-primary text-xs rounded hover:bg-button-second-bg-hover transition-colors"
                title="Download as text file"
              >
                <Download size={12} />
              </button>

              {item.type === "url" && (
                <button
                  onClick={handleOpenUrl}
                  className="flex items-center gap-1 px-2 py-1 bg-button-second-bg text-text-primary text-xs rounded hover:bg-button-second-bg-hover transition-colors"
                  title="Open URL in new tab"
                >
                  <ExternalLink size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content - More compact */}
      <div className="flex-1 overflow-auto">{renderContent()}</div>
    </div>
  );
};

export default ClipboardContentViewer;
