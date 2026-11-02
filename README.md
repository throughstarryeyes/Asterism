# Asterism Writing: Your Writing Constellation

A writing app built by a writer, for writers. Write your story, keep track of everything in it, and see how it fits together, all on your own device.

- **Private.** No accounts, no analytics, no tracking. Nothing you write is sent to us, ever.
- **Offline.** Everything works without an internet connection. Syncing is optional and off until you turn it on.
- **Free.** Every writing tool is free and always will be. Quill Points, our gamified motivation system, can only be earned by writing and spent on cosmetics: never by purchasing.
- **Not generative AI.** The analyzer and coach run on your device. Nothing is scraped, connected to the internet, or used to train anything. You teach them what matters.

<!-- screenshots go here -->

## Install

### Windows

1. Download the latest Windows installer from the [Asterism Releases page](ADD_RELEASES_URL).
2. Run `Asterism_x.y.z_x64-setup.exe`.
3. Windows may display a warning because the installer is not code-signed yet. If you trust the download, select **More info**, then **Run anyway**.
4. Follow the installer. Asterism will appear in your Start menu.

Your writing is stored on your computer. Use **Back up and restore** from the menu to save a backup file.

### Android

Asterism for Android is currently distributed as a sideloaded APK.

1. Download the latest APK from the [Asterism Releases page](ADD_RELEASES_URL).
2. Open the downloaded APK on your device.
3. If Android asks for permission to install apps from that source, allow it and continue with the installation.

Your writing stays on your device. Keep regular backups using **Back up and restore**.

### In the browser

The browser build is available for developers and testing. It works, but it is **not recommended for keeping your primary writing library**.

Browser storage can be cleared by the browser or the user, and there is currently no Asterism-hosted cloud service to protect your work. There is also no Google Sync in browser or Android App. Until that changes, use the desktop app for everyday writing.
If you'd like to be added to the Google Drive sync testers list, send me an email here: asterismwriting@gmail.com

There is also an extension in very early development that will be available in a separate repo! (LINK HERE)

## What's inside

### Writing

- Write in chapters, with scenes inside them, or in one flowing open draft.
- Fonts, sizes, colors, highlights, alignment, spacing, lists, and scene breaks.
- Find and replace, word counts, autosave, and recovery after a crash.
- Zen mode for distraction-free writing.
- Version history with comparisons, and a safety copy taken before anything risky.
- Folders, tags, search, pinned documents, and a recently deleted shelf.
- Sprints: timed writing sessions with a word target. Finished sprints are kept with their document.

### Keeping track of your story

- **Story Bible:** Characters, places, and lore, with aliases and relationships.
- **Threads:** Track plot lines you've opened and which are still waiting for an ending.
- **Timeline and Map:** Organize events and ideas visually.
- **Cards:** Private reflective prompt cards, with the option to create your own decks.
- **Notes:** Comments anchored to your text.
- **Palettes:** Colors for a story or a character.
- **Branching stories:** Interactive fiction your readers can click through.

### Helpers (all offline, none of it generative AI)

- **Analyzer:** Looks for loose threads, continuity slips, pacing, and underdeveloped material. It suggests things to look at and shows its evidence. You're the authority: you can mark findings as intentional or incorrect, and it learns from your feedback.
- **Coach:** Answers questions about your draft using what you've taught it.
- **Prompt Lab:** Prompts, character starters, scene starters, and random sparks.
- **Goals and challenges:** Daily and seasonal goals that never punish you. You can pause or skip any of them.

### Making it look like yours

- Themes, with the option for individual documents to have their own.
- **Customize:** Hide any card on the home screen or any button on the top bar.
- **Book preview:** Typeset your story with a cover, title page, and chapter openings.
- **The Shop:** Spend Quill Points on themes, fonts, page textures, margin decorations, covers, scene breaks, cursors and trails, keystroke sounds, soundscapes, chimes, loaders, and more. Many items have a workshop where you can make your own.

