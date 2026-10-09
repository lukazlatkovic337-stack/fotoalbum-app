import { uid } from "./id";

// Verzija strukture albuma — ako se u localStorage nađe album stare
// strukture (npr. iz vremena kad je broj strana bio promenljiv), on se
// odbacuje i pravi se nov, po trenutnim pravilima.
export const SCHEMA_VERSION = 2;

// Tri vrste foto albuma koje sajt nudi na početnoj strani.
// `photo` je slika iz /public koja se koristi kao (zamućena) pozadina
// kartice na početnoj strani.
export const ALBUM_TYPES = [
  {
    id: "vencanje",
    label: "Foto album za venčanje",
    short: "Venčanje",
    icon: "💍",
    description:
      "Ovekovečite najlepši dan vašeg života u elegantnom foto albumu.",
    defaultTitle: "Naše venčanje",
    photo: "/svadba.jpg",
  },
  {
    id: "krstenje",
    label: "Foto album za krštenje",
    short: "Krštenje",
    icon: "🕊️",
    description:
      "Sačuvajte uspomene sa krštenja vašeg deteta u posebnom albumu.",
    defaultTitle: "Krštenje",
    photo: "/krstenje.jpg",
  },
  {
    id: "rodjendan",
    label: "Foto album za prvi rođendan",
    short: "Prvi rođendan",
    icon: "🎂",
    description:
      "Napravite čarobnu uspomenu na prvi rođendan vaše bebe.",
    defaultTitle: "Prvi rođendan",
    photo: "/rodjendan.jpg",
  },
];

// Dostupne teme (pozadine) za album.
//  - Obične teme (style) važe za sve strane albuma odjednom.
//  - Slikovne teme (image) su A3 landscape slike koje pokrivaju ceo razvod
//    (dve A4 strane zajedno) — primenjuju se samo na strane 2–29; korice
//    tada dobijaju jednobojnu podlogu (coverStyle).
//  - `onlyForTypes` ograničava temu na navedene tipove albuma;
//    `excludeForTypes` je sakriva za navedene tipove.
export const BACKGROUNDS = [
  {
    id: "krem",
    label: "Krem",
    style: { background: "linear-gradient(135deg, #f8f1e4 0%, #eee0c8 100%)" },
    excludeForTypes: ["vencanje"],
  },
  {
    id: "bela",
    label: "Bela",
    style: { background: "#ffffff", boxShadow: "inset 0 0 0 1px #e7e1d8" },
    excludeForTypes: ["vencanje"],
  },
  {
    id: "pastel",
    label: "Pastel",
    style: { background: "linear-gradient(135deg, #f6e9f0 0%, #e9eef8 100%)" },
    excludeForTypes: ["vencanje"],
  },
  ...[
    { file: "wedding01.png", label: "Tema 1 — belo cveće", cover: "#f2ece1" },
    { file: "wedding02.png", label: "Tema 2 — pastelni akvarel", cover: "#f3e6da" },
    { file: "wedding03.png", label: "Tema 3 — bele ruže", cover: "#f5f0e3" },
    { file: "wedding04.png", label: "Tema 4 — zeleno lišće", cover: "#eff0e6" },
    { file: "wedding05.png", label: "Tema 5 — roze ruže", cover: "#ffffff" },
    { file: "wedding06.png", label: "Tema 6 — ruže na drvetu", cover: "#f7f5f2" },
    { file: "wedding07.png", label: "Tema 7 — burme i cvet", cover: "#f5efe2" },
  ].map((t, i) => ({
    id: `wedding${i + 1}`,
    label: t.label,
    image: `/${t.file}`,
    spread: true,
    coverStyle: { background: t.cover },
    swatchStyle: {
      backgroundImage: `url(/${t.file})`,
      backgroundSize: "170%",
      backgroundPosition: "left top",
      backgroundRepeat: "no-repeat",
    },
    onlyForTypes: ["vencanje"],
  })),
];

// Teme dostupne za dati tip albuma (npr. slikovne teme samo za venčanje,
// a jednobojne teme sakrivene za venčanje).
export function backgroundsForType(typeId) {
  return BACKGROUNDS.filter(
    (b) =>
      (!b.onlyForTypes || b.onlyForTypes.includes(typeId)) &&
      !(b.excludeForTypes && b.excludeForTypes.includes(typeId))
  );
}

