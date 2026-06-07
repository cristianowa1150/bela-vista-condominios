import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SIDEBAR_PALETTES, paletteToVars } from "@/components/layout/sidebar-palettes";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Condomínio Bela Vista | Ibiá - MG",
  description: "Sistema de gestão financeira do Condomínio Bela Vista",
};

// Build the palette-vars map at compile time so the inline script is self-contained
const PALETTE_VARS_MAP = Object.fromEntries(
  SIDEBAR_PALETTES.map((p) => [p.id, paletteToVars(p)])
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full" data-theme="light" suppressHydrationWarning>
      <head>
        {/*
          Run before first paint:
          1. Restore saved theme (data-theme attribute)
          2. Restore saved sidebar palette as CSS vars on :root
          This matches what React will render after hydration, preventing flash.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var VALID=["light","dark","sepia","apple"];
var t=localStorage.getItem("theme");
if(t&&VALID.indexOf(t)!==-1)document.documentElement.setAttribute("data-theme",t);
var pmap=${JSON.stringify(PALETTE_VARS_MAP)};
var pid=localStorage.getItem("sidebar-palette");
if(pid&&pmap[pid]){var vars=pmap[pid];var r=document.documentElement;for(var k in vars)r.style.setProperty(k,vars[k]);}
}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.className} h-full`}>{children}</body>
    </html>
  );
}
