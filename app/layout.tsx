import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Temp Number - Free Temporary Phone Numbers for OTP",
  description: "Get free temporary phone numbers for receiving OTP verification codes instantly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
