import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Rybbit tracker host — baked default for our self-hosted instance, overridable
// via NEXT_PUBLIC_RYBBIT_HOST. Proxies the tracker + beacon through this site's
// own origin (ad-blocker resistant). See src/lib/rybbit.ts.
const RYBBIT_HOST =
  process.env.NEXT_PUBLIC_RYBBIT_HOST || "https://analytics.cortex.eco";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: false,
  // Native/wasm deps of the GLB optimizer (/api/museum/model) must load from
  // node_modules at runtime, not be bundled — draco3dgltf reads its .wasm
  // from its own package directory.
  serverExternalPackages: [ "sharp", "draco3dgltf" ],
  // Dev only: allow opening the dev server via the machine's LAN address
  // (e.g. testing Hyperfy spawns where the world must reach this host) —
  // Next.js blocks cross-origin dev-resource requests by default.
  allowedDevOrigins: [ "192.168.68.80", "localhost" ],
  // Pin the workspace root so Turbopack never infers a parent directory
  // (e.g. when this repo is checked out inside a larger workspace).
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  async redirects() {
    return [
      { source: "/galleries", destination: "/collections", permanent: true },
      { source: "/galleries/:slug", destination: "/collections/:slug", permanent: true },
      { source: "/exhibitions", destination: "/rooms", permanent: true },
      { source: "/exhibitions/world", destination: "/rooms/world", permanent: true },
      { source: "/exhibitions/rooms/:id", destination: "/rooms/:id", permanent: true },
    ];
  },
  // Proxy the Rybbit tracker + beacon through this site's own origin so ad
  // blockers don't drop events. There is no /api/track or /api/script.js route,
  // so these afterFiles rewrites don't shadow the app's real /api routes.
  async rewrites() {
    return [
      { source: "/api/script.js", destination: `${RYBBIT_HOST}/api/script.js` },
      { source: "/api/track", destination: `${RYBBIT_HOST}/api/track` },
    ];
  },
  experimental: {
    // Keep in sync with MAX_UPLOAD_BYTES in src/lib/upload-limits.ts.
    // Default is 10MB; oversized multipart bodies are silently truncated
    // by the proxy buffer and break request.formData() in route handlers.
    proxyClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
