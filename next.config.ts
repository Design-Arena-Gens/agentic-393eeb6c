import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['*']
    }
  },
  httpAgentOptions: {
    keepAlive: true
  }
};

export default nextConfig;
