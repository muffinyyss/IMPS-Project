import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Test My tailwind + Next.js",
  description: "Starter for beginner",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="scroll-smooth">
      <body className="min-h-screen bg-zinc-900 antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-3">
            <h1 className="text-xl font-semibold">Next Lorem ipsum dolor </h1>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mt-12 border-t bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-zinc-500">
            cr {new Date().getFullYear()} My App 
          </div>
        </footer>
      </body>
    </html>
  );
}
