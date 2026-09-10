import Link from "next/link";
import { ALBUM_TYPES } from "@/lib/albumConfig";

// TODO: zameni pravim podacima studija.
const INSTAGRAM_HANDLE = "@moonlight.studio.nis";
const INSTAGRAM_URL = "https://instagram.com/moonlight.studio.nis";
const PHONE_DISPLAY = "+381 64 007 2620";
const PHONE_HREF = "+381640072620";

export default function Home() {
  return (
    <main className="home">
      <div className="home-inner">
        <section className="home-hero">
          <div className="home-brand">
            <img src="/logo.png" alt="Moonlight Studio" className="home-logo" />
            <div className="home-brand-text">
              <h1 className="home-brand-title">Moonlight foto studio</h1>
              <p className="home-brand-subtitle">Izrada foto albuma</p>
            </div>
          </div>
          <p>
            Dobrodošli u Moonlight foto studio! Kreirajte svoj personalizovani foto album i sačuvajte svoje dragocene uspomene zauvek. Naš studio nudi širok spektar opcija za izradu foto albuma, od klasičnih do modernih dizajna, kako biste mogli da izrazite svoju kreativnost i stil.
          </p>
        </section>

        <section className="type-grid">
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

        <section className="home-contact">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="home-contact-link"
          >
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle className="home-ig-dot" cx="17.3" cy="6.7" r="0.6" />
            </svg>
            {INSTAGRAM_HANDLE}
          </a>
          <a href={`tel:${PHONE_HREF}`} className="home-contact-link">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {PHONE_DISPLAY}
          </a>
        </section>
      </div>
    </main>
  );
}
