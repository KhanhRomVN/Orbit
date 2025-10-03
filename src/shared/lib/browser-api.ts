export const getBrowserAPI = (): typeof chrome => {
  if (typeof browser !== "undefined") {
    return browser as typeof chrome;
  }
  if (typeof chrome !== "undefined") {
    return chrome;
  }
  throw new Error("No browser API available");
};

export const isFirefox = (): boolean => {
  return (
    typeof browser !== "undefined" && typeof browser.runtime !== "undefined"
  );
};

export const hasContextualIdentities = (): boolean => {
  const api = getBrowserAPI();
  return !!api.contextualIdentities;
};
