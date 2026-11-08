import Link from "next/link";
import { ALBUM_TYPES } from "@/lib/albumConfig";

// TODO: zameni pravim podacima studija.
const INSTAGRAM_HANDLE = "@moonlight.studio.nis";
const INSTAGRAM_URL = "https://instagram.com/moonlight.studio.nis";
const PHONE_DISPLAY = "+381 64 007 2620";
const PHONE_HREF = "+381640072620";
const EMAIL_DISPLAY = "info@moonlightstudio.rs";
const EMAIL_HREF = "info@moonlightstudio.rs";

// Lokacija studija — link koji je dao korisnik (otvara se u Google mapama);
// koordinate ispod su iz tog istog linka, samo za ugrađenu (embed) mapu.
const MAPS_URL = "https://maps.app.goo.gl/6JxBEQwie3sr3FAn8";
const MAPS_EMBED_SRC =
  "https://www.google.com/maps?q=43.3113052,21.8999927&z=16&output=embed";

export default function Home() {
  return (
    <main className="home">
      <div className="home-inner">
        <section className="home-hero">
          <div className="home-hero-text">
            <div className="home-brand">
              <img src="/logo.png" alt="Moonlight Studio" className="home-logo" />
              <div className="home-brand-text">
                <h1 className="home-brand-title">MakeBook</h1>
                <p className="home-brand-subtitle">Izrada foto albuma</p>
              </div>
            </div>
            <h2 className="home-headline">
              Sačuvajte svoje najdraže uspomene na stranicama koje traju
            </h2>
            <p className="home-lede">
              Kreirajte svoj personalizovani foto album i sačuvajte dragocene
              uspomene zauvek. Od venčanja do rođendana — sami birate teme,
              rasporede i stil korica, mi se brinemo da album bude spreman za
              štampu.
            </p>
            <a href="#albumi" className="btn-primary home-cta">
              Započni izradu
            </a>
          </div>

          <div className="home-collage" aria-hidden>
            <img src="/pocetna/Moonlight_08.JPG" alt="" className="home-collage-photo home-collage-1" />
            <img src="/pocetna/Moonlight_109.JPG" alt="" className="home-collage-photo home-collage-2" />
            <img src="/pocetna/Moonlight_13.JPG" alt="" className="home-collage-photo home-collage-3" />
            <img src="/pocetna/Moonlight_164.JPG" alt="" className="home-collage-photo home-collage-4" />
            <img src="/pocetna/Moonlight_290.jpg" alt="" className="home-collage-photo home-collage-5" />
            <img src="/pocetna/Moonlight_300.jpg" alt="" className="home-collage-photo home-collage-6" />
            <img src="/pocetna/Moonlight_303.jpg" alt="" className="home-collage-photo home-collage-7" />
            <img src="/pocetna/Moonlight_312.jpg" alt="" className="home-collage-photo home-collage-8" />
            <img src="/pocetna/Moonlight_323.jpg" alt="" className="home-collage-photo home-collage-9" />
            <img src="/pocetna/Moonlight_371.jpg" alt="" className="home-collage-photo home-collage-10" />
          </div>
        </section>

        <section className="type-grid" id="albumi">
          {ALBUM_TYPES.map((type) => (
            <Link
              key={type.id}
              href={`/editor/${type.id}`}
              className="type-card"
              style={{ "--card-photo": `url(${type.photo})` }}
            >
              <span className="type-icon" aria-hidden>
                {type.icon}
              </span>
              <h2>{type.short}</h2>
              <p>{type.description}</p>
              <span className="type-cta">Izaberi →</span>
            </Link>
          ))}
        </section>
      </div>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-col">
            <div className="home-footer-brand">
              <img src="/logo.png" alt="" className="home-footer-logo" />
              <span className="home-footer-title">MakeBook</span>
            </div>
            <p className="home-footer-text">
              Studio za izradu personalizovanih foto albuma — venčanje, 18.
              rođendan i prvi rođendan.
            </p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="home-contact-link"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle className="home-ig-dot" cx="17.3" cy="6.7" r="0.6" />
              </svg>
              {INSTAGRAM_HANDLE}
            </a>
          </div>

          <div className="home-footer-col">
            <h3 className="home-footer-heading">Kontakt</h3>
            <a href={`tel:${PHONE_HREF}`} className="home-contact-link">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {PHONE_DISPLAY}
            </a>
            <a href={`mailto:${EMAIL_HREF}`} className="home-contact-link">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                <path d="m3.5 6 8.5 7 8.5-7" />
              </svg>
              {EMAIL_DISPLAY}
            </a>
          </div>

          <div className="home-footer-col home-footer-map-col">
            <h3 className="home-footer-heading">Lokacija</h3>
            <p className="home-footer-text">Moonlight Photo Studio — Niš</p>
            <div className="home-map-frame">
              <iframe
                src={MAPS_EMBED_SRC}
                title="Lokacija studija na Google mapi"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="home-contact-link"
            >
              Otvori u Google mapama →
            </a>
          </div>
        </div>

        <p className="home-footer-copy">
          © {new Date().getFullYear()} MakeBook — Moonlight Photo Studio
        </p>
      </footer>
    </main>
  );
}
