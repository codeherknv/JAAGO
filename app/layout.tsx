import type { Metadata } from 'next';
import { Archivo, Noto_Sans, Noto_Sans_Kannada } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Navbar from '@/components/Navbar';

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

const notoSansKannada = Noto_Sans_Kannada({
  subsets: ['kannada'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-kannada',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Jaago | Greater Bengaluru Civic Redressal',
  description:
    'Geo-intelligent civic complaint tracker and accountability platform piloted for Bellandur, HSR Layout, and Koramangala.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${notoSans.variable} ${notoSansKannada.variable}`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="bg-kerb text-asphalt antialiased font-sans flex flex-col min-h-screen selection:bg-marking-yellow selection:text-asphalt">
        <Providers>
          <Navbar />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <footer className="hidden md:block bg-white border-t border-border py-4 text-xs text-asphalt-muted font-heading">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-between items-center">
              <span>Jaago &bull; Greater Bengaluru Authority Pilot (Wards 150, 174, 151)</span>
              <span>Open civic accountability &amp; audit standard</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
