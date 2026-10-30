import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AetherTwin — Verified Motion Twin',
  description:
    'From real motion to a simulation you can test. Deterministic physics digital twin generator with SAM 3.1 tracking and 70/30 holdout validation.',
  keywords: [
    'Digital Twin',
    'Physics Simulation',
    'Pendulum',
    'Runge-Kutta',
    'SAM 3.1',
    'Meta AI',
    'Muse Spark',
    'Holdout Validation'
  ]
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080c14] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
