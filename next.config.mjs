/** @type {import('next').NextConfig} */
const nextConfig = {
  // This hides the bottom-left "N" icon and build spinner
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
};

export default nextConfig;