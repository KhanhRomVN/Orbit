/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module 'vite-plugin-static-copy';

// Environment variables
interface ImportMetaEnv {
    readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Chrome Extension APIs - Remove duplicate declarations
declare global {
    interface Window {
        chrome: typeof chrome;
    }
}

export { };