// Tačno 3 dostupna fonta za tekst — namerno ograničeno. Font-porodice se
// oslanjaju na CSS promenljive definisane preko next/font u app/layout.js.
export const FONTS = [
  { id: "elegant", label: "Elegantan", family: "var(--font-elegant), Georgia, serif" },
  { id: "modern", label: "Moderan", family: "var(--font-modern), Arial, sans-serif" },
  { id: "script", label: "Rukopisni", family: "var(--font-script), cursive" },
];

// ---------- Struktura albuma: korice + strane, uvek po dve odjednom ----------
//
// Album uvek počinje sa 30 strana (15 listova): strana 1 je prednja korica,
// strana 30 zadnja korica (obe B4), strane 2–29 (28 strana = 14 razvoda) su
// A4. Korice se uređuju kao JEDAN razvod na početku — zadnja korica levo,
// prednja desno — isto kao i sve ostale strane (po dve odjednom), umesto da
// budu odvojene (prednja na početku, zadnja na kraju). Na kraju albuma se
// mogu dodati još razvoda (po 2 nove A4 strane) preko dugmeta u editoru, pa
// broj strana nije zauvek fiksiran na 30 — zato se svuda koristi
// `pages.length`, a ne fiksna konstanta.

export const INITIAL_TOTAL_PAGES = 30;
export const INITIAL_CONTENT_PAGES = INITIAL_TOTAL_PAGES - 2; // 28
export const PAGE_FORMAT_MM = {
  A4: [210, 297],
  B4: [250, 353],
};

function createPage(format, role, removable = false) {
  // layout: broj slika (1–4) izabran za ovu stranu, layoutVariant: koja
  // varijanta rasporeda (npr. za 3 slike ima nekoliko) — samo za
  // unutrašnje (role "content") strane; korice ih ne koriste.
  // removable: da li korisnik može da obriše ovu stranu — tačno za
  // strane koje su naknadno dodate preko "Dodaj još strana"; početnih
  // 30 (fiksnih) strana se ne mogu brisati.
  return {
    id: uid("page"),
    format,
    role,
    removable,
    layout: null,
    layoutVariant: null,
    elements: [],
  };
}

export function createDefaultAlbum(typeId) {
  const type = ALBUM_TYPES.find((t) => t.id === typeId);
  const pages = [createPage("B4", "cover-front")];
  for (let i = 0; i < INITIAL_CONTENT_PAGES; i++) {
    pages.push(createPage("A4", "content"));
  }
  pages.push(createPage("B4", "cover-back"));

  const available = backgroundsForType(typeId);
  return {
    schemaVersion: SCHEMA_VERSION,
    type: typeId,
    title: type ? type.defaultTitle : "Moj foto album",
    background: available[0]?.id || BACKGROUNDS[0].id,
    createdAt: Date.now(),
    pages,
  };
}

// Dodaje jedan novi razvod (2 nove A4 strane) na kraj albuma, odmah pre
// zadnje korice — za dugme "Dodaj još strana" u editoru. Ove strane su
// označene kao `removable`, za razliku od početnih 30 fiksnih strana.
export function addContentSpread(pages) {
  const backCover = pages[pages.length - 1];
  const extra = [
    createPage("A4", "content", true),
    createPage("A4", "content", true),
  ];
  return [...pages.slice(0, -1), ...extra, backCover];
}

// Uklanja strane sa datim id-jevima — koristi se samo za strane koje je
// korisnik sam dodao (removable: true); poziva se tek pošto se to proveri.
export function removePages(pages, idsToRemove) {
  const idSet = new Set(idsToRemove);
  return pages.filter((p) => !idSet.has(p.id));
}

// Editor ne prikazuje pojedinačne strane, već "poglede" (views) — uvek po
// dve strane odjednom: prvi pogled su korice (zadnja levo, prednja desno),
// a zatim svi ostali razvodi redom.
export function buildAlbumViews(pages) {
  const total = pages.length;
  const views = [{ type: "spread", cover: true, pageIndices: [total - 1, 0] }];
  for (let i = 1; i < total - 1; i += 2) {
    views.push({ type: "spread", cover: false, pageIndices: [i, i + 1] });
  }
  return views;
}

export function describeView(view, totalPages) {
  if (view.cover) return "Korice — zadnja i prednja";
  const [a, b] = view.pageIndices;
  return `Strane ${a + 1}–${b + 1} od ${totalPages}`;
}
