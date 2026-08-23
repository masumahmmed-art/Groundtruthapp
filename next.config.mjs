/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "groundtruthestimator.com",
        "www.groundtruthestimator.com",
        "groundtruthapp.vercel.app",
      ],
    },
  },
};

export default nextConfig;
