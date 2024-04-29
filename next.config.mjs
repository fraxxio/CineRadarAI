/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TMDB_BASE_URL: process.env.TMDB_BASE_URL,
    TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN,
  },
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
  },
};

export default nextConfig;
