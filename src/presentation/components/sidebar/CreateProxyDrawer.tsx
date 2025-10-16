import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";
import CustomInput from "../common/CustomInput";
import CustomCombobox from "../common/CustomCombobox";
import { ProxyConfig, ProxyType } from "@/types/proxy";
import { ProxyManager } from "@/shared/lib/proxy-manager";
import { Zap, Shield, Clock, AlertCircle, CheckCircle } from "lucide-react";

interface CreateProxyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProxyCreated: (proxy: ProxyConfig) => void;
  editProxy?: ProxyConfig;
}

const CreateProxyDrawer: React.FC<CreateProxyDrawerProps> = ({
  isOpen,
  onClose,
  onProxyCreated,
  editProxy,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<ProxyType>("http");
  const [address, setAddress] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [duration, setDuration] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useQuickInput, setUseQuickInput] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const proxyTypeOptions = [
    { value: "http", label: "HTTP" },
    { value: "https", label: "HTTPS" },
    { value: "socks5", label: "SOCKS5" },
  ];

  useEffect(() => {
    if (isOpen && editProxy) {
      setName(editProxy.name);
      setType(editProxy.type);
      setAddress(editProxy.address);
      setPort(editProxy.port.toString());
      setUsername(editProxy.username || "");
      setPassword(editProxy.password || "");
      setPurchaseDate(editProxy.purchaseDate || "");
      setDuration(editProxy.duration?.toString() || "");
      setExpiryDate(editProxy.expiryDate || "");
      setUseQuickInput(false);
      setSuccessMessage("");
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, editProxy]);

  useEffect(() => {
    if (purchaseDate && duration) {
      const durationNum = parseInt(duration, 10);
      if (!isNaN(durationNum) && durationNum > 0) {
        const expiry = ProxyManager.calculateExpiryDate(
          purchaseDate,
          durationNum
        );
        setExpiryDate(expiry);
      }
    }
  }, [purchaseDate, duration]);

  const resetForm = () => {
    setName("");
    setType("http");
    setAddress("");
    setPort("");
    setUsername("");
    setPassword("");
    setQuickInput("");
    setPurchaseDate("");
    setDuration("");
    setExpiryDate("");
    setUseQuickInput(false);
    setError("");
    setSuccessMessage("");
  };

  const handleQuickInputToggle = (checked: boolean) => {
    setUseQuickInput(checked);
    setError("");

    if (!checked) {
      setQuickInput("");
    } else {
      if (address && port) {
        const quick =
          username && password
            ? `${address}:${port}:${username}:${password}`
            : `${address}:${port}`;
        setQuickInput(quick);
      }
    }
  };

  const handleQuickInputParse = () => {
    setError("");
    setSuccessMessage("");

    if (!quickInput.trim()) {
      setError("Quick input cannot be empty");
      return;
    }

    const parsed = ProxyManager.parseQuickInput(quickInput.trim());

    if (!parsed) {
      setError("Invalid format. Use: address:port:username:password");
      return;
    }

    setAddress(parsed.address || "");
    setPort(parsed.port?.toString() || "");
    setUsername(parsed.username || "");
    setPassword(parsed.password || "");
    setUseQuickInput(false);
    setSuccessMessage("Parsed successfully! Review the details below.");

    // Clear success message after 3s
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return "Proxy name is required";
    }

    if (!address.trim()) {
      return "Address is required";
    }

    if (!port.trim()) {
      return "Port is required";
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return "Port must be between 1 and 65535";
    }

    if (duration) {
      const durationNum = parseInt(duration, 10);
      if (isNaN(durationNum) || durationNum <= 0) {
        return "Duration must be a positive number";
      }
    }

    if (duration && !purchaseDate) {
      return "Purchase date is required when duration is specified";
    }

    return null;
  };

  const handleSubmit = async () => {
    setError("");
    setSuccessMessage("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    const portNum = parseInt(port, 10);

    const proxyConfig: ProxyConfig = {
      id:
        editProxy?.id ||
        `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      type,
      address: address.trim(),
      port: portNum,
      username: username.trim() || undefined,
      password: password.trim() || undefined,
      purchaseDate: purchaseDate || undefined,
      duration: duration ? parseInt(duration, 10) : undefined,
      expiryDate: expiryDate || undefined,
      isActive: true,
      createdAt: editProxy?.createdAt || Date.now(),
    };

    try {
      await ProxyManager.saveProxy(proxyConfig);
      onProxyCreated(proxyConfig);
      onClose();
      resetForm();
    } catch (err) {
      console.error("[CreateProxyDrawer] Failed to save proxy:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save proxy. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    if (useQuickInput) {
      return quickInput.trim().length > 0;
    }
    return name.trim() && address.trim() && port.trim();
  };

  const drawerContent = (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editProxy ? "Edit Proxy" : "Create New Proxy"}
      subtitle={
        editProxy ? "Update proxy configuration" : "Add a new proxy server"
      }
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
            onClick={handleSubmit}
            disabled={!isFormValid() || isLoading}
            loading={isLoading}
          >
            {editProxy ? "Update" : "Create"}
          </CustomButton>
        </>
      }
    >
      <div className="h-full overflow-y-auto bg-drawer-background">
        <div className="p-4 space-y-4">
          {/* Status Messages */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600 dark:text-green-400">
                {successMessage}
              </p>
            </div>
          )}

          {/* Basic Info Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border-default">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">
                Basic Information
              </h3>
            </div>

            <CustomInput
              label="Proxy Name"
              value={name}
              onChange={(value) => {
                setName(value);
                setError("");
              }}
              required
              placeholder="e.g., US Server 1"
              variant="primary"
              size="sm"
            />

            <CustomCombobox
              label="Proxy Type"
              value={type}
              options={proxyTypeOptions}
              onChange={(value) => {
                setType(value as ProxyType);
                setError("");
              }}
              placeholder="Select proxy type..."
              required
              size="sm"
            />
          </div>

          {/* Quick Input Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border-default">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">
                Connection Details
              </h3>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <input
                type="checkbox"
                id="useQuickInput"
                checked={useQuickInput}
                onChange={(e) => handleQuickInputToggle(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label
                htmlFor="useQuickInput"
                className="text-xs text-text-primary cursor-pointer select-none flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-primary" />
                Use Quick Input Mode
              </label>
            </div>

            {useQuickInput ? (
              <div className="space-y-2">
                <CustomInput
                  label="Quick Input"
                  value={quickInput}
                  onChange={(value) => {
                    setQuickInput(value);
                    setError("");
                  }}
                  placeholder="192.168.1.1:8080:user:pass"
                  variant="primary"
                  size="sm"
                  hint="Format: address:port:username:password (auth optional)"
                />
                <button
                  onClick={handleQuickInputParse}
                  type="button"
                  className="w-full px-3 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={!quickInput.trim()}
                >
                  <Zap className="w-4 h-4" />
                  Parse & Apply
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <CustomInput
                    label="Address"
                    value={address}
                    onChange={(value) => {
                      setAddress(value);
                      setError("");
                    }}
                    required
                    placeholder="192.168.1.1"
                    variant="primary"
                    size="sm"
                  />

                  <CustomInput
                    label="Port"
                    value={port}
                    onChange={(value) => {
                      setPort(value);
                      setError("");
                    }}
                    required
                    type="number"
                    placeholder="8080"
                    variant="primary"
                    size="sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Authentication (Optional)</span>
                  </div>

                  <CustomInput
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    placeholder="username"
                    variant="primary"
                    size="sm"
                  />

                  <CustomInput
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    type="password"
                    placeholder="password"
                    variant="primary"
                    size="sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Expiry Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border-default">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">
                Expiry Settings
              </h3>
              <span className="text-xs text-text-secondary ml-auto">
                (Optional)
              </span>
            </div>

            <div className="space-y-3">
              <CustomInput
                label="Purchase Date"
                value={purchaseDate}
                onChange={setPurchaseDate}
                type="datetime-local"
                variant="primary"
                size="sm"
              />
              <CustomInput
                label="Duration (Days)"
                value={duration}
                onChange={setDuration}
                type="number"
                placeholder="30"
                variant="primary"
                size="sm"
                hint="Number of days the proxy is valid"
              />
            </div>
          </div>

          {/* Expiry Preview */}
          {expiryDate && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                    Expiry Date
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {new Date(expiryDate).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MotionCustomDrawer>
  );
  return isOpen ? createPortal(drawerContent, document.body) : null;
};
export default CreateProxyDrawer;
