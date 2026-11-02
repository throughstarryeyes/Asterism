# Asterism Writing: Your Writing Constellation

A writing app built by a writer, for writers. Write your story, keep track of everything in it, and see how it fits together, all on your own device.

- **Private.** No accounts, no analytics, no tracking. Nothing you write is sent to us, ever.
- **Offline.** Everything works without a connection. Syncing is optional and off until you turn it on.
- **Free.** Every writing tool is free and always will be. Quill Points, our gamified motivation system, buy only looks, sounds and keepsakes, and are only ever earned by writing; never by purchasing!
- **Not generative AI.** The analyzer and coach run on your device. Nothing is scraped, connected to the internet or used to train anything. You teach it what matters.

<!-- screenshots go here -->

## Install

### On the web

Open it at **[add your site address here]**. You can install it from your browser's menu ("Install app" or "Add to Home screen") and it will work offline.

### On Windows

1. Download the latest `Asterism_x.y.z_x64-setup.exe` from **[add your releases page here]**.
2. Run it. Windows may say "Windows protected your PC" because the installer isn't signed yet. Click **More info**, then **Run anyway**.
3. Follow the installer. Asterism appears in your Start menu.

Your writing is stored on your computer. Use **Back up and restore** from the menu to save it to a file.

### Run it yourself

You need [Node.js](https://nodejs.org) 20.19 or newer.

```
npm install
npm run dev        # opens at http://localhost:5173
npm run dev:fast   # the same, with React's faster production build. This is how the app really feels on a long chapter.
npm test           # runs the tests
npm run build      # makes the web version in dist/
```

To build the Windows app you also need [Rust](https://rustup.rs) and the Tauri prerequisites for Windows (see the [Tauri guide](https://tauri.app/start/prerequisites/)):

```
npx tauri build --bundles nsis
```

## What's inside

### Writing
- Write in chapters, with scenes inside them, or in one flowing open draft.
- Fonts, sizes, colors, highlights, alignment, spacing, lists, and scene breaks.
- Find and replace, word counts, autosave, and recovery after a crash.
- Zen mode for distraction-free writing.
- Version history with comparisons, and a safety copy taken before anything risky.
- Folders, tags, search, pinned documents, and a recently deleted shelf.
- Sprints: a timed write with a word target. Finished sprints are kept with their document.

### Keeping track of your story
- **Story Bible:** characters, places and lore, with aliases and relationships.
- **Threads:** track plot lines you've opened, and which are still waiting for an ending.
- **Timeline** and **Map** (a mind map) for events and ideas.
- **Cards:** reflective prompt cards you answer privately, and decks of your own.
- **Notes:** comments anchored to your text.
- **Palettes:** colors for a story or a character.
- **Branching stories:** interactive fiction your readers click through.

### Helpers (all offline, none of it generative AI)
- **Analyzer:** looks for loose threads, continuity slips, pacing, and underdeveloped material. It only suggests things to look at, with the evidence it found. You're the authority, so you can mark any finding as intentional or wrong, and it learns from that.
- **Coach:** answers questions about your draft from what you've taught it.
- **Prompt Lab:** prompts, character starters, scene starters and random sparks.
- **Goals and challenges:** daily and seasonal, never punishing. You can pause or skip any of them.

### Making it look like yours
- Themes, with the option for a document to wear its own.
- **Customize:** hide any card on the home screen or any button on the top bar.
- A **Book preview** that typesets your story with a cover, title page and chapter openings.
- **The Shop** (spend Quill Points): themes, fonts, page textures, margin decorations, covers, scene breaks, cursors and trails, keystroke sounds, soundscapes, chimes, loaders and more. Many have a workshop where you can make your own.

### Getting your work out
- Word (`.docx`), e-book (`.epub`), web page (`.html`), Markdown (`.md`), and Print / Save to PDF with your fonts embedded.
- A complete project file (`.json`) with everything, including your notes and story memory, so you're never locked in.

## Sync and backups

Nothing syncs unless you turn it on. Your options:
- **Another device**, straight to it, or through a folder you choose.
- **Your own server.** A small reference server is in [`server/`](server/README.md).
- **Your own Google Drive.** Saved in a hidden folder only Asterism can open. This needs a Google client ID in the build; see `.env.example`.
- **A backup file** from Back up and restore, any time.

Sync never touches the cosmetics you've bought or the sounds you've made unless the place you sync to can carry them. Google Drive carries your writing only.

## Write together

Two or more people can type in the same chapters at the same time and see each other's cursors. One person hosts from their own computer and the others join with the host's address and a password:

1. In the desktop app, the host presses **Start relay** and the app runs the relay on their computer. To reach people outside the home network, **Share over the internet** runs your own `cloudflared` (if it is installed) in front of it. In the browser, a page can't start programs, so run it by hand: `node server/session-relay.mjs` (it prints a host key), and point your own tunnel at it if you need to, for example `cloudflared tunnel --url http://localhost:8788`.
2. In Asterism, open a document, then **More**, then **Collaborate**, then **Start session**. Invite a writer or a reader. Each invite is a four-word password that works once.
3. Guests open **Collaborate** (on the home page or the **More** menu), then type the host's address and the password.

If a guest's connection drops they get back in on their own and anything written meanwhile is merged; it works the same on a very long manuscript.

A guest gets one copy of a shared document. Joining it again later brings that same copy up to date with a three-way merge: what you wrote on your own and what the host wrote meanwhile are both kept, and your changes are put into the live document for everyone. Where you both changed the same paragraph, the host's version is kept and yours is saved in the copy's version history first. Chapters you added on your own stay in your copy.

You can be in several sessions at once, one per document. Host one document while joined to someone else's, or host several, and switch between them freely: text that arrives for a document you aren't looking at is saved to it, and the Collaborate window lists every session.

Everyone keeps their own theme, tools and story bible. The text, chapter titles and comments are shared, and a guest gets their own copy of the document in their library. Everything that crosses the relay is scrambled with the invite password. See [`server/`](server/README.md).

## Privacy

We do not collect your data. At all. The full statement is in the app under **Privacy**.

Live sessions work like hosting a game server yourself: the host runs a small relay on their own computer (see [`server/`](server/README.md)), guests join it with a password, and everything that crosses it is scrambled with that password. No one else hosts anything for you.

## Help and feedback

**[add where to report bugs and ask questions]**

## License

Copyright 2026 Asterism Writing.

Asterism is free software under the GNU General Public License, version 3 or later (see [`LICENSE`](LICENSE)). You can use it, change it and share it. If you share a changed version, it has to stay under the same license, with its source available.

## Credits

Made by a writer, for writers. The bundled fonts, the two typewriter sounds and the libraries Asterism is built on are credited in [`NOTICES.md`](NOTICES.md), and in the app under Privacy, then Credits.
