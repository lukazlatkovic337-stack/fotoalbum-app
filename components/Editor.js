"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ALBUM_TYPES,
  BACKGROUNDS,
  FONTS,
  PAGE_FORMAT_MM,
  backgroundsForType,
  buildAlbumViews,
  createDefaultAlbum,
  describeView,
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
};

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
  const [exportPage, setExportPage] = useState(null);
  // Da li je korisnik nešto izmenio u ovoj sesiji — ništa se ne čuva
  // između poseta, pa refresh/zatvaranje stranice vraća album na početak.
  const [isDirty, setIsDirty] = useState(false);

  const fileInputRef = useRef(null);
  const replaceTargetRef = useRef(null);
  const exportStageRef = useRef(null);

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
  }, [typeId]);

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

      const firstFormat = PAGE_FORMAT_MM[album.pages[0].format];
      const doc = new jsPDF({ unit: "mm", format: firstFormat });

      for (let i = 0; i < album.pages.length; i++) {
        const page = album.pages[i];
        const [w, h] = PAGE_FORMAT_MM[page.format];
        setExportPage(page);
        await waitFrames(2);
        const node = exportStageRef.current;
        if (!node) continue;
        await waitForImages(node);
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) doc.addPage([w, h], "portrait");
        doc.addImage(imgData, "JPEG", 0, 0, w, h);
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
      setExportPage(null);
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
          <span className={styles.pageCounter}>{describeView(currentView)}</span>
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
            {views.map((view, vIdx) => (
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
                  aria-label={describeView(view)}
                >
                  <div
                    className={
                      view.type === "cover" ? styles.coverThumbInner : styles.spreadThumbInner
                    }
                  >
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
                <div className={styles.pageThumbMeta}>
                  <span>{describeView(view)}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className={styles.stageArea}>
          <div className={currentView.type === "cover" ? styles.coverWrap : styles.spreadWrap}>
            {currentView.pageIndices.map((idx) => {
              const page = album.pages[idx];
              return (
                <div
                  key={page.id}
                  className={`${styles.pageSlot} ${
                    currentView.pageIndices.length > 1 && activePageId === page.id
                      ? styles.pageSlotActive
                      : ""
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

          {currentView.type === "spread" && (
            <section className={styles.panelSection}>
              <h3>Raspored slika</h3>
              <p className={styles.hint}>
                Koliko slika ide na stranu {activePageNumber}
                {currentView.pageIndices.length > 1 ? " (kliknite na stranu da je izaberete)" : ""}.
              </p>
              <div className={styles.layoutRow}>
                {[1, 2, 3, 4].map((count) => (
                  <button
                    type="button"
                    key={count}
                    className={`${styles.layoutBtn} ${
                      activePage.layout === count ? styles.layoutBtnActive : ""
                    }`}
                    onClick={() => setPageLayout(activePage.id, count)}
                    title={`${count} ${count === 1 ? "slika" : "slike"} po strani`}
                  >
                    <LayoutPreviewIcon rects={PHOTO_LAYOUTS[count][0].rects} />
                    <span>{count}</span>
                  </button>
                ))}
              </div>

              {activePage.layout && PHOTO_LAYOUTS[activePage.layout].length > 1 && (
                <>
                  <p className={styles.hint} style={{ marginTop: "0.8rem" }}>
                    Varijanta rasporeda za {activePage.layout} slike:
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
              Dodaje se na stranu {activePageNumber}
              {currentView.pageIndices.length > 1 ? " (kliknite na stranu da je izaberete)" : ""}.
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

      {exportPage && (
        <div className={styles.exportSandbox} aria-hidden>
          <Stage
            page={exportPage}
            pageIndex={album.pages.findIndex((p) => p.id === exportPage.id)}
            background={album.background}
            interactive={false}
            stageRef={exportStageRef}
          />
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
