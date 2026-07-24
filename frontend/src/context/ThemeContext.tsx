import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type Density = "comfortable" | "compact";

const THEME_KEY = "kosh-theme";
const DENSITY_KEY = "kosh-density";

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readDensity(): Density {
  if (typeof window === "undefined") return "comfortable";
  return window.localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
}

interface ThemeValue {
  theme: Theme;
  density: Density;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  toggleDensity: () => void;
}

const ThemeContext = createContext<ThemeValue>({
  theme: "light",
  density: "comfortable",
  toggle: () => {},
  setTheme: () => {},
  toggleDensity: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [density, setDensity] = useState<Density>(readDensity);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("density-compact", density === "compact");
    window.localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  // Follow the OS preference until the user makes an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      if (!window.localStorage.getItem(THEME_KEY)) setThemeState(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);
  const toggleDensity = useCallback(
    () => setDensity((d) => (d === "compact" ? "comfortable" : "compact")),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, density, toggle, setTheme, toggleDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
