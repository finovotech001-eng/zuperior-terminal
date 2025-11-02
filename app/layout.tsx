import type { Metadata } from "next";
import { Provider } from "jotai";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import ConsoleFilter from "@/components/misc/console-filter";
import ChunkErrorHandler from "@/components/misc/chunk-error-handler";

export const metadata: Metadata = {
  title: "Zuperior - Trading Terminal",
  description: "Professional trading platform for forex, crypto, stocks, and commodities",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Provider>
          <ThemeProvider defaultTheme="dark" storageKey="zuperior-theme">
            <ConsoleFilter />
            <ChunkErrorHandler />
            {children}
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}
