import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("PWA Assets & Manifests", () => {
  it("has a valid manifest.webmanifest with all required PWA attributes", () => {
    const manifestPath = path.resolve(process.cwd(), "public/manifest.webmanifest");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBe("Mess Manager");
    expect(manifest.short_name).toBe("MessManager");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toContain("/");
    expect(manifest.theme_color).toBe("#7c3aed");
    expect(manifest.background_color).toBe("#faf8fd");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

    // Verify icons exist on disk
    for (const icon of manifest.icons) {
      const iconPath = path.resolve(process.cwd(), "public", icon.src.replace(/^\//, ""));
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });

  it("has manifest.json as a compatibility fallback", () => {
    const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBe("Mess Manager");
    expect(manifest.display).toBe("standalone");
  });

  it("contains all multi-size PWA icons and apple-touch-icon", () => {
    const iconFiles = [
      "public/pwa-192x192.png",
      "public/pwa-512x512.png",
      "public/pwa-maskable-192x192.png",
      "public/pwa-maskable-512x512.png",
      "public/apple-touch-icon.png",
    ];

    for (const iconFile of iconFiles) {
      const iconPath = path.resolve(process.cwd(), iconFile);
      expect(fs.existsSync(iconPath)).toBe(true);
      const stat = fs.statSync(iconPath);
      expect(stat.size).toBeGreaterThan(500); // Valid image file
    }
  });

  it("has a production-ready Service Worker file with offline fallback and background sync", () => {
    const swPath = path.resolve(process.cwd(), "public/sw.js");
    expect(fs.existsSync(swPath)).toBe(true);

    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("addEventListener(\"install\"");
    expect(content).toContain("addEventListener(\"activate\"");
    expect(content).toContain("addEventListener(\"fetch\"");
    expect(content).toContain("addEventListener(\"sync\"");
    expect(content).toContain("CACHE_STATIC");
    expect(content).toContain("CACHE_FONTS");
    expect(content).toContain("sync-mess-data");
  });
});
