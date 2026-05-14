/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "production" ? ".next-servicepro-build" : ".next-servicepro"
};

export default nextConfig;
