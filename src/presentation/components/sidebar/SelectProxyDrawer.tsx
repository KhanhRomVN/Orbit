import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";
import CustomCombobox from "../common/CustomCombobox";
import CreateProxyDrawer from "./CreateProxyDrawer";
import { ProxyConfig, ProxyType } from "@/types/proxy";
import { ProxyManager } from "../../../shared/lib/proxy-manager";
import { Plus, Trash2, Edit, Check, Globe, Clock, Shield } from "lucide-react";

interface SelectProxyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProxySelected: (proxyId: string) => void;
  currentProxyId?: string;
  targetType: "group" | "tab";
}

const SelectProxyDrawer: React.FC<SelectProxyDrawerProps> = ({
  isOpen,
  onClose,
  onProxySelected,
  currentProxyId,
  targetType,
}) => {
  const [selectedType, setSelectedType] = useState<ProxyType | "">("");
  const [selectedProxyId, setSelectedProxyId] = useState("");
  const [proxies, setProxies] = useState<ProxyConfig[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyConfig | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const proxyTypeOptions = [
    { value: "http", label: "HTTP" },
    { value: "https", label: "HTTPS" },
    { value: "socks5", label: "SOCKS5" },
  ];

  useEffect(() => {
    if (isOpen) {
      loadProxies();
      if (currentProxyId) {
        setSelectedProxyId(currentProxyId);
        // Auto-select type based on current proxy
        const currentProxy = proxies.find((p) => p.id === currentProxyId);
        if (currentProxy) {
          setSelectedType(currentProxy.type);
        }
      }
    }
  }, [isOpen, currentProxyId]);

  const loadProxies = async () => {
    const allProxies = await ProxyManager.getProxies();
    setProxies(allProxies);
  };

  const filteredProxies = selectedType
    ? proxies.filter((p) => p.type === selectedType)
    : [];

  const handleApply = async () => {
    if (!selectedProxyId) {
      alert("Please select a proxy");
      return;
    }

    setIsLoading(true);
    try {
      onProxySelected(selectedProxyId);
      onClose();
    } catch (error) {
      console.error("Failed to apply proxy:", error);
      alert("Failed to apply proxy");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProxy = () => {
    setEditingProxy(undefined);
    setShowCreateModal(true);
  };

  const handleEditProxy = (proxyId: string) => {
    const proxy = proxies.find((p) => p.id === proxyId);
    if (proxy) {
      setEditingProxy(proxy);
      setShowCreateModal(true);
    }
  };

  const handleDeleteProxy = async (proxyId: string) => {
    if (!confirm("Are you sure you want to delete this proxy?")) return;

    try {
      await ProxyManager.deleteProxy(proxyId);
      await loadProxies();

      if (selectedProxyId === proxyId) {
        setSelectedProxyId("");
      }
    } catch (error) {
      console.error("Failed to delete proxy:", error);
      alert("Failed to delete proxy");
    }
  };

  const handleProxyCreated = async (proxy: ProxyConfig) => {
    await loadProxies();
    setSelectedType(proxy.type);
    setSelectedProxyId(proxy.id);
    setShowCreateModal(false);
  };

  const handleRemoveProxy = async () => {
    setIsLoading(true);
    try {
      onProxySelected("");
      onClose();
    } catch (error) {
      console.error("Failed to remove proxy:", error);
      alert("Failed to remove proxy");
    } finally {
      setIsLoading(false);
    }
  };

  const getProxyTypeBadgeColor = (type: ProxyType) => {
    switch (type) {
      case "http":
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700";
      case "https":
        return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700";
      case "socks5":
        return "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700";
      default:
        return "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    }
  };

  const isProxyExpired = (proxy: ProxyConfig) => {
    if (!proxy.expiryDate) return false;
    return new Date(proxy.expiryDate) < new Date();
  };

  const getDaysUntilExpiry = (proxy: ProxyConfig) => {
    if (!proxy.expiryDate) return null;
    const now = new Date();
    const expiry = new Date(proxy.expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const drawerContent = (
    <>
      <MotionCustomDrawer
        isOpen={isOpen && !showCreateModal}
        onClose={onClose}
        title="Select Proxy"
        subtitle={`For ${targetType === "group" ? "Group" : "Tab"}`}
        direction="right"
        size="full"
        animationType="slide"
        enableBlur={false}
        closeOnOverlayClick={true}
        showCloseButton={true}
        footerActions={
          <>
            <CustomButton variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={!selectedProxyId || isLoading}
              loading={isLoading}
            >
              Apply
            </CustomButton>
          </>
        }
      >
        <div className="h-full overflow-y-auto bg-drawer-background">
          <div className="p-4 space-y-4">
            {/* Proxy Type Selection */}
            <div className="space-y-2">
              <CustomCombobox
                label="Proxy Type"
                value={selectedType}
                options={proxyTypeOptions}
                onChange={(value) => {
                  setSelectedType(value as ProxyType);
                  setSelectedProxyId("");
                }}
                placeholder="Select proxy type..."
                required
                size="sm"
              />
            </div>

            {/* Create New Button - Always visible */}
            {selectedType && (
              <button
                onClick={handleCreateProxy}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-card-background border-2 border-dashed border-border-default hover:border-primary rounded-lg transition-all duration-200 group"
              >
                <Plus className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                <span className="text-sm text-text-secondary group-hover:text-primary font-medium transition-colors">
                  Create New {selectedType.toUpperCase()} Proxy
                </span>
              </button>
            )}

            {/* Proxy List */}
            {selectedType && (
              <div className="space-y-2">
                {filteredProxies.length === 0 ? (
                  <div className="p-6 text-center bg-card-background rounded-lg border border-border-default">
                    <Globe className="w-8 h-8 text-text-secondary mx-auto mb-2" />
                    <p className="text-sm text-text-secondary mb-1">
                      No {selectedType.toUpperCase()} proxies available
                    </p>
                    <p className="text-xs text-text-secondary/70">
                      Create one to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide px-1">
                      Available Proxies
                    </h3>
                    {filteredProxies.map((proxy) => {
                      const isSelected = selectedProxyId === proxy.id;
                      const expired = isProxyExpired(proxy);
                      const daysLeft = getDaysUntilExpiry(proxy);

                      return (
                        <div
                          key={proxy.id}
                          onClick={() =>
                            !expired && setSelectedProxyId(proxy.id)
                          }
                          className={`
                            relative p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer
                            ${
                              isSelected
                                ? "border-primary bg-blue-50 dark:bg-blue-900/20"
                                : expired
                                ? "border-border-default bg-red-50/50 dark:bg-red-900/10 opacity-60 cursor-not-allowed"
                                : "border-border-default bg-card-background hover:border-primary/50"
                            }
                          `}
                        >
                          {/* Selected Indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          )}

                          {/* Proxy Info */}
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-text-primary truncate">
                                  {proxy.name}
                                </h4>
                                <p className="text-xs text-text-secondary mt-0.5">
                                  {proxy.address}:{proxy.port}
                                </p>
                              </div>
                            </div>

                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getProxyTypeBadgeColor(
                                  proxy.type
                                )}`}
                              >
                                {proxy.type.toUpperCase()}
                              </span>

                              {proxy.username && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 font-medium">
                                  🔐 Auth
                                </span>
                              )}

                              {expired && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700 font-medium">
                                  Expired
                                </span>
                              )}

                              {!expired &&
                                daysLeft !== null &&
                                daysLeft <= 7 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700 font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {daysLeft}d left
                                  </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 pt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditProxy(proxy.id);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-text-primary hover:bg-sidebar-itemHover rounded transition-colors"
                              >
                                <Edit className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProxy(proxy.id);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Remove Proxy Button */}
            {currentProxyId && (
              <div className="pt-4 border-t border-border-default">
                <button
                  onClick={handleRemoveProxy}
                  className="w-full px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium"
                >
                  Remove Current Proxy
                </button>
              </div>
            )}
          </div>
        </div>
      </MotionCustomDrawer>

      <CreateProxyDrawer
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingProxy(undefined);
        }}
        onProxyCreated={handleProxyCreated}
        editProxy={editingProxy}
      />
    </>
  );

  return isOpen ? createPortal(drawerContent, document.body) : null;
};

export default SelectProxyDrawer;
