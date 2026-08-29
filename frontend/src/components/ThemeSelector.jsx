import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../constants/index.js";
import { PaletteIcon, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const ThemeSelector = () => {
  const { theme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Ensure dropdown stays in viewport on mobile
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;

    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Check if dropdown goes off-screen
    if (rect.right > viewportWidth) {
      dropdownRef.current.style.right = "0";
      dropdownRef.current.style.left = "auto";
    }
    if (rect.bottom > viewportHeight) {
      dropdownRef.current.style.top = "auto";
      dropdownRef.current.style.bottom = "100%";
    }
  }, [isOpen]);

  const handleThemeSelect = (themeName) => {
    setTheme(themeName);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* DROPDOWN TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-circle touch-action-none"
        aria-label="Theme selector"
        aria-expanded={isOpen}
        type="button"
      >
        <PaletteIcon className="size-5" />
      </button>

      {/* DROPDOWN MENU - FIXED POSITIONING FOR MOBILE */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed top-16 right-4 z-50 w-56 p-1 shadow-2xl bg-base-200 backdrop-blur-lg rounded-2xl border border-base-content/10 max-h-80 overflow-y-auto"
          role="listbox"
        >
          <div className="space-y-1">
            {THEMES.map((themeOption) => (
              <button
                key={themeOption.name}
                className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors active:bg-primary/20 ${
                  theme === themeOption.name
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-base-300"
                }`}
                onClick={() => handleThemeSelect(themeOption.name)}
                type="button"
                role="option"
                aria-selected={theme === themeOption.name}
              >
                <PaletteIcon className="size-4 shrink-0" />
                <span className="text-sm font-medium">{themeOption.label}</span>
                {/* THEME PREVIEW COLORS */}
                <div className="ml-auto flex gap-1">
                  {themeOption.colors.map((color, i) => (
                    <span
                      key={i}
                      className="size-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Close button for mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 p-1 hover:bg-base-300 rounded-lg transition text-base-content opacity-60 lg:hidden"
            aria-label="Close theme selector"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
