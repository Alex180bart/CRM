import type { Config } from "tailwindcss";
import preset from "@crm/config/tailwind-preset.cjs";

export default {
  presets: [preset as Config],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
