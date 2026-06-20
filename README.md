# Gravel

I got really tired of bloated note-taking apps. I love Obsidian, but sometimes I just want to open a browser tab, start typing immediately, and not worry about signing up, downloading an electron app, or dealing with popups. 

So I built **Gravel**. 

It’s an entirely browser-based markdown editor. It’s heavily inspired by Photopea - you just open the site, and the editor is right there. No BS. 

Everything you type is saved locally in your browser. Zero data leaves your computer (later will add login and saving data if the user wants too). It’s fast, private, and works offline.

## Why "Gravel"?
It's just meant to be a solid foundation for your notes. Plus, I like the dark aesthetic. 

## Features
- **Zero-Setup:** Tabbed, dual-pane markdown editor right in the browser.
- **100% Local & Offline:** Works fully offline (it's a PWA using IndexedDB). Once you load it, you can turn off Wi-Fi and it still works. You can install it as a desktop app too.
- **Custom Undo/Redo:** The native `Ctrl+Z` in React usually deletes huge chunks of text. I wrote a custom engine that tracks when you pause typing (500ms) so undo/redo actually makes sense.
- **Backups:** Auto-saves a snapshot every 60 seconds in the background. If you mess up, check `Edit -> Version History` to restore an older version.
- **Exports:** Dumps notes to `.md`, `.txt`, `.html`, or `.pdf` (Note: `.pdf` export is currently not working).

## Tech Stack
Kept it minimal.
- **React + Vite:** Core framework.
- **IndexedDB:** Because `localStorage` blocks the main thread and is too small.
- **Vanilla CSS:** No Tailwind bloat. Just raw CSS.
- **Vite PWA Plugin:** For service workers and offline caching.

## Under the Hood
Building a front-end only app with no database had some interesting challenges:

- **Custom Undo:** React messes up the native `Ctrl+Z` in textareas. I fixed this by tracking 500ms pauses in typing, so hitting undo steps back word-by-word instead of clearing the whole page.
- **Tab Memory:** Usually switching tabs in React destroys your undo history. Gravel renders all open notes in the DOM at the same time and just hides inactive ones with CSS, which keeps the undo stack alive for every tab.
- **Safety Net:** A background timer diffs your text every 60 seconds. If it changed, it saves a snapshot to a separate IndexedDB store, keeping the last 10 versions and pruning the rest so storage doesn't get bloated.

## Future Plans
- **Optional Cloud Sync:** It's local-first right now, but I might add an optional sign-in later for people who actually want their notes synced to a database.
- **Customization:** A settings panel to swap out fonts and tweak the exact colors of the dark theme.

## How to run it locally
If you want to poke around the code:

1. Clone the repo
2. `npm install`
3. `npm run dev`

To build the production static files:
`npm run build`

That's pretty much it. Feel free to use it, break it, or fork it. 
