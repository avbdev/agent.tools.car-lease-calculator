import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car Lease Calculator",
  description: "Calculate and compare car lease payments, total cost of ownership, and lease vs buy scenarios with precision.",
  keywords: ["car lease calculator", "lease payment", "money factor", "residual value", "cap cost"],
  openGraph: {
    title: "Car Lease Calculator",
    description: "Precision car lease calculator with amortization, scenario comparison, and lease vs buy analysis.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
