import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { ConsolePanel } from "@/components/common/console-panel";
import { ViewportInsets } from "@/components/viewport-insets";
import { ZoomWrapper } from "@/components/zoom-wrapper";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "sonner";
import "flexlayout-react/style/light.css";
import "tippy.js/dist/tippy.css";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Agent Spaces",
  description: "Multi-agent collaborative coding workspace",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang=""
      className="h-[var(--app-content-height)] overflow-hidden antialiased"
      suppressHydrationWarning
    >
      <body className="h-[var(--app-content-height)] overflow-hidden font-sans">
        <ZoomWrapper>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LocaleProvider>
            <ViewportInsets />
            <AuthGuard>
              <AppShell>{children}</AppShell>
              <CommandPalette />
              <Toaster richColors position="bottom-right" />
            </AuthGuard>
            <ConsolePanel />
          </LocaleProvider>
        </ThemeProvider>
        </ZoomWrapper>
      </body>
    </html>
  );
}
