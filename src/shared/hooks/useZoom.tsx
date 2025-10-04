import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";

interface ZoomContextType {
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  resetZoom: () => void;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

export const useZoom = () => {
  const context = useContext(ZoomContext);
  if (context === undefined) {
    throw new Error("useZoom must be used within a ZoomProvider");
  }
  return context;
};

interface ZoomProviderProps {
  children: ReactNode;
  storageKey?: string;
  defaultValue?: number;
}

export const ZoomProvider = ({
  children,
  storageKey = "orbit-sidebar-zoom",
  defaultValue = 70,
}: ZoomProviderProps) => {
  const [zoomLevel, setZoomLevel] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved
        ? Math.max(25, Math.min(200, parseInt(saved, 10)))
        : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, zoomLevel.toString());
  }, [zoomLevel, storageKey]);

  const updateZoomLevel = (level: number) => {
    const newLevel = Math.max(25, Math.min(200, level));
    setZoomLevel(newLevel);
  };

  const resetZoom = () => {
    setZoomLevel(defaultValue);
  };

  const value = {
    zoomLevel,
    setZoomLevel: updateZoomLevel,
    resetZoom,
  };

  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
};
