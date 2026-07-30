/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // allow resume uploads
    },
  },
};

module.exports = nextConfig;
