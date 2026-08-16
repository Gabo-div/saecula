/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL || 'http://localhost:8080'

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/auth/:path*', destination: `${backend}/auth/:path*` },
    ]
  },
}

export default nextConfig
