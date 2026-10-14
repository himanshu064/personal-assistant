import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { SITE_DESCRIPTION, SITE_NAME, SITE_SHORT_NAME, THEME_COLOR } from "@/lib/constants/site";
import "./globals.css";

// Inter at regular weights, as in the reference shots (ui-references/).
// globals.css maps it to Tailwind's font-sans and font-heading.
const body = Inter({ variable: "--font-body", subsets: ["latin"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Lets iOS open the home screen app full screen, which iOS push requires.
  appleWebApp: { capable: true, title: SITE_SHORT_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "light",
  // Lets content use the full screen on notched phones; the tab bar adds
  // safe-area padding itself.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${body.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </body>
    </html>
  );
}
