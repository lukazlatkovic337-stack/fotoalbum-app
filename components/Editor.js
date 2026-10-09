"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ALBUM_TYPES,
  BACKGROUNDS,
  FONTS,
  PAGE_FORMAT_MM,
  addContentSpread,
  backgroundsForType,
  buildAlbumViews,
  createDefaultAlbum,
  describeView,
  removePages,
} from "@/lib/albumConfig";
import { uid } from "@/lib/id";
import styles from "./Editor.module.css";

const MAX_FONTS = FONTS.length; // == 3, videti lib/albumConfig.js

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// Koliko blizu (u % strane) centar elementa mora biti centru strane da bi
// se "zalepio" za vodilju centra.
const CENTER_SNAP = 1.5;

// Garantuje da element (tekst ili slika) nikad ne izađe van granica
// strane — bez obzira da li je promena došla iz pomeranja, promene
// veličine ili nekog drugog izvora.
function clampElementBox(el) {
  const w = clamp(el.w, 6, 100);
  const h = clamp(el.h, 6, 100);
  const x = clamp(el.x, 0, 100 - w);
  const y = clamp(el.y, 0, 100 - h);
  return { ...el, w, h, x, y };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Generiše niz pravougaonika za rasporede sa više slika (5–9) — slike su
// raspoređene u redove sa zadatim brojem kolona po redu (npr. [3, 2] za 5
// slika: 3 gore, 2 dole, centrirano), u istom stilu margina/razmaka kao i
// ručno složeni rasporedi za 1–4 slike.
function gridRects(rowCounts, margin = 6, gap = 4) {
  const rows = rowCounts.length;
  const fullWidth = 100 - margin * 2;
  const cellH = (100 - margin * 2 - gap * (rows - 1)) / rows;
  const rects = [];
  rowCounts.forEach((cols, r) => {
    // Svaki red nezavisno popunjava celu raspoloživu širinu — širina
    // ćelije zavisi samo od broja kolona U TOM redu, tako da npr. 3
    // ćelije u redu zauzimaju istu ukupnu širinu kao i 4 u redu iznad.
    const cellW = (fullWidth - gap * (cols - 1)) / cols;
    for (let c = 0; c < cols; c++) {
      rects.push({
        x: round2(margin + c * (cellW + gap)),
        y: round2(margin + r * (cellH + gap)),
        w: round2(cellW),
        h: round2(cellH),
      });
    }
  });
  return rects;
}

// Gotovi rasporedi slika po strani — samo za unutrašnje strane (2–29),
// korice nemaju raspored. Pozicije su u procentima strane. Za neke brojeve
// slika (npr. 3) postoji više varijanti rasporeda na izbor.
const PHOTO_LAYOUTS = {
  1: [
    {
      id: "full",
      label: "Cela strana",
      rects: [{ x: 6, y: 6, w: 88, h: 88 }],
    },
  ],
  2: [
    {
      id: "stack",
      label: "Gore i dole",
      rects: [
        { x: 6, y: 5, w: 88, h: 42 },
        { x: 6, y: 53, w: 88, h: 42 },
      ],
    },
  ],
  3: [
    {
      id: "top-two",
      label: "Jedna gore, dve dole",
      rects: [
        { x: 6, y: 5, w: 88, h: 52 },
        { x: 6, y: 60, w: 42, h: 35 },
        { x: 52, y: 60, w: 42, h: 35 },
      ],
    },
    {
      id: "portrait-left",
      label: "Portret levo, dve landscape desno",
      rects: [
        { x: 6, y: 6, w: 42, h: 88 },
        { x: 52, y: 6, w: 42, h: 42 },
        { x: 52, y: 52, w: 42, h: 42 },
      ],
    },
    {
      id: "portrait-right",
      label: "Dve landscape levo, portret desno",
      rects: [
        { x: 6, y: 6, w: 42, h: 42 },
        { x: 6, y: 52, w: 42, h: 42 },
        { x: 52, y: 6, w: 42, h: 88 },
      ],
    },
  ],
  4: [
    {
      id: "grid",
      label: "Mreža 2×2",
      rects: [
        { x: 6, y: 5, w: 42, h: 42 },
        { x: 52, y: 5, w: 42, h: 42 },
        { x: 6, y: 53, w: 42, h: 42 },
        { x: 52, y: 53, w: 42, h: 42 },
      ],
    },
  ],
  5: [{ id: "grid-5", label: "5 slika (3+2)", rects: gridRects([3, 2]) }],
  6: [{ id: "grid-6", label: "Mreža 3×2", rects: gridRects([3, 3]) }],
  7: [
    { id: "top-4", label: "4 gore, 3 dole", rects: gridRects([4, 3]) },
    { id: "top-3", label: "3 gore, 4 dole", rects: gridRects([3, 4]) },
  ],
  8: [{ id: "grid-8", label: "Mreža 4×2", rects: gridRects([4, 4]) }],
  9: [{ id: "grid-9", label: "Mreža 3×3", rects: gridRects([3, 3, 3]) }],
};

// Pravilna množina reči "slika" za brojeve 1–9 (1 = slika, 2–4 = slike,
// 5–9 = slika — genitiv množine).
function pluralSlika(count) {
  if (count === 1) return "slika";
  if (count >= 2 && count <= 4) return "slike";
  return "slika";
}

// Ručno nacrtane SVG ilustracije za venčane stikere (umesto emoji znakova,
// koji izgledaju različito od uređaja do uređaja) — svaka je u 0–100
// koordinatnom sistemu i popunjava ceo kvadratni okvir elementa.
function StickerRings() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="36" cy="60" r="20" fill="none" stroke="#c9922c" strokeWidth="7" />
      <circle cx="60" cy="60" r="20" fill="none" stroke="#e8c15a" strokeWidth="7" />
      <path d="M60 30 L65 38 L60 46 L55 38 Z" fill="#bfe3ef" stroke="#8fc4d8" strokeWidth="1.5" />
    </svg>
  );
}
function StickerHearts() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path
        d="M50 78 C20 55 15 35 30 25 C40 19 50 27 50 35 C50 27 60 19 70 25 C85 35 80 55 50 78 Z"
        fill="#e8779d"
        transform="translate(-10,-6) scale(0.72)"
      />
      <path
        d="M50 78 C20 55 15 35 30 25 C40 19 50 27 50 35 C50 27 60 19 70 25 C85 35 80 55 50 78 Z"
        fill="#f3a9c4"
        transform="translate(8,4) scale(0.72)"
      />
    </svg>
  );
}
function StickerHeart() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path
        d="M50 82 C14 56 10 30 30 20 C42 14 50 24 50 34 C50 24 58 14 70 20 C90 30 86 56 50 82 Z"
        fill="#e8577f"
      />
      <path
        d="M34 30 C38 26 44 26 47 30"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
