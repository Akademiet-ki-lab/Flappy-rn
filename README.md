# Ørneflukt

Et Flappy Bird-inspirert spill der en norsk havørn flyr gjennom snødekt granskog. Spillet kjører i nettleseren (laget for Google Chrome) og trenger ingen installasjon.

## Slik spiller du

- Trykk, klikk eller bruk mellomrom (også pil opp eller W) for å flakse.
- Fly mellom grantrærne som vokser opp fra bakken og ned fra oven.
- Treffer du et tre, faller ørnen ned i snøen og spillet er over. Da kan du spille på nytt eller dele scoren din.
- Maks score er 100. Når du klarer det, flyr ørnen langt ut i vinteren, og du får meldingen «WOW, du er veldig flink! Men klarer du det igjen?».

Rekorden din lagres i nettleseren (localStorage).

## Slik kjører du det

1. Last ned mappen med filene under.
2. Åpne `index.html` i Chrome (dobbeltklikk, eller dra filen inn i et nettleservindu).

Filene må ligge i samme mappe.

| Fil          | Innhold                                        |
| ------------ | ---------------------------------------------- |
| `index.html` | Sidens struktur og panelene for start og slutt |
| `style.css`  | Farger, typografi og layout                    |
| `script.js`  | Hele spillet: fysikk, tegning og logikk        |

Skrifttypene (Fjalla One og Nunito Sans) hentes fra Google Fonts, så du trenger nett første gang. Uten nett brukes reserveskrifter, og spillet fungerer likevel.

## Del spillet

- **Send mappen** som zip, så kan mottakeren åpne `index.html`.
- **Legg det på nett** ved å laste opp de tre filene til en gratis tjeneste som GitHub Pages, Netlify eller Cloudflare Pages. Da får du en lenke du kan sende.

Knappen «Del score» kopierer en ferdig tekst til utklippstavlen. Hvis nettleseren ikke tillater kopiering (kan skje når filen åpnes direkte fra disk), vises teksten i et felt du kan merke og kopiere selv.

## Juster vanskelighetsgraden

Øverst i `script.js` ligger konstantene som styrer spillet:

| Konstant              | Standard  | Betydning                                    |
| --------------------- | --------- | -------------------------------------------- |
| `GAP_MIN` / `GAP_MAX` | 126 / 146 | Høyden på åpningen mellom topp- og bunntreet |
| `SPACING`             | 215       | Avstand mellom trærne sideveis               |
| `GRAV`                | 0.38      | Tyngdekraft                                  |
| `FLAP`                | -6.9      | Kraften i hvert vingeslag                    |
| `GOAL`                | 100       | Antall trær du må passere for å vinne        |

Hvor mye høyden på åpningen kan hoppe fra ett tre til neste, styres av tallet 230 i funksjonen `makeTree`. Farten øker i trinn: for hver 20. tre (20, 40, 60, 80) går ørnen raskere (`STEP_EVERY` og `STEP_BOOST`, startfart `BASE_SPEED`). Se `updatePlay`.

Fargene ligger som variabler øverst i `style.css`, og spillet leser dem derfra.

## Teknisk

Ren HTML, CSS og JavaScript med Canvas. Ingen biblioteker og ingen byggesteg. Spillet skalerer til skjermen og fungerer med mus, tastatur og berøring.

Lykke til med spillingen!
