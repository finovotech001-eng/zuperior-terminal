import type { Metadata } from "next";
import { Provider } from "jotai";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import ConsoleFilter from "@/components/misc/console-filter";

export const metadata: Metadata = {
  title: "Zuperior - Trading Terminal",
  description: "Professional trading platform for forex, crypto, stocks, and commodities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <Provider>
          <ThemeProvider defaultTheme="dark" storageKey="zuperior-theme">
            <ConsoleFilter />
            {children}
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}
