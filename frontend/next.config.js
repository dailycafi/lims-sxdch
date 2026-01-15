/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 优化包导入 - 自动转换 barrel file 导入为直接导入
  // 参考: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
  experimental: {
    optimizePackageImports: [
      '@heroicons/react',
      '@headlessui/react',
      'date-fns',
      'framer-motion',
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8002/api/:path*',
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
