import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Snatch - Multi-Agent Swarm',
  description: 'Find and negotiate items using AI agents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
