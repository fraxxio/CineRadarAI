/** @type {import('next').NextConfig} */
const nextConfig = {
  // E2E servers build into their own folder so they never clash with `next dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        port: "",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
      },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
