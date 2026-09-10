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
  {
    id: "tema1",
    label: "Tema 1 — zlatni ram",
    image: "/tema1.png",
    spread: true,
    coverStyle: { background: "#f5ecd6" },
    swatchStyle: {
      backgroundImage: "url(/tema1.png)",
      backgroundSize: "170%",
      backgroundPosition: "left top",
      backgroundRepeat: "no-repeat",
    },
    onlyForTypes: ["vencanje"],
  },
  {
    id: "tema2",
    label: "Tema 2 — lišće",
    image: "/tema2.png",
    spread: true,
    coverStyle: { background: "#f2f4ef" },
    swatchStyle: {
      backgroundImage: "url(/tema2.png)",
      backgroundSize: "170%",
      backgroundPosition: "left top",
      backgroundRepeat: "no-repeat",
    },
    onlyForTypes: ["vencanje"],
  },
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

// ---------- Fiksna struktura albuma: 30 strana ----------
//
// Strana 1 i strana 30 su korice (B4, izdvojene, po jedna se prikazuje
// samostalno). Strane 2–29 (28 strana = 14 dvostranih razvoda) su A4 i
// prikazuju se uvek po dve odjednom, kao pravi album.

export const TOTAL_PAGES = 30;
export const CONTENT_PAGES = TOTAL_PAGES - 2; // 28
export const PAGE_FORMAT_MM = {
  A4: [210, 297],
  B4: [250, 353],
};

function createPage(format, role) {
  // layout: broj slika (1–4) izabran za ovu stranu, layoutVariant: koja
  // varijanta rasporeda (npr. za 3 slike ima nekoliko) — samo za
  // unutrašnje (role "content") strane; korice ih ne koriste.
  return {
    id: uid("page"),
    format,
    role,
    layout: null,
    layoutVariant: null,
    elements: [],
  };
}

export function createDefaultAlbum(typeId) {
  const type = ALBUM_TYPES.find((t) => t.id === typeId);
  const pages = [createPage("B4", "cover-front")];
  for (let i = 0; i < CONTENT_PAGES; i++) {
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

// Editor ne prikazuje 30 pojedinačnih strana, već "poglede" (views):
// prednja korica, 14 razvoda od po dve strane, zadnja korica.
export function buildAlbumViews(pages) {
  const views = [{ type: "cover", pageIndices: [0] }];
  for (let i = 1; i < TOTAL_PAGES - 1; i += 2) {
    views.push({ type: "spread", pageIndices: [i, i + 1] });
  }
  views.push({ type: "cover", pageIndices: [TOTAL_PAGES - 1] });
  return views;
}

export function describeView(view) {
  if (view.type === "cover") {
    return view.pageIndices[0] === 0 ? "Prednja korica" : "Zadnja korica";
  }
  const [a, b] = view.pageIndices;
  return `Strane ${a + 1}–${b + 1} od ${TOTAL_PAGES}`;
}
