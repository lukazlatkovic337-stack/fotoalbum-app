import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1>Stranica nije pronađena</h1>
      <p>Traženi sadržaj ne postoji.</p>
      <Link href="/" className="btn-primary">
        Nazad na početnu
      </Link>
    </main>
  );
}
