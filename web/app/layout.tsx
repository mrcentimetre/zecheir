import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Urbanist } from "next/font/google";
import "./globals.css";

const urbanist = Urbanist({ variable: "--font-urbanist", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: "ZecHeir · Private inheritance for shielded ZEC",
  description:
    "A 2-of-3 FROST vault with a check-in switch. Your shielded ZEC reaches your family, even if you can't.",
  applicationName: "ZecHeir",
  appleWebApp: { capable: true, title: "ZecHeir", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#131318",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${urbanist.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col">{children}</div>
      </body>
    </html>
  );
}
