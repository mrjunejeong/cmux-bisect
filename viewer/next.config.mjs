/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable image optimization for static demo assets
  images: { unoptimized: true },
};

export default nextConfig;
