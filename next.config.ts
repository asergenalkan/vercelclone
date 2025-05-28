import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    // Production build sırasında ESLint hatalarını yoksay
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Production build sırasında TypeScript hatalarını yoksay (gerekirse)
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side bundle için bu modülleri external yap
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        dgram: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        process: false,
      };
    }

    // Native modülleri external yap
    if (isServer) {
      config.externals = [...config.externals, 'dockerode', 'ssh2', 'docker-modem', 'cpu-features'];
    }

    return config;
  },
  serverExternalPackages: [
    'dockerode', 
    'ssh2', 
    'docker-modem', 
    'cpu-features',
    'bcrypt',
    '@prisma/client',
    'prisma'
  ],
};

export default nextConfig;
