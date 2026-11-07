import logoImg from "@/assets/logo.png";
import logoMeta from "@/assets/logo.png.asset.json";

export const APP_LOGO: string =
  (typeof logoImg === "string" && logoImg) || (logoMeta as { url?: string })?.url || "/logo.png";
