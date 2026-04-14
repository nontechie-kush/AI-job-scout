/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse', 'mammoth', '@react-pdf/renderer'],
};

module.exports = nextConfig;
