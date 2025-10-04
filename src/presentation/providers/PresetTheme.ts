import { ReactNode } from "react";

export interface PresetThemeType {
  name: string;
  primary: string;
  background: string;
  textPrimary?: string;
  textSecondary?: string;
  border?: string;
  borderHover?: string;
  borderFocus?: string;
  cardBackground: string;
  inputBackground?: string;
  dialogBackground?: string;
  dropdownBackground?: string;
  dropdownItemHover?: string;
  sidebarBackground?: string;
  sidebarItemHover?: string;
  sidebarItemFocus?: string;
  buttonBg?: string;
  buttonBgHover?: string;
  buttonText?: string;
  buttonBorder?: string;
  buttonBorderHover?: string;
  buttonSecondBg?: string;
  buttonSecondBgHover?: string;
  bookmarkItemBg?: string;
  bookmarkItemText?: string;
  drawerBackground?: string;
  clockGradientFrom?: string;
  clockGradientTo?: string;
  cardShadow?: string;
  dialogShadow?: string;
  dropdownShadow?: string;
  icon?: ReactNode;
  description?: string;
}

export const PRESET_THEMES: Record<"light" | "dark", PresetThemeType[]> = {
  light: [
    {
      name: "Default Light",
      primary: "#3686ff",
      background: "#ffffff",
      textPrimary: "#0f172a",
      textSecondary: "#475569",
      border: "#e2e8f0",
      borderHover: "#cbd5e1",
      borderFocus: "#cbd5e1",
      cardBackground: "#ffffff",
      inputBackground: "#ffffff",
      dialogBackground: "#ffffff",
      dropdownBackground: "#ffffff",
      dropdownItemHover: "#f8fafc",
      sidebarBackground: "#f9fafb",
      sidebarItemHover: "#f3f4f6",
      sidebarItemFocus: "#e5e7eb",
      buttonBg: "#3686ff",
      buttonBgHover: "#1d4ed8",
      buttonText: "#ffffff",
      buttonBorder: "#2563eb",
      buttonBorderHover: "#1e40af",
      buttonSecondBg: "#d4d4d4",
      buttonSecondBgHover: "#b6b6b6",
      bookmarkItemBg: "#f1f5f9",
      bookmarkItemText: "#0f172a",
      drawerBackground: "#ffffff",
      clockGradientFrom: "#3686ff",
      clockGradientTo: "#1d4ed8",
    },
    {
      name: "Indigo Light",
      primary: "#4f46e5",
      background: "#eef2ff",
      textPrimary: "#3730a3",
      textSecondary: "#4338ca",
      border: "#c7d2fe",
      borderHover: "#a5b4fc",
      borderFocus: "#a5b4fc",
      cardBackground: "#ffffff",
      inputBackground: "#ffffff",
      dialogBackground: "#ffffff",
      dropdownBackground: "#ffffff",
      dropdownItemHover: "#e0e7ff",
      sidebarBackground: "#e0e7ff",
      sidebarItemHover: "#c7d2fe",
      sidebarItemFocus: "#a5b4fc",
      buttonBg: "#4f46e5",
      buttonBgHover: "#4338ca",
      buttonText: "#ffffff",
      buttonBorder: "#4338ca",
      buttonBorderHover: "#3730a3",
      buttonSecondBg: "#e0e7ff",
      buttonSecondBgHover: "#c7d2fe",
      bookmarkItemBg: "#e0e7ff",
      bookmarkItemText: "#3730a3",
      drawerBackground: "#ffffff",
      clockGradientFrom: "#4f46e5",
      clockGradientTo: "#4338ca",
    },
  ],
  dark: [
    {
      name: "Default Dark",
      primary: "#3686ff",
      background: "#0a0a0a",
      textPrimary: "#ececec",
      textSecondary: "#a8a8a8",
      border: "#353535",
      borderHover: "#418dfe",
      borderFocus: "#418dfe",
      cardBackground: "#242424",
      inputBackground: "#1e1e1e",
      dialogBackground: "#1e1e1e",
      dropdownBackground: "#1e1e1e",
      dropdownItemHover: "#2d2d2d",
      sidebarBackground: "#131313",
      sidebarItemHover: "#1e1e1e",
      sidebarItemFocus: "#333333",
      buttonBg: "#3686ff",
      buttonBgHover: "#418dfe",
      buttonText: "#ffffff",
      buttonBorder: "#418dfe",
      buttonBorderHover: "#5aa3ff",
      buttonSecondBg: "#1e1e1e",
      buttonSecondBgHover: "#343434",
      bookmarkItemBg: "#1e293b",
      bookmarkItemText: "#e2e8f0",
      drawerBackground: "#1e1e1e",
      clockGradientFrom: "#3686ff",
      clockGradientTo: "#418dfe",
    },
    {
      name: "Midnight Dark",
      primary: "#6366f1",
      background: "#020617",
      textPrimary: "#e2e8f0",
      textSecondary: "#94a3b8",
      border: "#1e293b",
      borderHover: "#6366f1",
      borderFocus: "#6366f1",
      cardBackground: "#0f172a",
      inputBackground: "#1e293b",
      dialogBackground: "#0f172a",
      dropdownBackground: "#1e293b",
      dropdownItemHover: "#334155",
      sidebarBackground: "#0b0e2a",
      sidebarItemHover: "#0f172a",
      sidebarItemFocus: "#1e293b",
      buttonBg: "#6366f1",
      buttonBgHover: "#4f46e5",
      buttonText: "#ffffff",
      buttonBorder: "#4f46e5",
      buttonBorderHover: "#4338ca",
      buttonSecondBg: "#1e293b",
      buttonSecondBgHover: "#334155",
      bookmarkItemBg: "#1e293b",
      bookmarkItemText: "#e2e8f0",
      drawerBackground: "#0f172a",
      clockGradientFrom: "#6366f1",
      clockGradientTo: "#4f46e5",
    },
  ],
};
