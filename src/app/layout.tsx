import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'India Funding Finder Agent',
  description: 'Crawl the web for Indian brands seeking or raising funding',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