function StickerBouquet() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path d="M38 90 C40 72 42 60 44 52" stroke="#8a9a6b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M50 90 C50 74 50 60 50 50" stroke="#8a9a6b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M62 90 C60 72 58 60 56 52" stroke="#8a9a6b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="38" cy="36" r="13" fill="#f6c6d8" stroke="#e8a9c4" strokeWidth="1" />
      <circle cx="62" cy="34" r="12" fill="#f3a9c4" stroke="#e0729b" strokeWidth="1" />
      <circle cx="50" cy="48" r="14" fill="#e8779d" stroke="#d1527e" strokeWidth="1" />
      <circle cx="26" cy="50" r="9" fill="#cfe0c4" stroke="#aec89a" strokeWidth="1" />
      <circle cx="72" cy="48" r="9" fill="#cfe0c4" stroke="#aec89a" strokeWidth="1" />
      <circle cx="38" cy="36" r="3" fill="#e8c15a" />
      <circle cx="62" cy="34" r="3" fill="#e8c15a" />
      <circle cx="50" cy="48" r="3.4" fill="#fff3d6" />
      <path d="M42 76 C46 70 54 70 58 76 L54 88 C50 84 46 84 42 88 Z" fill="#c9922c" />
      <path d="M50 76 L50 82" stroke="#9c7322" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function StickerDove() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path
        d="M8 56 Q30 24 48 50 Q50 47 52 50 Q70 24 92 56 Q68 48 52 60 Q50 63 48 60 Q32 48 8 56 Z"
        fill="#fdfdfb"
        stroke="#b5ab98"
        strokeWidth="2.5"
      />
      <ellipse cx="48" cy="62" rx="11" ry="9" fill="#fdfdfb" stroke="#b5ab98" strokeWidth="2.5" />
      <circle cx="58" cy="55" r="7" fill="#fdfdfb" stroke="#b5ab98" strokeWidth="2.5" />
      <path d="M64 54 L74 51 L65 59 Z" fill="#e8c15a" />
      <circle cx="59" cy="52" r="1.6" fill="#2b2620" />
      <path d="M40 66 L28 74 L38 64 Z" fill="#fdfdfb" stroke="#b5ab98" strokeWidth="2" />
    </svg>
  );
}
function StickerFlower() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <g stroke="#d1527e" strokeWidth="1.4">
        <ellipse cx="50" cy="26" rx="13" ry="17" fill="#f3a9c4" />
        <ellipse cx="50" cy="74" rx="13" ry="17" fill="#f3a9c4" transform="rotate(180 50 50)" />
        <ellipse cx="26" cy="50" rx="13" ry="17" fill="#f6c6d8" transform="rotate(90 50 50)" />
        <ellipse cx="74" cy="50" rx="13" ry="17" fill="#f6c6d8" transform="rotate(-90 50 50)" />
        <ellipse cx="33" cy="33" rx="13" ry="17" fill="#f8d4e2" transform="rotate(45 33 33)" />
      </g>
      <circle cx="50" cy="50" r="11" fill="#e8c15a" stroke="#c9922c" strokeWidth="1.5" />
    </svg>
  );
}
function StickerChampagne() {
  const glass = (
    <>
      <path
        d="M30 20 L46 20 L43 46 C43 54 36 58 32 58 C28 58 21 54 21 46 Z"
        fill="#cfe7ef"
        stroke="#5e95a8"
        strokeWidth="2.5"
      />
      <rect x="30" y="58" width="4" height="18" fill="#5e95a8" />
      <rect x="22" y="76" width="20" height="4" rx="2" fill="#5e95a8" />
      <path d="M24 26 L42 26" stroke="#e8c15a" strokeWidth="2" />
    </>
  );
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <g transform="translate(-10,0)">
        {glass}
        <circle cx="35" cy="36" r="1.6" fill="#fff" />
        <circle cx="38" cy="44" r="1.3" fill="#fff" />
      </g>
      <g transform="translate(16,4)">
        {glass}
        <circle cx="35" cy="36" r="1.6" fill="#fff" />
      </g>
    </svg>
  );
}
function StickerBottle() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path d="M42 90 L40 42 Q40 30 50 22 Q60 30 60 42 L58 90 Z" fill="#e8c15a" />
      <rect x="44" y="12" width="12" height="14" rx="2" fill="#2b2620" />
      <path d="M30 28 Q24 20 30 14" stroke="#c9922c" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M70 28 Q76 20 70 14" stroke="#c9922c" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="42" rx="10" ry="5" fill="#f6dfa0" />
    </svg>
  );
}
function StickerCake() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <ellipse cx="50" cy="78" rx="34" ry="8" fill="#e8c15a" />
      <rect x="20" y="58" width="60" height="20" rx="3" fill="#faf3e4" stroke="#e3d7c0" strokeWidth="2" />
      <ellipse cx="50" cy="58" rx="30" ry="8" fill="#fffaf0" stroke="#e3d7c0" strokeWidth="2" />
      <rect x="28" y="38" width="44" height="20" rx="3" fill="#faf3e4" stroke="#e3d7c0" strokeWidth="2" />
      <ellipse cx="50" cy="38" rx="22" ry="7" fill="#fffaf0" stroke="#e3d7c0" strokeWidth="2" />
      <path d="M50 36 C44 28 44 20 50 14 C56 20 56 28 50 36 Z" fill="#e8577f" />
    </svg>
  );
}
function StickerRibbon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path
        d="M50 50 C50 50 20 35 20 20 C20 10 34 8 42 18 C46 24 50 34 50 34 C50 34 54 24 58 18 C66 8 80 10 80 20 C80 35 50 50 50 50 Z"
        fill="#e8779d"
      />
      <path
        d="M50 50 C50 50 20 65 20 80 C20 90 34 92 42 82 C46 76 50 66 50 66 C50 66 54 76 58 82 C66 92 80 90 80 80 C80 65 50 50 50 50 Z"
        fill="#f3a9c4"
      />
      <circle cx="50" cy="50" r="7" fill="#c9922c" />
    </svg>
  );
}
function StickerBell() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path
        d="M50 14 C50 14 60 14 60 28 C72 32 78 44 78 58 L22 58 C22 44 28 32 40 28 C40 14 50 14 50 14 Z"
        fill="#e8c15a"
      />
      <rect x="18" y="58" width="64" height="9" rx="4" fill="#c9922c" />
      <circle cx="50" cy="76" r="8" fill="#c9922c" />
      <path d="M38 22 Q50 10 62 22" stroke="#e8577f" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function StickerSparkles() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <g fill="#e8c15a">
        <path d="M50 20 L55 42 L77 47 L55 52 L50 74 L45 52 L23 47 L45 42 Z" />
        <path d="M78 18 L80 26 L88 28 L80 30 L78 38 L76 30 L68 28 L76 26 Z" />
        <path d="M22 62 L24 68 L30 70 L24 72 L22 78 L20 72 L14 70 L20 68 Z" />
      </g>
    </svg>
  );
}

