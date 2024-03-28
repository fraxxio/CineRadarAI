/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TMDB_BASE_URL: process.env.TMDB_BASE_URL,
    TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN,
  },
};

export default nextConfig;
