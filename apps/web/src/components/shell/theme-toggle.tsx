"use client";

import { useEffect, useState } from "react";
import { Button } from "@elora/ui";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "elora-theme";

/**
 * Atalho de tema da barra lateral.
 *
 * O tema é aplicado por um script no `<head>` antes da primeira pintura. Este
 * componente apenas alterna e persiste — por isso ele só renderiza o ícone
 * depois de montar, evitando divergência de hidratação.
 *
 * ## Os valores gravados são "claro" e "escuro", não "light" e "dark"
 *
 * A chave é a mesma que a aba Aparência lê e escreve, e o vocabulário do
 * `AppearanceMode` do core tem três valores em português — incluindo `sistema`,
 * que este botão não alcança. Duas grafias para o mesmo dado produziriam o
 * defeito mais chato desta classe: a aba mostra "claro" selecionado, o botão
 * mostra a lua, e as duas leituras estão certas sobre chaves diferentes.
 *
 * ## Some quando a organização bloqueia a escolha
 *
 * Sem isso, o clique alternaria a classe na hora e o script devolveria o tema da
 * organização no recarregamento seguinte — um botão que funciona até a pessoa
 * atualizar a página é pior que botão nenhum.
 */
export function ThemeToggle({ allowed = true }: { allowed?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  if (!allowed) return null;

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "escuro" : "claro");
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
      className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground press"
    >
      {mounted && isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
