import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { Provider } from "jotai";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import ConsoleFilter from "@/components/misc/console-filter";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

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
      <body
        className={`${manrope.variable} ${jetbrainsMono.variable} antialiased`}
      >
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
