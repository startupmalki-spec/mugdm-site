import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mugdm — AI-Powered Software Studio | مقدم",
  description:
    "We build websites, apps, and MVPs for businesses that move fast. AI-powered development, delivered in days. Based in Saudi Arabia, serving worldwide.",
  keywords: [
    "software development",
    "AI development",
    "MVP",
    "web development",
    "mobile apps",
    "Saudi Arabia",
    "vibe coding",
    "software studio",
  ],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Mugdm — AI-Powered Software Studio",
    description:
      "From idea to live product in days. AI-powered development with human expertise.",
    url: "https://mugdm.com",
    siteName: "Mugdm",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mugdm — AI-Powered Software Studio",
    description:
      "From idea to live product in days. AI-powered development with human expertise.",
    creator: "@mmalki27",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {/* Page Loader */}
        <div
          className="fixed inset-0 z-[9999] bg-background flex items-center justify-center"
          style={{
            animation: "loader-slide-up 0.6s cubic-bezier(0.76,0,0.24,1) 1.8s forwards",
          }}
        >
          <img
            src="/brand/logo-shadda.png"
            alt="Loading MUGDM..."
            className="w-20 h-20 object-contain"
            style={{ animation: "loader-pulse 1.2s ease-in-out infinite" }}
          />
        </div>
        {children}
      </body>
    </html>
  );
}
