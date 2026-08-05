/**
 * Preset Tailwind do CRM CF.
 *
 * A paleta é a identidade Arena CF: azul #102850, branco #FFFFFF e laranja #FF9933.
 * Todas as cores são lidas de variáveis CSS em HSL declaradas em
 * `packages/ui/src/styles/tokens.css`, para permitir tema claro/escuro e
 * white-label por organização sem recompilar.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Sora", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        border: {
          DEFAULT: "hsl(var(--border))",
          strong: "hsl(var(--border-strong))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
          sunken: "hsl(var(--surface-sunken))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        "primary-2": {
          DEFAULT: "hsl(var(--primary-2))",
          foreground: "hsl(var(--primary-2-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          soft: "hsl(var(--accent-soft))",
          ink: "hsl(var(--accent-ink))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          accent: "hsl(var(--sidebar-accent))",
          border: "hsl(var(--sidebar-border))",
        },
        /**
         * Superfície da conversa: plano texturizado e as duas bolhas.
         * `chat.canvas` é o plano; o desenho da textura vive em `.chat-canvas`.
         */
        chat: {
          canvas: "hsl(var(--chat-canvas))",
          in: "hsl(var(--chat-in))",
          "in-foreground": "hsl(var(--chat-in-foreground))",
          out: "hsl(var(--chat-out))",
          "out-foreground": "hsl(var(--chat-out-foreground))",
          "out-ink": "hsl(var(--chat-out-ink))",
          quote: "hsl(var(--chat-quote))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "var(--elev-1)",
        raised: "var(--elev-2)",
        overlay: "var(--elev-3)",
        "accent-glow": "0 0 0 3px hsl(var(--accent) / 0.2)",
        "inset-hairline": "inset 0 -1px 0 0 hsl(var(--border))",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.45" },
          "30%": { transform: "translateY(-3px)", opacity: "1" },
        },
        /** Entrada da bolha: sobe do lado de quem falou e assenta. */
        "message-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        /** Varredura do cartão do copiloto enquanto o modelo responde. */
        "ai-sweep": {
          from: { backgroundPosition: "150% 0" },
          to: { backgroundPosition: "-150% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "fade-up": "fade-up 0.28s ease-out",
        "slide-in-right": "slide-in-right 0.24s ease-out",
        "scale-in": "scale-in 0.16s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        "message-in": "message-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
        "ai-sweep": "ai-sweep 1.6s linear infinite",
      },
    },
  },
};