// Dekorativni stikeri na temu venčanja — dodaju se kao poseban tip
// elementa (referenca na ilustraciju po id-ju), mogu se slobodno pomerati i
// menjati veličinu kao i tekst/slika. Dostupni su samo za album "vencanje".
const WEDDING_STICKERS = [
  { id: "rings", label: "Burme", Svg: StickerRings },
  { id: "hearts", label: "Srca", Svg: StickerHearts },
  { id: "heart", label: "Srce", Svg: StickerHeart },
  { id: "bouquet", label: "Buket", Svg: StickerBouquet },
  { id: "dove", label: "Golub", Svg: StickerDove },
  { id: "flower", label: "Cvet", Svg: StickerFlower },
  { id: "champagne", label: "Čaše", Svg: StickerChampagne },
  { id: "bottle", label: "Šampanjac", Svg: StickerBottle },
  { id: "cake", label: "Torta", Svg: StickerCake },
  { id: "ribbon", label: "Mašna", Svg: StickerRibbon },
  { id: "bell", label: "Zvono", Svg: StickerBell },
  { id: "sparkles", label: "Sjaj", Svg: StickerSparkles },
];

function getStickerDef(id) {
  return WEDDING_STICKERS.find((s) => s.id === id) || null;
}

function getLayoutVariant(count, variantId) {
  const variants = PHOTO_LAYOUTS[count] || [];
  return variants.find((v) => v.id === variantId) || variants[0] || null;
}

function getBackground(id) {
  return BACKGROUNDS.find((b) => b.id === id) || BACKGROUNDS[0];
}

