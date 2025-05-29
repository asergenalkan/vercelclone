import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Build sırasında ESLint kontrollerini devre dışı bırak
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server-side'da native modülleri external olarak işaretle
      config.externals = [...(config.externals || []), {
        'ssh2': 'commonjs ssh2',
        'dockerode': 'commonjs dockerode',
        'docker-modem': 'commonjs docker-modem',
        'cpu-features': 'commonjs cpu-features',
        'ssh2/lib/protocol/crypto/build/Release/sshcrypto.node': 'commonjs ssh2/lib/protocol/crypto/build/Release/sshcrypto.node'
      }];
    }
    return config;
  },
  serverExternalPackages: ['dockerode', 'ssh2', 'docker-modem'],
  transpilePackages: [
    '@uiw/react-codemirror',
    '@codemirror/language',
    '@codemirror/legacy-modes',
    '@uiw/codemirror-theme-tokyo-night'
  ]
};

export default nextConfig;
