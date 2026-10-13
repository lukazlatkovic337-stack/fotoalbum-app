# MakeBook – kreator foto albuma

Web sajt za kreiranje personalizovanih foto albuma za tri prilike:
venčanje, 18. rođendan i prvi rođendan.

## Kako radi

1. Na **početnoj strani** korisnik bira jednu od tri vrste albuma.
2. Otvara se **editor (workbook)** sa uvek tačno **30 strana**, iste za
   svaku temu:
   - strana 1 i strana 30 su **korice**, izdvojene, formata **B4**, i
     prikazuju se svaka samostalno,
   - strane 2–29 (28 strana) su formata **A4** i uvek se prikazuju **po
     dve odjednom** (razvod, kao pravi album) — 14 razvoda ukupno,
   - editor se pri otvaranju uvek prvo postavlja na prednju koricu, a
     dalje se kreće kroz razvode strelicama `‹ ›` ili klikom na
     minijaturu u levoj traci,
   - **tema (pozadina)** se bira jednom i primenjuje odjednom na svih 30
     strana (**ograničeno na 3 teme**: Krem, Bela, Pastel),
   - dodavanje fotografija (upload sa uređaja) — pomeranje i promena
     veličine prevlačenjem miša/prsta,
   - dodavanje teksta — pomeranje, promena veličine, boje, stila
     (podebljano/kurziv, poravnanje) i fonta (**ograničeno na 3 fonta**:
     Elegantan, Moderan, Rukopisni),
   - dupli klik na tekst za direktno uređivanje sadržaja.
3. Rad se automatski čuva u pregledaču (localStorage) po tipu albuma.
4. Dugme **„Izvezi u PDF”** generiše gotov album za štampu — tačno 30
   PDF strana, korice u B4 formatu, unutrašnje strane u A4 formatu.

## Kako pokrenuti

1. Otvori folder u Visual Studio Code-u.
2. U terminalu:

   ```
   npm install
   npm run dev
   ```

3. Otvori http://localhost:3000 u pregledaču.

## Struktura

- `app/page.js` – početna strana (izbor tipa albuma)
- `app/editor/[type]/page.js` – ruta editora za izabrani tip albuma
- `components/Editor.js` – editor albuma (strane, pozadine, elementi, PDF izvoz)
- `components/Editor.module.css` – stilovi editora
- `lib/albumConfig.js` – tipovi albuma, dostupne pozadine i fontovi
- `lib/storage.js` – čuvanje albuma u localStorage
- `app/layout.js` – osnovni layout i učitavanje 3 fonta
- `app/globals.css` – globalni stilovi i stilovi početne strane
- `public/` – slike i statički fajlovi
