"use client";

import { useEffect, useState } from "react";
import { Button } from "@elora/ui";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "elora-theme";

/**
 * O tema é aplicado por um script no `<head>` antes da primeira pintura. Este
 * componente apenas alterna e persiste — por isso ele só renderiza o ícone
 * depois de montar, evitando divergência de hidratação.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* Sem localStorage a preferência não persiste, mas a troca funciona. */
    }
    setIsDark(next);
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"}
      className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      {mounted && isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
