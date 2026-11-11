import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Jaago | Geo-Intelligent Civic Redressal & Accountability Platform',
  description:
    'Piloted in Greater Bengaluru Authority (Bellandur, HSR Layout, Koramangala). High-precision spatial deduplication, verified field resolution, and civic trust tracking.',
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
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased font-sans flex flex-col min-h-screen">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800">Jaago Platform</span>
                <span>&bull;</span>
                <span>Greater Bengaluru Authority Pilot (Wards 150, 174, 151)</span>
              </div>
              <p>Civic Trust Index (CTI) &bull; Open Redressal Standard</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
