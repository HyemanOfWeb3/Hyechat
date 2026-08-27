import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("hyechat-theme") || "forest",
  setTheme: (theme) => {
    localStorage.setItem("hyechat-theme", theme);
    set({ theme });
  },
}));
