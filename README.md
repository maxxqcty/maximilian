# Maximilian Axel Enolpe — Portfolio

A single-page portfolio: plain HTML, CSS and JavaScript, with no build step and no dependencies other than Google Fonts.

## Run it

Double-click `index.html`, or serve the folder so it behaves like the live site:

```sh
npx serve .            # or: python -m http.server
```

## Structure

```
index.html                     page markup only: content lives here
assets/
  css/
    tokens.css                 colours, fonts, type scale, spacing, light + dark themes
    base.css                   reset, body, utilities (.wrap .mono .label), GitHub/LinkedIn icon buttons, reduced-motion
    layout.css                 drafting grid, section spacing, headings, scroll reveal, footer
    components/
      background.css           animated background canvas, radial theme-switch reveal
      header.css               sticky bar, nav, profile icons, theme toggle
      hero.css                 role line, name, statement, buttons, stats row, portrait cutout
      work.css                 project rows, phone thumbnails, floating preview card
      profile.css              bio and stack chips
      languages.css            language share bars
      record.css               education / activities / certificates lists
      media.css                "Off the clock": favourite films (posters) and music (covers)
      contact.css              headline, message form, details panel (email + copy, profiles, local time), toast
      hud.css                  cursor coordinates, scroll ruler (hides the native scrollbar)
      cursor.css               liquid cursor
  js/
    theme.js                   restores saved theme before paint; toggle reveals the new theme as a circle (loads in <head>)
    core.js                    window.MAE: pointer state, theme colours, one shared animation loop
    modules/
      grid.js                  repeats the grid columns out to the window edges
      background.js            drafting layer: column pulses, compass arcs, marks, node graph, notation
      clock.js                 Dumaguete time in the contact panel
      hero-name.js             letters thicken near the cursor
      portrait.js              photo / disc parallax
      hero-stats.js            hero figures count up on load
      hud.js                   cursor coordinates
      scroll-ruler.js          measuring-rail scrollbar (ticks, needle, click/drag) and section headings that ride
                               the rail and flip into a pile at the top (tuning constants at the top)
      project-art.js           animated canvas drawing for each project
      work.js                  preview card + thumbnails
      languages.js             hover tooltip on the language bars
      contact.js               magnetic Send button, message form validation, copy email, toast
      reveal.js                slide-up as sections enter
      cursor.js                liquid blob cursor (tuning constants at the top)
    main.js                    starts the loop (loads last)
  images/
    portrait/portrait-600.webp, portrait-1000.webp   transparent cutout, responsive sizes
    icons/favicon.svg
source/                        originals, not loaded by the site; do not deploy
  documents/resume.pdf
  photos/profile-original.png             first studio photo (grey background)
  photos/profile-black-background.png     updated photo (black background)
  photos/profile-transparent.png          updated photo, background removed, full size
```

### How the JavaScript fits together

`core.js` creates `window.MAE` with shared helpers (`$`, `$$`), the pointer position, cached theme colours and `onFrame(fn)`. Each file in `modules/` is a self-contained IIFE that looks up its own elements, exits quietly if they are missing, and registers with `onFrame` if it animates. `main.js` calls `MAE.start()`, so the whole page runs on one `requestAnimationFrame` loop.

They are plain `defer` scripts rather than ES modules because ES modules are blocked when the page is opened from disk with `file://`.

## Common edits

**Add a project.** Copy a `<li class="row">` in `index.html` and set:
- `href`: repo or demo link
- `data-art`: which drawing to show (`seats`, `papers`, `bst`, `avl`, `table`), or add a new function to `art` in `assets/js/modules/project-art.js`
- `data-caption`: text on the preview card
- `data-cursor`: label on the cursor blob, e.g. `Code ↗` or `Demo ↗`

**Update the language figures.** The numbers in the Languages section are a snapshot. To refresh them, sum `gh api repos/maxxqcty/<repo>/languages` over your non-fork repos, keep the programming languages, and set each row's percentage text, `--share`, `data-bytes` and `data-repos`. Each language and tool has an inline logo from [Simple Icons](https://simpleicons.org) (CC0): for a new one, copy the `<path d>` from `https://cdn.jsdelivr.net/npm/simple-icons/icons/<slug>.svg` into an `<svg class="lang-icon">` (rows) or `<svg class="tool-icon">` (chips).

**Change colours or fonts.** Edit `assets/css/tokens.css` only. Both themes are defined there.

**Replace the portrait.** Export a square PNG with a transparent background, then make the two web sizes:

```sh
python -c "from PIL import Image; im=Image.open('source/photos/profile-transparent.png').convert('RGBA'); [im.resize((w,w), Image.LANCZOS).save(f'assets/images/portrait/portrait-{w}.webp', quality=88, method=6) for w in (600,1000)]"
```

**Update films and music.** The "Off the clock" section in `index.html` is hand-picked. For each card, set the title, the meta line (`Year · Director` or `Artist · Year`) and `href` (the Letterboxd film page or Spotify album page). To add artwork, save it in `assets/images/media/` as `.webp` (posters 2:3, e.g. 400×600; covers 1:1, e.g. 500×500) and put an `<img src="…" width="…" height="…" alt="" loading="lazy">` inside `.media-art`. Without an image the card shows its title as type. Also replace `LETTERBOXD_USERNAME` and the Spotify profile link in the two group headers.

**Connect the message form.** The form in the Contact section validates input but does not send anything yet. To deliver messages, replace `sendMessage()` in `assets/js/modules/contact.js` with a request to a form service (for example a `fetch()` POST to Web3Forms or Formspree) that resolves when the message is accepted. Until then, submitting a valid form tells the visitor to email the address shown instead.

**Tune the cursor.** Constants at the top of `assets/js/modules/cursor.js`: blob sizes per state, tail length, spring and damping, tether distance, magnet strength.
