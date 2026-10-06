/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // allow resume uploads
    },
    // pdfkit reads its standard font metrics (Helvetica.afm etc.) off disk at runtime via
    // fs.readFileSync. Letting webpack bundle it moves its code into .next/server/chunks
    // without those data files following along, so the font load 404s in production even
    // though it works locally - keeping it external makes Node require it straight from
    // node_modules instead, where the font files are still next to it.
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

module.exports = nextConfig;


