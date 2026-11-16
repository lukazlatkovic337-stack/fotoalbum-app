import { Playfair_Display, Poppins, Dancing_Script, Permanent_Marker } from "next/font/google";
import "./globals.css";

// Ovo su jedina tri fonta koja aplikacija nudi za tekst u albumu
// (videti lib/albumConfig.js -> FONTS). Namerno ograničeno na 3.
const fontElegant = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-elegant",
  display: "swap",
});
const fontModern = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-modern",
  display: "swap",
});
const fontScript = Dancing_Script({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
  variable: "--font-script",
  display: "swap",
});
// Van ponude od 3 fonta — koristi se samo kao vizuelna zamena za
// konkretan tekstualni element na gotovoj korici (ne nudi se u panelu).
const fontMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-marker",
  display: "swap",
});

export const metadata = {
  title: "MakeBook – kreirajte svoj foto album",
  description:
    "Napravite personalizovan foto album za venčanje, 18. rođendan ili prvi rođendan i izvezite ga u PDF, spreman za štampu.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="sr"
      className={`${fontElegant.variable} ${fontModern.variable} ${fontScript.variable} ${fontMarker.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