// Vraća CSS stil pozadine za konkretnu stranu.
//  - Obična tema: isti stil za svaku stranu.
//  - Slikovna tema: A3 slika deljena preko razvoda — leva strana razvoda
//    (neparni indeks 1,3,5…) dobija levu polovinu slike, desna (parni)
//    desnu. Korice ne dobijaju sliku (tema pokriva samo strane 2–29),
//    već jednobojnu podlogu.
function pageBackgroundStyle(backgroundId, page, pageIndex) {
  const bg = getBackground(backgroundId);
  if (!bg.image) return bg.style || {};

  if (page.role !== "content") {
    return bg.coverStyle || { background: "#ffffff" };
  }

  const base = bg.coverStyle?.background || "#ffffff";
  if (bg.spread) {
    const isLeftPage = pageIndex % 2 === 1;
    return {
      backgroundColor: base,
      backgroundImage: `url(${bg.image})`,
      backgroundSize: "200% 100%",
      backgroundPosition: isLeftPage ? "left center" : "right center",
      backgroundRepeat: "no-repeat",
    };
  }
  return {
    backgroundColor: base,
    backgroundImage: `url(${bg.image})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

function getFont(id) {
  return FONTS.find((f) => f.id === id) || FONTS[0];
}

function waitFrames(n) {
  return new Promise((resolve) => {
    function tick(count) {
      if (count <= 0) return resolve();
      requestAnimationFrame(() => tick(count - 1));
    }
    tick(n);
  });
}

function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          })
    )
  );
}

export default function Editor({ typeId }) {
  const albumType = ALBUM_TYPES.find((t) => t.id === typeId);

  const [album, setAlbum] = useState(null);
  const [selectedViewIndex, setSelectedViewIndex] = useState(0);
  const [activePageId, setActivePageId] = useState(null);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportView, setExportView] = useState(null);
  // Da li je korisnik nešto izmenio u ovoj sesiji — ništa se ne čuva
  // između poseta, pa refresh/zatvaranje stranice vraća album na početak.
  const [isDirty, setIsDirty] = useState(false);

  const fileInputRef = useRef(null);
  const replaceTargetRef = useRef(null);
  const exportWrapRef = useRef(null);
  // Prati prethodan broj strana, da bi se posle dodavanja novih strana
  // (dugme "Dodaj još strana") editor automatski prebacio na novi razvod.
  const prevPageCountRef = useRef(null);

  // Album uvek kreće od nule (tačno 30 praznih strana) — ništa se ne
  // učitava iz prethodnih poseta, namerno, po zahtevu: refresh stranice
  // uvek poništava sve izmene.
  useEffect(() => {
    const initial = createDefaultAlbum(typeId);
    setAlbum(initial);
    setSelectedViewIndex(0);
    setActivePageId(initial.pages[0]?.id ?? null);
    setSelectedElementId(null);
    setIsDirty(false);
    prevPageCountRef.current = initial.pages.length;
  }, [typeId]);

  // Kada broj strana promeni (dodat ili obrisan razvod), prilagodi
  // trenutni pogled: ako su strane dodate, pređi na novi (poslednji)
  // razvod; ako su obrisane, ostani na istom mestu u listi (ili na
  // poslednjem validnom pogledu, ako je lista sad kraća).
  useEffect(() => {
    if (!album) return;
    const count = album.pages.length;
    const prevCount = prevPageCountRef.current;
    if (prevCount !== null && count !== prevCount) {
      const newViews = buildAlbumViews(album.pages);
      const targetIdx =
        count > prevCount
          ? newViews.length - 1
          : Math.min(selectedViewIndex, newViews.length - 1);
      setSelectedViewIndex(targetIdx);
      setActivePageId(album.pages[newViews[targetIdx].pageIndices[0]].id);
      setSelectedElementId(null);
    }
    prevPageCountRef.current = count;
  }, [album]);

  // Upozorenje pre napuštanja/osvežavanja stranice, ako ima neizmenjenih
  // izmena — pošto se ništa ne čuva, sve bi bilo izgubljeno.
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "Da li ste sigurni? Sve izmene će biti poništene.";
      return e.returnValue;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const views = useMemo(() => (album ? buildAlbumViews(album.pages) : []), [album]);
  const currentView = views[selectedViewIndex] || null;
  const activePage = album?.pages.find((p) => p.id === activePageId) || null;
  // Teme dostupne za ovaj tip albuma (slikovne teme samo za venčanje).
  const availableBackgrounds = useMemo(() => backgroundsForType(typeId), [typeId]);
  const hasImageThemes = availableBackgrounds.some((b) => b.image);
  const selectedElement = useMemo(() => {
    if (!album || !selectedElementId) return null;
    for (const p of album.pages) {
      const el = p.elements.find((e) => e.id === selectedElementId);
      if (el) return el;
    }
    return null;
  }, [album, selectedElementId]);

  function findOwnerPage(elId) {
    return album.pages.find((p) => p.elements.some((e) => e.id === elId)) || null;
  }

  function updatePage(pageId, updater) {
    setIsDirty(true);
    setAlbum((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === pageId ? updater(p) : p)),
    }));
  }

  function goToView(idx) {
    if (!album) return;
    const clamped = clamp(idx, 0, views.length - 1);
    const view = views[clamped];
    setSelectedViewIndex(clamped);
    setActivePageId(album.pages[view.pageIndices[0]].id);
    setSelectedElementId(null);
  }

  function activatePage(pageId) {
    setActivePageId(pageId);
  }

  function setAlbumBackground(bgId) {
    setIsDirty(true);
    setAlbum((prev) => ({ ...prev, background: bgId }));
  }

  // Dodaje još jedan razvod (2 nove A4 strane) na kraj albuma, odmah pre
  // zadnje korice.
  function addMorePages() {
    setIsDirty(true);
    setAlbum((prev) => ({ ...prev, pages: addContentSpread(prev.pages) }));
  }

  // Briše jedan razvod (2 strane) — samo ako su obe strane naknadno
  // dodate (removable). Početnih 30 (fiksnih) strana se ne mogu obrisati.
  function deleteSpread(view) {
    if (!album) return;
    const pagesInView = view.pageIndices.map((idx) => album.pages[idx]);
    if (!pagesInView.every((p) => p.removable)) return;
    if (
      !window.confirm(
        "Obrisati ovaj razvod (2 strane)? Sve slike i tekst na njemu će biti izgubljeni."
      )
    ) {
      return;
    }
    setIsDirty(true);
    const idsToRemove = pagesInView.map((p) => p.id);
    setAlbum((prev) => ({ ...prev, pages: removePages(prev.pages, idsToRemove) }));
  }

  // Postavlja raspored slika (1/2/3/4, uz varijantu rasporeda za brojeve
  // koji ih imaju) za jednu unutrašnju stranu — dodaje prazne "+" okvire
  // na predefinisane pozicije, gde korisnik klikom bira fotografiju.
  // Korice (role !== "content") nemaju raspored.
  function setPageLayout(pageId, count, variantId) {
    const targetPage = album.pages.find((p) => p.id === pageId);
    if (!targetPage || targetPage.role !== "content") return;

    const variant = getLayoutVariant(count, variantId);
    if (!variant) return;

    const existingSlots = targetPage.elements.filter((e) => e.layoutSlot);
    const hasFilledSlots = existingSlots.some((e) => e.src);
    if (
      hasFilledSlots &&
      !window.confirm(
        "Menjanje rasporeda će ukloniti slike koje su već postavljene u trenutnom rasporedu. Nastaviti?"
      )
    ) {
      return;
    }

    const newSlots = variant.rects.map((rect) =>
      clampElementBox({
        id: uid("el"),
        type: "photo",
        layoutSlot: true,
        src: null,
        ...rect,
      })
    );

    updatePage(pageId, (p) => ({
      ...p,
      layout: count,
      layoutVariant: variant.id,
      elements: [...newSlots, ...p.elements.filter((e) => !e.layoutSlot)],
    }));
    setSelectedElementId(null);
  }

  function addElement(el) {
    if (!activePage) return;
    const safeEl = clampElementBox(el);
    updatePage(activePage.id, (p) => ({ ...p, elements: [...p.elements, safeEl] }));
    setSelectedElementId(safeEl.id);
  }

  function updateElement(elId, patch) {
    const owner = findOwnerPage(elId);
    if (!owner) return;
    updatePage(owner.id, (p) => ({
      ...p,
      elements: p.elements.map((e) =>
        e.id === elId ? clampElementBox({ ...e, ...patch }) : e
      ),
    }));
  }

  function deleteElement(elId) {
    const owner = findOwnerPage(elId);
    if (!owner) return;
    updatePage(owner.id, (p) => ({
      ...p,
      elements: p.elements.filter((e) => e.id !== elId),
    }));
    setSelectedElementId(null);
  }

  function reorderElement(elId, toFront) {
    const owner = findOwnerPage(elId);
    if (!owner) return;
    updatePage(owner.id, (p) => {
      const el = p.elements.find((e) => e.id === elId);
      if (!el) return p;
      const rest = p.elements.filter((e) => e.id !== elId);
      return { ...p, elements: toFront ? [...rest, el] : [el, ...rest] };
    });
  }

  function addTextElement() {
    if (!activePage) return;
    addElement({
      id: uid("el"),
      type: "text",
      x: 10,
      y: 42,
      w: 80,
      h: 16,
      text: "Vaš tekst",
      fontId: FONTS[0].id,
      fontSizePct: 5.5,
      color: "#2b2620",
      align: "center",
      bold: false,
      italic: false,
    });
  }

  // Dodaje dekorativni stiker — podrazumevano centriran, pri dnu strane
  // (ispod mesta gde obično idu slike), kao kvadratić bez obzira na format
  // strane (A4/B4 nisu kvadratni, pa se visina računa prema odnosu strana).
  function addStickerElement(stickerId) {
    if (!activePage) return;
    const [pw, ph] = PAGE_FORMAT_MM[activePage.format] || PAGE_FORMAT_MM.A4;
    const wPct = 14;
    const hPct = round2(wPct * (pw / ph));
    addElement({
      id: uid("el"),
      type: "sticker",
      stickerId,
      x: round2((100 - wPct) / 2),
      y: round2(100 - hPct - 6),
      w: wPct,
      h: hPct,
    });
  }

  function triggerAddPhoto() {
    replaceTargetRef.current = null;
    fileInputRef.current?.click();
  }

  function triggerReplacePhoto(elId) {
    replaceTargetRef.current = elId;
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !activePage) {
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      const img = new Image();
      img.onload = () => {
        if (replaceTargetRef.current) {
          updateElement(replaceTargetRef.current, { src });
        } else {
          const ratio = img.width / img.height || 1;
          let w, h;
          if (ratio >= 1) {
            w = 70;
            h = 70 / ratio;
          } else {
            h = 70;
            w = 70 * ratio;
          }
          w = clamp(w, 10, 100);
          h = clamp(h, 10, 100);
          addElement({
            id: uid("el"),
            type: "photo",
            src,
            x: (100 - w) / 2,
            y: (100 - h) / 2,
            w,
            h,
          });
        }
        replaceTargetRef.current = null;
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Brisanje elementa preko tastature (Delete/Backspace), ali ne dok
  // korisnik kuca u tekst polje ili uređuje tekst elementa.
  useEffect(() => {
    function onKeyDown(e) {
      if (!selectedElementId) return;
      const active = document.activeElement;
      if (
        active &&
        (active.isContentEditable ||
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteElement(selectedElementId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedElementId, album]);

  // 1cm bela margina sa svake strane svakog lista u PDF-u, za štampu i
  // sečenje (ne utiče na sam editor, samo na izvezeni fajl).
  const PDF_BLEED_MM = 10;

  async function handleExportPdf() {
    if (!album || isExporting) return;
    setIsExporting(true);
    setSelectedElementId(null);
    await waitFrames(2);
    try {
      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = html2canvasModule.default;

      // Ako je izabrana slikovna tema, sačekaj da se slika učita (uđe u
      // keš) pre nego što html2canvas počne da snima strane.
      const bgDef = getBackground(album.background);
      if (bgDef.image) {
        await new Promise((res) => {
          const img = new Image();
          img.onload = res;
          img.onerror = res;
          img.src = bgDef.image;
        });
      }

      // Izvoz prati isti raspored kao editor: svaki razvod (korice ili dve
      // strane) ide na JEDAN list u PDF-u — korice kao B3 (2×B4), ostali
      // razvodi kao A3 (2×A4) — uz 1cm bele margine sa svake strane.
      const exportViews = buildAlbumViews(album.pages);
      let doc = null;

      for (let i = 0; i < exportViews.length; i++) {
        const view = exportViews[i];
        const firstPage = album.pages[view.pageIndices[0]];
        const [pw, ph] = PAGE_FORMAT_MM[firstPage.format] || PAGE_FORMAT_MM.A4;
        const sheetW = pw * 2;
        const sheetH = ph;
        const pdfW = sheetW + PDF_BLEED_MM * 2;
        const pdfH = sheetH + PDF_BLEED_MM * 2;

        setExportView(view);
        await waitFrames(2);
        const node = exportWrapRef.current;
        if (!node) continue;
        await waitForImages(node);
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        if (!doc) {
          doc = new jsPDF({ unit: "mm", format: [pdfW, pdfH], orientation: "landscape" });
        } else {
          doc.addPage([pdfW, pdfH], "landscape");
        }
        doc.addImage(imgData, "JPEG", PDF_BLEED_MM, PDF_BLEED_MM, sheetW, sheetH);
      }

      const safeTitle =
        (album.title || "foto-album")
          .trim()
          .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
          .replace(/\s+/g, "-") || "foto-album";
      doc.save(`${safeTitle}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Došlo je do greške prilikom izvoza u PDF. Pokušajte ponovo.");
    } finally {
      setExportView(null);
      setIsExporting(false);
    }
  }

  if (!albumType) {
    return (
      <main className={styles.notFound}>
        <p>Nepoznat tip albuma.</p>
        <Link href="/" className="btn-ghost">
          Nazad na početnu
        </Link>
      </main>
    );
  }

  if (!album || !activePage || !currentView) {
    return <main className={styles.loading}>Učitavanje editora…</main>;
  }

  const activePageNumber = album.pages.findIndex((p) => p.id === activePage.id) + 1;

  return (
    <div className={styles.editor}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.backLink}>
          ← Početna
        </Link>
        <input
          className={styles.titleInput}
          value={album.title}
          onChange={(e) => {
            setIsDirty(true);
            setAlbum((prev) => ({ ...prev, title: e.target.value }));
          }}
          aria-label="Naziv albuma"
        />
        <div className={styles.navGroup}>
          <button
            type="button"
            onClick={() => goToView(selectedViewIndex - 1)}
            disabled={selectedViewIndex === 0}
            aria-label="Prethodni pogled"
          >
            ‹
          </button>
          <span className={styles.pageCounter}>
            {describeView(currentView, album.pages.length)}
          </span>
          <button
            type="button"
            onClick={() => goToView(selectedViewIndex + 1)}
            disabled={selectedViewIndex === views.length - 1}
            aria-label="Sledeći pogled"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleExportPdf}
          disabled={isExporting}
        >
          {isExporting ? "Izvoz u toku…" : "Izvezi u PDF"}
        </button>
      </header>

      <div className={styles.body}>
        <aside className={styles.pagesRail}>
          <div className={styles.pagesList}>
            {views.map((view, vIdx) => {
              const isRemovable = view.pageIndices.every(
                (idx) => album.pages[idx].removable
              );
              return (
                <div
                  key={vIdx}
                  className={`${styles.pageThumbWrap} ${
                    vIdx === selectedViewIndex ? styles.pageThumbActive : ""
                  }`}
                >
                  <button
                    type="button"
                    className={styles.pageThumbBtn}
                    onClick={() => goToView(vIdx)}
                    aria-label={describeView(view, album.pages.length)}
                  >
                    <div className={styles.spreadThumbInner}>
                      {view.pageIndices.map((idx) => (
                        <Stage
                          key={album.pages[idx].id}
                          page={album.pages[idx]}
                          pageIndex={idx}
                          background={album.background}
                          interactive={false}
                        />
                      ))}
                    </div>
                  </button>
                  {isRemovable && (
                    <button
                      type="button"
                      className={styles.deleteSpreadBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSpread(view);
                      }}
                      title="Obriši ovaj razvod"
                      aria-label="Obriši ovaj razvod"
                    >
                      ✕
                    </button>
                  )}
                  <div className={styles.pageThumbMeta}>
                    <span>{describeView(view, album.pages.length)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className={styles.addSpreadBtn} onClick={addMorePages}>
            + Dodaj još 2 strane
          </button>
        </aside>

        <main className={styles.stageArea}>
          <div className={styles.spreadWrap}>
            {currentView.pageIndices.map((idx) => {
              const page = album.pages[idx];
              return (
                <div
                  key={page.id}
                  className={`${styles.pageSlot} ${
                    activePageId === page.id ? styles.pageSlotActive : ""
                  }`}
                >
                  <Stage
                    page={page}
                    pageIndex={idx}
                    background={album.background}
                    interactive
                    selectedElementId={isExporting ? null : selectedElementId}
                    isExporting={isExporting}
                    onSelectElement={(elId) => {
                      activatePage(page.id);
                      setSelectedElementId(elId);
                    }}
                    onUpdateElement={updateElement}
                    onDeselect={() => {
                      activatePage(page.id);
                      setSelectedElementId(null);
                    }}
                    onRequestPhoto={(elId) => {
                      activatePage(page.id);
                      triggerReplacePhoto(elId);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </main>

        <aside className={styles.panel}>
          <section className={styles.panelSection}>
            <h3>Tema albuma</h3>
            <p className={styles.hint}>
              Dostupne teme: {availableBackgrounds.length}. Primenjuje se na ceo
              album{hasImageThemes ? "; dekorativne teme pokrivaju strane 2–29" : ""}.
            </p>
            <div className={styles.swatchRow}>
              {availableBackgrounds.map((bg) => (
                <button
                  type="button"
                  key={bg.id}
                  className={`${styles.swatch} ${
                    album.background === bg.id ? styles.swatchActive : ""
                  }`}
                  style={bg.swatchStyle || bg.style}
                  onClick={() => setAlbumBackground(bg.id)}
                  title={bg.label}
                >
                  {album.background === bg.id && (
                    <span className={styles.swatchCheck}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {activePage.role === "content" && (
            <section className={styles.panelSection}>
              <h3>Raspored slika</h3>
              <p className={styles.hint}>
                Koliko slika ide na stranu {activePageNumber} (kliknite na stranu da je
                izaberete).
              </p>
              <div className={styles.layoutRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((count) => (
                  <button
                    type="button"
                    key={count}
                    className={`${styles.layoutBtn} ${
                      activePage.layout === count ? styles.layoutBtnActive : ""
                    }`}
                    onClick={() => setPageLayout(activePage.id, count)}
                    title={`${count} ${pluralSlika(count)} po strani`}
                  >
                    <LayoutPreviewIcon rects={PHOTO_LAYOUTS[count][0].rects} />
                    <span>{count}</span>
                  </button>
                ))}
              </div>

              {activePage.layout && PHOTO_LAYOUTS[activePage.layout].length > 1 && (
                <>
                  <p className={styles.hint} style={{ marginTop: "0.8rem" }}>
                    Varijanta rasporeda za {activePage.layout} {pluralSlika(activePage.layout)}:
                  </p>
                  <div className={styles.layoutRow}>
                    {PHOTO_LAYOUTS[activePage.layout].map((variant) => (
                      <button
                        type="button"
                        key={variant.id}
                        className={`${styles.layoutBtn} ${
                          activePage.layoutVariant === variant.id ? styles.layoutBtnActive : ""
                        }`}
                        onClick={() => setPageLayout(activePage.id, activePage.layout, variant.id)}
                        title={variant.label}
                      >
                        <LayoutPreviewIcon rects={variant.rects} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          <section className={styles.panelSection}>
            <h3>Dodaj element</h3>
            <p className={styles.hint}>
              Dodaje se na stranu {activePageNumber} (kliknite na stranu da je izaberete).
            </p>
            <div className={styles.addRow}>
              <button type="button" className="btn-ghost" onClick={addTextElement}>
                + Tekst
              </button>
              <button type="button" className="btn-ghost" onClick={triggerAddPhoto}>
                + Slika
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />
          </section>

          {typeId === "vencanje" && (
            <section className={styles.panelSection}>
              <h3>Stikeri</h3>
              <p className={styles.hint}>
                Dekoracija na temu venčanja — dodaje se na stranu {activePageNumber}.
              </p>
              <div className={styles.stickerRow}>
                {WEDDING_STICKERS.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={styles.stickerBtn}
                    onClick={() => addStickerElement(s.id)}
                    title={s.label}
                  >
                    <s.Svg />
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedElement && selectedElement.type === "text" && (
            <section className={styles.panelSection}>
              <h3>Tekst</h3>
              <p className={styles.hint}>Dostupna su {MAX_FONTS} fonta.</p>
              <div className={styles.fontRow}>
                {FONTS.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    className={`${styles.fontBtn} ${
                      selectedElement.fontId === f.id ? styles.fontBtnActive : ""
                    }`}
                    style={{ fontFamily: f.family }}
                    onClick={() => updateElement(selectedElement.id, { fontId: f.id })}
                    title={f.label}
                  >
                    Ab
                  </button>
                ))}
              </div>
              <label className={styles.fieldLabel}>
                Veličina
                <input
                  type="range"
                  min="2"
                  max="12"
                  step="0.5"
                  value={selectedElement.fontSizePct}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      fontSizePct: parseFloat(e.target.value),
                    })
                  }
                />
              </label>
              <label className={styles.fieldLabel}>
                Boja
                <input
                  type="color"
                  value={selectedElement.color}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { color: e.target.value })
                  }
                />
              </label>
              <div className={styles.toggleRow}>
                <button
                  type="button"
                  className={selectedElement.bold ? styles.toggleActive : ""}
                  onClick={() =>
                    updateElement(selectedElement.id, { bold: !selectedElement.bold })
                  }
                >
                  <b>B</b>
                </button>
                <button
                  type="button"
                  className={selectedElement.italic ? styles.toggleActive : ""}
                  onClick={() =>
                    updateElement(selectedElement.id, {
                      italic: !selectedElement.italic,
                    })
                  }
                >
                  <i>I</i>
                </button>
                {["left", "center", "right"].map((a) => (
                  <button
                    type="button"
                    key={a}
                    className={selectedElement.align === a ? styles.toggleActive : ""}
                    onClick={() => updateElement(selectedElement.id, { align: a })}
                    title={a}
                  >
                    {a === "left" ? "⟵" : a === "center" ? "↔" : "⟶"}
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedElement && selectedElement.type === "photo" && (
            <section className={styles.panelSection}>
              <h3>Slika</h3>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => triggerReplacePhoto(selectedElement.id)}
              >
                Zameni sliku
              </button>
            </section>
          )}

          {selectedElement && (
            <section className={styles.panelSection}>
              <div className={styles.addRow}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => reorderElement(selectedElement.id, true)}
                >
                  Ispred
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => reorderElement(selectedElement.id, false)}
                >
                  Iza
                </button>
              </div>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => deleteElement(selectedElement.id)}
              >
                Obriši element
              </button>
            </section>
          )}
        </aside>
      </div>

      {exportView && (
        <div className={styles.exportSandbox} aria-hidden>
          {/* Ceo razvod se renderuje zajedno (bez razmaka) da bi se snimio
              kao jedan list — isto kao što će izgledati odštampan. */}
          <div
            ref={exportWrapRef}
            className={styles.spreadWrap}
            style={{ width: "1600px", gap: 0 }}
          >
            {exportView.pageIndices.map((idx) => (
              <div key={album.pages[idx].id} className={styles.pageSlot}>
                <Stage
                  page={album.pages[idx]}
                  pageIndex={idx}
                  background={album.background}
                  interactive={false}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stage({
  page,
  pageIndex,
  background,
  interactive,
  stageRef,
  selectedElementId,
  isExporting,
  onSelectElement,
  onUpdateElement,
  onDeselect,
  onRequestPhoto,
}) {
  const bgStyle = pageBackgroundStyle(background, page, pageIndex);
  const [w, h] = PAGE_FORMAT_MM[page.format] || PAGE_FORMAT_MM.A4;
  // Vodilje centra strane — prikazuju se samo dok se element aktivno
  // pomera (mode "move"), da bi se videlo gde je centar strane.
  const [guide, setGuide] = useState(null); // null ili { v: bool, h: bool }

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      style={{ ...bgStyle, aspectRatio: `${w} / ${h}` }}
      onPointerDown={
        interactive
          ? (e) => {
              if (e.target === e.currentTarget) onDeselect?.();
            }
          : undefined
      }
    >
      {page.elements.map((el) => (
        <StageElement
          key={el.id}
          el={el}
          interactive={interactive}
          selected={interactive && selectedElementId === el.id}
          isExporting={isExporting}
          onSelect={() => onSelectElement?.(el.id)}
          onChange={(patch) => onUpdateElement?.(el.id, patch)}
          onGuideChange={interactive ? setGuide : undefined}
          onRequestPhoto={onRequestPhoto}
        />
      ))}
      {interactive && guide && (
        <>
          <div
            className={`${styles.centerGuideV} ${guide.v ? styles.centerGuideActive : ""}`}
          />
          <div
            className={`${styles.centerGuideH} ${guide.h ? styles.centerGuideActive : ""}`}
          />
        </>
      )}
    </div>
  );
}

function StageElement({
  el,
  interactive,
  selected,
  isExporting,
  onSelect,
  onChange,
  onGuideChange,
  onRequestPhoto,
}) {
  const dragRef = useRef(null);
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [editing, setEditing] = useState(false);

  function onPointerDown(e) {
    if (!interactive || isExporting) return;
    if (editing && e.target.closest("[data-text-content]")) return;
    e.stopPropagation();
    onSelect();
    // Prazan "+" okvir se samo klikne (otvara izbor slike) — ne pokreće se
    // prevlačenje niti se hvata pokazivač, da klik ispravno stigne do
    // dugmeta ispod (setPointerCapture bi mu "ukrao" naredni klik).
    if (e.target.closest("[data-empty-slot]")) return;
    const rect = boxRef.current.parentElement.getBoundingClientRect();
    const isHandle = !!e.target.closest("[data-handle]");
    const mode = isHandle ? "resize" : "move";
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: el.x, y: el.y, w: el.w, h: el.h },
      rect,
    };
    boxRef.current.setPointerCapture(e.pointerId);
    // Odmah prikaži vodilje centra čim krene pomeranje (i pre prvog pomeraja).
    if (mode === "move") onGuideChange?.({ v: false, h: false });
  }

  function onClickWrapper(e) {
    if (!interactive) return;
    if (e.target.closest("[data-empty-slot]")) {
      e.stopPropagation();
      onRequestPhoto?.(el.id);
    }
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dxPct = ((e.clientX - d.startX) / d.rect.width) * 100;
    const dyPct = ((e.clientY - d.startY) / d.rect.height) * 100;
    if (d.mode === "move") {
      // Pomeranje je uvek ograničeno na granice strane (0–100%).
      let nx = clamp(d.orig.x + dxPct, 0, 100 - el.w);
      let ny = clamp(d.orig.y + dyPct, 0, 100 - el.h);

      // "Lepljenje" za centar strane, po horizontali i vertikali posebno.
      const centerX = nx + el.w / 2;
      const centerY = ny + el.h / 2;
      const snapV = Math.abs(centerX - 50) < CENTER_SNAP;
      const snapH = Math.abs(centerY - 50) < CENTER_SNAP;
      if (snapV) nx = clamp(50 - el.w / 2, 0, 100 - el.w);
      if (snapH) ny = clamp(50 - el.h / 2, 0, 100 - el.h);

      onGuideChange?.({ v: snapV, h: snapH });
      onChange({ x: nx, y: ny });
    } else {
      onChange({
        w: clamp(d.orig.w + dxPct, 6, 100 - d.orig.x),
        h: clamp(d.orig.h + dyPct, 6, 100 - d.orig.y),
      });
    }
  }

  function onPointerUp(e) {
    dragRef.current = null;
    onGuideChange?.(null);
    try {
      boxRef.current.releasePointerCapture(e.pointerId);
    } catch {
      // ignoriši ako pokazivač već nije zarobljen
    }
  }

  function onDoubleClick(e) {
    if (!interactive || el.type !== "text") return;
    e.stopPropagation();
    setEditing(true);
    requestAnimationFrame(() => textRef.current?.focus());
  }

  function onBlurText() {
    setEditing(false);
    onChange({ text: textRef.current?.innerText ?? el.text });
  }

  const style = {
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
  };

  return (
    <div
      ref={boxRef}
      className={`${styles.element} ${selected ? styles.elementSelected : ""} ${
        interactive ? styles.interactiveEl : ""
      }`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClickWrapper}
      onDoubleClick={onDoubleClick}
    >
      {el.type === "photo" ? (
        el.src ? (
          <img src={el.src} alt="" draggable={false} className={styles.photo} />
        ) : (
          <div className={styles.emptySlot} data-empty-slot>
            <span className={styles.emptySlotPlus}>+</span>
            <span className={styles.emptySlotLabel}>Dodaj sliku</span>
          </div>
        )
      ) : el.type === "sticker" ? (
        <div className={styles.sticker}>
          {(() => {
            const def = getStickerDef(el.stickerId);
            return def ? <def.Svg /> : null;
          })()}
        </div>
      ) : (
        <div
          ref={textRef}
          data-text-content
          className={styles.text}
          contentEditable={interactive && editing}
          suppressContentEditableWarning
          onBlur={onBlurText}
          style={{
            fontFamily: getFont(el.fontId).family,
            fontSize: `${el.fontSizePct}cqw`,
            color: el.color,
            fontWeight: el.bold ? 700 : 400,
            fontStyle: el.italic ? "italic" : "normal",
            textAlign: el.align,
            userSelect: editing ? "text" : "none",
          }}
        >
          {el.text}
        </div>
      )}
      {interactive && selected && !isExporting && (
        <span className={styles.resizeHandle} data-handle />
      )}
    </div>
  );
}

// Mala vizuelna ikonica u panelu koja pokazuje kako izgleda raspored,
// na osnovu istih procenata koji se koriste na strani.
function LayoutPreviewIcon({ rects }) {
  return (
    <span className={styles.layoutIcon}>
      {rects.map((r, i) => (
        <span
          key={i}
          className={styles.layoutIconRect}
          style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
        />
      ))}
    </span>
  );
}
