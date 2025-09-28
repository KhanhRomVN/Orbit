import React from "react";

interface TabCardProps {
  title: string;
  url: string;
  onClick?: () => void;
}

const TabCard: React.FC<TabCardProps> = ({ title, url, onClick }) => {
  // Compute favicon URL based on the tab's origin
  const getFaviconUrl = (url: string): string | null => {
    try {
      const { origin } = new URL(url);
      return `${origin}/favicon.ico`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(url);

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
    >
      {faviconUrl && (
        <img
          src={faviconUrl}
          alt="favicon"
          className="w-4 h-4 rounded-sm"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
        {title}
      </span>
    </div>
  );
};

export default TabCard;
