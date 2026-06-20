# Gravel Frontend

This directory contains the React application for Gravel. It is a 100% front-end only, PWA-enabled markdown editor with local storage.

## Tech Stack
- **Framework:** React 19 + Vite
- **Styling:** Vanilla CSS (no CSS frameworks)
- **Local Storage:** `localforage` (IndexedDB wrapper)
- **Markdown:** `react-markdown` + `remark-gfm`
- **PWA Integration:** `vite-plugin-pwa`
- **Exports:** `html2pdf.js` for PDF generation, native browser Blobs for `.md`, `.txt`, and `.html`.

## Getting Started

### Prerequisites
Make sure you have Node.js installed.

### Installation
```bash
npm install
```

### Development Server
Run the local Vite dev server:
```bash
npm run dev
```

### Production Build
To compile the TypeScript and build the optimized production bundle (which also generates the PWA Service Worker):
```bash
npm run build
```

## Project Structure
- `src/App.tsx`: Main application orchestration, layout rendering, and auto-save timers.
- `src/lib/storage.ts`: IndexedDB wrappers for handling standard note saves and the 60-second version history snapshots.
- `src/components/Editor.tsx`: The uncontrolled text area component featuring the custom 500ms-debounce logical Undo/Redo engine.
- `src/index.css`: The central stylesheet containing all variables, dark mode colors, and layout rules.
