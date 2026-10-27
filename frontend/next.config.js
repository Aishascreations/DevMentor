/** @type {import('next').NextModeConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/auth/:path*",
        destination: "https://devmentor-backend-x83b.onrender.com/auth/:path*",
      },
      {
        source: "/api/:path*",
        destination: "https://devmentor-backend-x83b.onrender.com/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