### Getting your work out

Export your writing as:

- Word (`.docx`)
- E-book (`.epub`)
- Web page (`.html`)
- Markdown (`.md`)
- Print / Save to PDF, with your fonts embedded
- Complete project file (`.json`), including notes and story memory, so you're never locked in

## Sync and backups

Nothing syncs unless you turn it on. Asterism does not currently provide its own hosted cloud service. Your options include:

- **Another device:** Sync directly to another device or through a folder you choose.
- **Your own server:** A small reference server is included in [`server/`](server/README.md).
- **Your own Google Drive:** Save to a hidden folder that only Asterism can open. This requires a Google client ID in the build; see `.env.example`.
- **A backup file:** Use **Back up and restore** whenever you like.

Sync never touches the cosmetics you've bought or the sounds you've made unless the destination can carry them. Google Drive carries your writing only.

## Write together

Two or more people can type in the same chapters at the same time and see each other's cursors. One person hosts from their own computer, and the others join using the host's address and a password.

1. In the desktop app, the host presses **Start relay**. Asterism runs the relay on their computer. To reach people outside the home network, **Share over the internet** runs your own `cloudflared` (if installed) in front of it. In the browser, a page can't start programs, so run the relay manually with `node server/session-relay.mjs`. It prints a host key. Point your own tunnel at it if needed, for example: `cloudflared tunnel --url http://localhost:8788`.
2. In Asterism, open a document, then go to **More → Collaborate → Start session**. Invite a writer or a reader. Each invite is a four-word password that works once.
3. Guests open **Collaborate** from the home page or the **More** menu, then enter the host's address and password.

If a guest's connection drops, they can reconnect automatically. Anything written in the meantime is merged, even on a very long manuscript.

Each guest gets their own copy of a shared document. Joining again later brings that copy up to date with a three-way merge: changes made independently by the guest and host are both preserved. The guest's changes are added to the live document for everyone. If both people changed the same paragraph, the host's version stays in the live document, and the guest's version is saved in the copy's version history first. Chapters added independently by the guest stay in their copy.

You can participate in several sessions at once, one per document. Host one document while joining someone else's, host several, and switch between them freely. Text arriving for a document you're not currently viewing is still saved, and the Collaborate window lists every session.

Everyone keeps their own theme, tools, and Story Bible. Text, chapter titles, and comments are shared. Guests also get their own copy of the document in their library.

Everything sent through the relay is scrambled using the invite password. See [`server/`](server/README.md) for details.

## Privacy

We do not collect your data. At all.

The full privacy statement is available in the app under **Privacy**.

Live sessions work like hosting a game server yourself: the host runs a small relay on their own computer, and guests connect with a password. No one else hosts anything for you. Everything that crosses the relay is scrambled using that password.

## Help and feedback

Found a bug, have a question, or want to suggest something?

[Report a bug or ask a question](ADD_SUPPORT_URL).

## Run it yourself

The browser version can be run locally by developers.

You need [Node.js](https://nodejs.org/) 20.19 or newer.

```bash
npm install
npm run dev        # Opens at http://localhost:5173
npm run dev:fast   # Same app, using React's faster production build
npm test           # Runs the tests
npm run build      # Builds the browser version in dist/
```

To build the Windows app, you also need [Rust](https://rustup.rs/) and the [Tauri prerequisites for Windows](https://tauri.app/start/prerequisites/).

```bash
npx tauri build --bundles nsis
```

## License

Copyright 2026 Asterism Writing.

Asterism is free software under the GNU General Public License, version 3 or later (see [`LICENSE`](LICENSE)). You can use it, change it, and share it. If you share a changed version, it must remain under the same license, with its source available.

## Credits

Made by a writer, for writers.

The bundled fonts, the two typewriter sounds, and the libraries Asterism is built on are credited in [`NOTICES.md`](NOTICES.md) and in the app under **Privacy → Credits**.