**ANTIGRAM**  
*Your Instagram. Finally yours.*

Implementation plan, tribunal arguments, and manifesto

Project owner: **Julian Marcone**     Date: **May 2026**     Version: **v2 (updated)**

*Changes since v1: license switched from AGPL-3.0 to MIT (project owner does not want commercial protection). Added full implementation details section: budget reality (0-100 EUR/year), free hosting strategy, long-term stability risks, things-not-to-do list, and a concrete 5-day alpha plan with hour-by-hour breakdowns.*

# **The Manifesto**

Right now, if you are a business, Meta gives you a powerful API. You can pull data, push posts, schedule content, analyze engagement. You are a customer; they treat you like one.

If you are a person, the one who actually took the photos, wrote the captions, lived the moments, you get a form. You fill it out, wait 24 to 48 hours, and Meta emails you a ZIP file of compressed JPEGs and JSON nobody can read. That is your access to your own life.

That asymmetry is not an accident. It is a business decision. Your photos are more useful to Meta if you cannot actually use them yourself.

*Instagram already restricted YOU from having access to YOUR personal pictures, while businesses can do whatever the fuck they want. You should be able to take YOUR pictures, YOUR captions, and the comments YOUR people wrote you, and OWN them, store them, distribute them. They are YOUR pictures. Currently they are Meta's, and you have barely a shitty read-only access to your own assets.*

Antigram exists because they are not Meta's photos. They are yours.

# **What Antigram is**

A free, open-source, local-only desktop tool that takes the data export Meta is legally required to give you and turns it into something you actually own:

* Your photos, organized by year and month, as real files on your disk

* Your captions, embedded into each photo's metadata

* The comments your people wrote you, preserved next to each photo

* The locations, the timestamps, the carousel groupings, the device used to shoot it — all the things Meta strips out when you scroll

* Optionally, upscaled to higher resolution because Meta compressed your photos and you should not have to live with that

  What you get is a folder. It works in Apple Photos. It works in Google Photos. It works in Immich, in PixelFed, in Nextcloud, on a hard drive, on a USB stick mailed to your mom. It works anywhere, because it is just files, and you own them.

  **Free forever. Open source. Local only. Your photos never touch a server we run, because there is no server.**


  # **The name**

  **Antigram.** The *anti-* prefix is doing real work here. It is not Instagram-without-the-bad-parts. It is the opposite of Instagram: where Instagram hoards, Antigram returns. Where Instagram compresses, Antigram restores. Where Instagram restricts, Antigram unlocks. The name announces the politics at a glance.

  It is also a suite name. If this works, the same engine handles Antibook (Facebook), Antitok (TikTok), Antix (X / Twitter). Same data-export-driven model, same ethos. Antigram is just the first front.


  # **Tribunal: implementation decisions**

  For every meaningful decision, the arguments for and against, then the verdict.

  ## **1\. Distribution: local-first desktop app**

  **Proposal:** Distribute Antigram as a local-first open-source desktop app. No hosted version, ever.

  **FOR**

* Photos never leave the user's machine. Perfect ideological alignment with the manifesto.

* Zero hosting costs forever. Scales to a million users at zero dollars.

* No GDPR or data-processor obligations. We are not a data processor; we never touch the data.

* No risk of being sued because a user uploaded copyrighted celebrity content.

* Donations make sense for free local tools. The model is proven by Upscayl, Signal, Blender, Obsidian.

* If the project dies, the binaries still work. Hosted services die with their servers.

  **AGAINST**

* Cross-platform binary distribution is annoying. Code signing for macOS costs $99/year. Windows SmartScreen warnings for unsigned binaries.

* Users on Chromebooks, iPads, or low-power laptops get nothing.

* Updates require auto-update plumbing.

* Discoverability is harder than a URL.

  **VERDICT  Local-first desktop app. No hosted version, no exceptions.**

  **Why:** *The product IS the privacy promise. A hosted version contradicts the entire pitch. Cross-platform pain is real but bounded. Upscayl proves the model works for exactly this audience.*

  ## **2\. Data source: Meta GDPR export only**

  **Proposal:** Antigram works only with the official Meta Download Your Information ZIP. No scraping, no Graph API, no OAuth.

  **FOR**

* Legal, ethical, sustainable. Meta is legally required to provide this; we just help users use it.

* Does not break when Meta updates anti-scraping defenses.

* Higher-quality source files than scraping in most cases.

* Includes data scrapers cannot get: archived stories, full comment history, exact like and comment counts at export time.

* Strong story: "Meta is legally required to give you this. We help you use it."

  **AGAINST**

* User has to wait 10 minutes to 48 hours after requesting the export before they can use the tool.

* Meta's UX for requesting the export is buried in settings and not obvious.

* ZIPs can be huge (10-50 GB for power users), needs streaming and chunked processing.

* Older Instagram photos in the export are still Instagram-compressed; we cannot magically recover original-upload quality.

  **VERDICT  GDPR export only. Lean into the wait time as part of the ritual.**

  **Why:** *Scraping ages like milk. Graph API requires Business account conversion which most users will not do. The wait is not a bug, it is a story. "Meta is stalling. Pour yourself a coffee. They will email you when ready."*

  ## **3\. Tech stack: Tauri v2 \+ React \+ TypeScript**

  **Proposal:** Tauri v2 (Rust shell, web frontend) with React 19 \+ TypeScript \+ Vite \+ Tailwind v4.

  **FOR**

* Tauri binaries are \~10 MB versus Electron's \~150 MB. Matches the lightness ethos.

* Native performance, lower RAM usage than Electron.

* Rust shell lets us spawn the upscaler binary and do filesystem work fast.

* Tauri v2 in 2026 is production-ready with mature ecosystem.

* Portfolio value: shipping a Tauri app demonstrates a 2026-current stack.

  **AGAINST**

* Rust learning curve, even for the thin shell needed here.

* WebView quirks across operating systems.

* Smaller community than Electron means fewer Stack Overflow answers when things break.

  **VERDICT  Tauri v2. Thin Rust shell, 95% of logic in TypeScript.**

  **Why:** *Shipping a 150 MB Electron app for a tool that is philosophically about lightness and privacy would be embarrassing. The Rust we need is minimal: file I/O, process spawning, maybe EXIF writing. Everything else lives in TypeScript.*

  ## **4\. Upscaling: local-only via bundled Real-ESRGAN**

  **Proposal:** Bundle Real-ESRGAN ncnn-vulkan binaries (same as Upscayl). No cloud upscaling option. Ever.

  **FOR**

* Free forever. No API costs, no donations spent on inference.

* Photos never touch the internet. Privacy is absolute, not aspirational.

* Works offline.

* No vendor lock-in. fal.ai or Replicate could change pricing or shut down; ncnn-vulkan binaries we ship are forever.

* ncnn-vulkan runs on integrated GPUs, even on Mac without dedicated GPU.

* Upscayl proves binary distribution works on all OSes.

  **AGAINST**

* Slow on weak hardware (30 seconds per image on a 5-year-old laptop).

* Binary size adds \~200 MB to the app distribution.

* Need to ship platform-specific binaries for Win, Mac Intel, Mac ARM, and Linux.

* No face restoration without bundling GFPGAN too (more weight).

  **VERDICT  Local-only. No cloud option, ever. Bundle Real-ESRGAN \+ GFPGAN.**

  **Why:** *"Cloud as optional" is a trap. The moment we add it, half the users will use it, we need a backend, donations go to compute, and we are running a business we did not want. Keep the principle pure. A user with weak hardware gets slow upscaling. That is fine, it is still free and theirs.*

  ## **5\. Scope priority: ownership first, upscaling later**

  **Proposal:** MVP delivers metadata-rich, properly-organized photo extraction. Upscaling is a Phase 2 feature.

  **FOR**

* The real product is ownership, not sharpness. Even a user with mediocre phone photos wants their archive back.

* Parsing, metadata embedding, and organization can ship in week 1\. Upscaling adds another 1-2 weeks.

* Lower-risk MVP. Upscaler binary distribution is the hardest part technically.

* Allows shipping something usable to yourself and a small test group fast.

* Aligns with the manifesto: the political point is ownership, not quality.

  **AGAINST**

* "Antigram" without upscaling might feel like just-another-IG-archive-viewer.

* Upscaling is the magic moment in the demo video.

  **VERDICT  Ship ownership in Phase 1\. Add upscaling in Phase 2\.**

  **Why:** *Already owning your pictures is a lot. You can always upscale them later. Shipping the emotional core first is the right call.*

  ## **6\. Metadata: EXIF \+ XMP \+ sidecar JSON**

  **Proposal:** Write EXIF for universal fields (date, GPS, caption), XMP for IG-specific fields, plus a parallel sidecar JSON folder for the rest.

  **FOR**

* EXIF means Apple Photos, Google Photos, Lightroom, Synology Photo Station, Immich all pick up dates and locations natively. The archive "just works" everywhere.

* Sidecar JSON preserves IG-specific data that does not fit in EXIF (comment threads, like counts, carousel relationships, tagged people).

* XMP namespace allows custom fields without breaking standard EXIF readers.

* Parallel sidecar folder keeps the photo folder clean for normal viewing.

  **AGAINST**

* Two files per photo doubles file count.

* Sidecar can be lost during sync or transfer.

  **VERDICT  EXIF \+ XMP embedded \+ parallel \_metadata/ folder.**

  **Why:** *Best of all worlds. Apple Photos sees a normal dated photo with location. A power user can exiftool and find every IG field. The sidecar folder is parallel, not co-located, so the photo folder stays clean.*

  ## **7\. Funding: GitHub Sponsors \+ Ko-fi**

  **Proposal:** Two donation surfaces. GitHub Sponsors for developers, Ko-fi for everyone else. Open Collective added later if monthly donations exceed \~200 EUR.

  **FOR**

* GitHub Sponsors integrates with the repo where developers find it.

* Ko-fi has a friendlier UX for non-developers ("buy me a coffee").

* Both have low fees compared to Patreon (\~12% on Patreon).

* No subscription required. Anti-extraction model matches the ethos.

* Open Collective adds transparency once there is money worth being transparent about.

  **AGAINST**

* Two platforms is two things to maintain.

* Fragmented support across platforms.

* Donations are unpredictable income.

  **VERDICT  GitHub Sponsors \+ Ko-fi. Add Open Collective at \~200 EUR/month.**

  **Why:** *Two surfaces is the right minimum. Skip Patreon (wrong vibe, high fees). Skip Kickstarter (one-shot model, this is perpetual). Donations are gravy, not budget.*

  ## **8\. License: MIT (revised from AGPL-3.0)**

  **Proposal:** Antigram is licensed under MIT. Maximum permissiveness, maximum reach.

  **FOR**

* Anyone can use it, fork it, learn from it, embed parts of it — no legal friction.

* Privacy researchers can cite and reuse code in papers without legal headaches.

* Nonprofits and small projects can build on it freely.

* The political message lives in the README and the manifesto, not in the license.

* Easier to attract contributors. MIT is the most popular OSS license for a reason.

* Project owner explicitly does not want to make money from this. AGPL's main value is defending against commercial wrapping — irrelevant here.

  **AGAINST**

* A sleazy startup could wrap Antigram as a paid SaaS and SEO-spam "Own Your Instagram \- 9 EUR/mo".

* Meta could technically embed code in their tools (they wouldn't, but they could).

* No copyleft means downstream forks can stay closed-source.

  **VERDICT  MIT. Maximum chill, maximum freedom. Political message stays in the README.**

  **Why:** *"Fuck Meta" doesn't mean "prevent anyone from using my code." It means: make the tool exist, in as many hands as possible. The AGPL threat model (scraper-based competitor steals our code) is theoretical and unlikely to matter.*

  ## **9\. Development: public from day one**

  **Proposal:** GitHub public from the first commit. Build in public. README states "in progress, not ready" until v1.0.

  **FOR**

* Builds community before launch.

* Honest with the ethos.

* Aligns with how you already work (Catan Trainer, Archivist).

* "Building in public" drives donations and HN/Reddit attention.

  **AGAINST**

* Half-finished code visible to recruiters.

* Embarrassment factor.

  **VERDICT  Public from day one. README is explicit about status.**

  **Why:** *Your portfolio already lives publicly at github.com/jmarcone. Antigram fits the pattern, and "building in public" is the right move for a community-funded political tool.*


  # **Architecture**

  ## **High-level flow**

  Five stages, all local, all sequential per photo, with parallelism within stages.

* 1\. **Ingest** — user drops the Meta ZIP into Antigram. The app stream-extracts without loading the whole thing into memory.

* 2\. **Parse** — read posts\_1.json, posts\_2.json, etc. Normalize into a typed Post\[\] structure with photos, captions, comments, locations, timestamps.

* 3\. **Gallery** — show the user their archive in a grid. They can browse, search, and select what they want to process.

* 4\. **Process** — for each selected photo: optionally upscale, then embed EXIF/XMP metadata, then write to the output folder in the right year/month bucket.

* 5\. **Reveal** — open the output folder in Finder/Explorer. The user can now drag it into Apple Photos, Immich, anywhere.

  ## **Output structure**

  The folder layout the user gets at the end:

  \~/Pictures/MyInstagram/├── 2014-08/│   ├── 2014-08-23\_142301\_post\_A1B2C3\_1of3.jpg│   ├── 2014-08-23\_142301\_post\_A1B2C3\_2of3.jpg│   ├── 2014-08-23\_142301\_post\_A1B2C3\_3of3.jpg│   └── 2014-08-31\_180022\_post\_X9Y8Z7\_1of1.jpg├── 2014-09/├── ...├── \_metadata/│   ├── 2014-08/│   │   ├── post\_A1B2C3.json     ← caption, likes, comments, location, tagged\_users│   │   └── post\_X9Y8Z7.json│   └── ...└── \_archive\_info.json            ← export date, tool version, photo counts, stats

  ## **Repo structure (monorepo)**

  antigram/├── apps/│   └── desktop/              \# Tauri v2 app│       ├── src/              \# React frontend (TS)│       └── src-tauri/        \# Rust shell (minimal)├── packages/│   ├── parser/               \# Meta ZIP → normalized Post\[\]│   ├── metadata/             \# EXIF/XMP writer│   ├── upscaler/             \# Real-ESRGAN binary wrapper│   ├── organizer/            \# Output folder structure builder│   └── types/                \# Shared TypeScript types├── binaries/                 \# Real-ESRGAN per-platform builds│   ├── win-x64/│   ├── mac-arm64/│   ├── mac-x64/│   └── linux-x64/├── docs/├── README.md├── MANIFESTO.md├── LICENSE                   \# MIT└── pnpm-workspace.yaml

  ## **The Meta export shape (what we parse)**

  The user requests their export from accountscenter.instagram.com, choosing JSON format. They receive a ZIP that looks roughly like:

  your\_instagram\_activity/  content/    posts\_1.json          ← all post metadata    stories.json    reels.json    archived\_posts.json  media/    posts/      202301/             ← organized by year-month        17841234567890123\_0.jpg      ...comments/likes/personal\_information/connections/

  Sample entry from posts\_1.json:

  {  "media": \[{    "uri": "media/posts/202301/17841234567890123\_0.jpg",    "creation\_timestamp": 1673884800,    "media\_metadata": {      "photo\_metadata": {        "exif\_data": \[{          "latitude": 52.520008,          "longitude": 13.404954,          "camera\_make": "Apple",          "camera\_model": "iPhone 14 Pro"        }\]      }    }  }\],  "title": "Sunset over Tempelhof 🌅",  "creation\_timestamp": 1673884800}

  Everything we need is already in there. Caption, GPS, device, timestamps. The job is to put it back into the upscaled file as proper EXIF/XMP, and write the comments to the sidecar.


  # **Roadmap**

  ## **Phase 0 — Setup (Day 0-2)**

* Create GitHub repo github.com/jmarcone/antigram, MIT license

* Scaffold Tauri v2 \+ React 19 \+ TypeScript \+ Vite \+ Tailwind v4

* Write the manifesto README

* Set up GitHub Sponsors profile and Ko-fi page (placeholder until v1.0)

* Request your own Instagram data export from Meta **today** so the 24h timer starts

  ## **Phase 1 — Vertical slice MVP (Day 3-14)**

  Goal: process your own export end-to-end on your own machine. Ship the ownership story.

  ### **Day 3-4 — Parser package**

* Stream-extract ZIP without loading whole file (yauzl or sharp's zip support)

* Parse posts\_\*.json into normalized Post\[\] type

* Resolve media URIs to filesystem paths inside the ZIP

* Write unit tests against your real export

* Output: typed @antigram/parser package, can be used standalone via CLI

  ### **Day 5-7 — Gallery UI**

* Grid view sorted by date, lazy-loaded thumbnails

* Detail view: photo, caption, likes count, comments list, location

* Multi-select with shift-click, "select all in year"

* Caption search

  ### **Day 8-10 — Metadata writer**

* Write EXIF: DateTimeOriginal, GPSLatitude/Longitude, ImageDescription (caption), Make/Model

* Write XMP custom namespace for IG-specific fields

* Write parallel \_metadata/post\_\*.json with full data

* Use sharp \+ piexifjs in Node, or little\_exif in Rust

  ### **Day 11-12 — Organizer**

* Move processed files into year/month folders with date-prefixed filenames

* Generate \_archive\_info.json with stats

* "Reveal in Finder/Explorer" button

  ### **Day 13-14 — Self-test and polish**

* End-to-end test on your own archive

* Verify Apple Photos imports with correct dates and GPS

* Fix the inevitable EXIF quirks

* **Deliverable:** you have your own Instagram in a beautiful folder

  ## **Phase 2 — Upscaling and polish (Day 15-25)**

* Bundle Real-ESRGAN ncnn-vulkan binary for current platform (Mac ARM first)

* Tauri command: photo path in, upscaled path out, progress events back

* Queue manager: parallel processing based on CPU/GPU count

* Bundle GFPGAN for face restoration as a per-photo toggle

* Bundle Real-ESRGAN-anime model for users with illustration content

  ## **Phase 3 — Cross-platform release (Day 26-35)**

* Cross-platform builds: Windows \+ Linux \+ Mac Intel

* Code signing for macOS ($99 Apple developer account)

* Windows: ship unsigned with clear SmartScreen disclaimer in README

* Landing page (single-page, github.io or ownyourinstagram.app domain)

* Demo video: 1 minute of you processing your own archive

* Launch posts: HN, Reddit r/privacy \+ r/degoogle, Mastodon, Lemmy

* Submit to awesome-privacy, awesome-selfhosted lists

* **Deliverable:** public v1.0, GitHub stars rolling in, first donations

  ## **Phase 4 — Community-driven expansion**

* Stories support

* Reels (extraction \+ metadata, no upscaling yet)

* Video upscaling (much harder, defer)

* HTML photobook generator (static site of your archive, captions \+ comments \+ map)

* Print-ready PDF photobook

* Facebook export support (Antibook — same engine, mostly same format)

* Tagged-people preservation

  ## **Stretch goals**

* "On this day" view: random photo from this day in past years

* Map view of all geotagged photos

* Direct import-ready export for PixelFed, Immich, Nextcloud

* Torrent of your own archive for self-seeding across your machines (mostly symbolic, deeply on-brand)

* Antitok, Antix — extend the suite as data export formats are reverse-engineered


  # **Risk register**

| Risk | Likelihood | Impact | Mitigation |
| :---- | :---- | :---- | :---- |
| Meta changes export format | Medium | High | Parser is the most-likely-to-break component. Add format-version detection and graceful fallback. Users can submit their broken exports as test cases. |
| Meta sends cease-and-desist over the name | Low | Medium | "Antigram" does not use the Instagram trademark directly. Tagline references Instagram descriptively, not in the product name. |
| Real-ESRGAN binary breaks on macOS notarization | Medium | Medium | Test notarization early. Fallback: runtime download of binaries from a GitHub release. |
| Nobody donates | High | Low | Don't depend on it. Treat any donation as a gift. The project costs nothing to run. |
| Niche is too small | Low | Low | Audience is people leaving Instagram \+ privacy nerds \+ photo lovers. Growing, not shrinking. |
| Julian gets hired full-time and loses momentum | High | Medium | Ship MVP fast. The rest can be slow. Community contributions accelerate. |
| Meta retaliates against users who request exports | Very Low | Low | GDPR exports are a legal right. Meta cannot retaliate without violating EU law. |


  # **Draft README for the repo**

  This is the opening of the public README — the first thing visitors see on GitHub. Tone is deliberately political, manifesto-first, tech-second.

  **\# Antigram**

  *Your Instagram. Finally yours.*

  **Meta has your photos. This gives them back.**

  Right now, if you're a business, Meta gives you a powerful API. You can pull data, push posts, schedule content, analyze engagement. You're a customer; they treat you like one.

  If you're a person — the one who actually took the photos, wrote the captions, lived the moments — you get a form. You fill it out, wait 24 to 48 hours, and Meta emails you a ZIP file of compressed JPEGs and JSON nobody can read. That's your "access" to your own life.

  That asymmetry isn't an accident. It's a business decision. Your photos are more useful to Meta if you can't actually use them yourself.

  **Antigram exists because they're not Meta's photos. They're yours.**

  **What it does**

  Takes the data export Meta is legally required to give you and turns it into:

  **—** your photos, organized by date, as files you actually own

  **—** your captions, embedded into the photo metadata

  **—** the comments your people wrote you, preserved alongside each photo

  **—** the locations, timestamps, carousel groupings, the things Meta strips out when you view them

  **—** optionally: upscaled, because Meta compressed them and there's no reason you should have to live with that

  What you get is a folder. It works in Apple Photos, Google Photos, Immich, PixelFed, Nextcloud, on a hard drive, in an email to your mom. It works anywhere, because it's just files, and you own them.

  **Free forever. Open source. Local only. Your photos never touch a server we run, because there isn't one.**

  *Made with rage and love by Julian Marcone.*

  *Donations accepted but never required. Forks encouraged.*


  # **Launch strategy**

  ## **When to launch**

  Launch at v1.0 when:

* Tool works end-to-end on Mac ARM \+ Windows \+ one Linux distro

* Your own Instagram archive has been processed and you've used the output for at least a week

* README is polished, manifesto is sharp, demo video exists

* At least 2 trusted friends have run it on their own exports without help

  ## **Where to launch (in order)**

* 1\. **Personal Mastodon \+ LinkedIn** — soft launch, friends and immediate network. Get feedback before going wider.

* 2\. **Hacker News (Show HN)** — title "Show HN: Antigram – take your Instagram photos back from Meta." Submit on a Tuesday/Wednesday morning EU time for SF audience overlap.

* 3\. **Reddit** — r/privacy, r/degoogle, r/selfhosted, r/opensource, r/dataisbeautiful (for the metadata viz angle).

* 4\. **Lemmy** — the federated Reddit alternative, the audience is exactly aligned with the project's ethos.

* 5\. **Awesome lists** — PRs to awesome-privacy, awesome-selfhosted, awesome-foss.

* 6\. **Privacy newsletters and blogs** — EFF Deeplinks, Restore Privacy, PrivacyTools. Pitch the angle as "GDPR rights, made usable."

* 7\. **Mainstream tech press** — only if HN takes off. The Verge, Ars Technica, 404 Media love the "anti-Meta" framing.

  ## **Launch post template (Hacker News)**

  **Show HN: Antigram — take your Instagram photos back from Meta**

  Hi HN. I built Antigram because Meta's API gives businesses full access to Instagram data, but gives individuals a 48-hour-wait ZIP file of compressed JPEGs and JSON nobody can read. That asymmetry pissed me off enough to spend a few weeks fixing it.

  Antigram is a local-only desktop app (Tauri). You give it the GDPR export ZIP Meta is legally required to provide. It gives you back a folder of properly-organized photos with EXIF dates, GPS, captions embedded, and your comments preserved as sidecars. Optionally upscales via bundled Real-ESRGAN.

  No server. No account. No subscription. MIT licensed. The output drops into Apple Photos, Immich, PixelFed, anywhere.

  Happy to answer questions about the parser, the metadata embedding, or the politics of the GDPR-export approach.


  # **Implementation details: getting it built**

  This section is the practical companion to the tribunal. The tribunal says *what* to build. This section says *how to actually start*, what to be careful about, and what a 5-day alpha plan looks like in concrete terms.

  ## **Budget reality**

  This is one of the cheapest ambitious projects you can build, because of the local-only architecture. No servers, no API costs, no databases.

  ### **One-time costs (optional)**

* Domain: **\~10 EUR/year** for antigram.app or antigram.eu. Skippable. github.io works free.

* Apple Developer account for macOS code signing: **$99/year**. Only annoying recurring cost. Without it, Mac users see "this app cannot be opened" and have to right-click → Open. Ugly but solvable.

* Windows code signing: **$200-400/year** for a real cert. **Skip this.** Tell users to click "More info → Run anyway" past SmartScreen. Every indie OSS project does this.

* Linux: free.

  ### **Recurring costs**

* GitHub: free (public repos, free Actions minutes for builds)

* Cloudflare for DNS \+ caching: free

* Project email (julian@antigram.app): free via Cloudflare Email Routing → forwards to your real inbox

* Newsletter (Buttondown / Substack free tier): free until thousands of subscribers

  ### **Recommendation**

  Year 1 realistic budget if polite to users: **\~100 EUR/year** (domain \+ Apple signing).

  Year 1 purist budget: **0 EUR**. Mac users right-click → Open. Windows users click through SmartScreen. Linux works. README explains it.

  *Project owner has said "I do not need to make a cent".* **Start with the 0 EUR version.** Add Apple signing only if/when warnings become a real friction. Donations through GitHub Sponsors will cover the $99 easily once there is any audience.

  ## **Hosting: everything you need is free**

  Three things need to be online. None require a server.

* 1\. **Code → GitHub**. Free public repo. MIT license file. Issues and discussions are free.

* 2\. **Binaries → GitHub Releases**. When you tag v1.0.0, GitHub Actions builds Mac/Win/Linux binaries automatically and attaches them to the release. Users download from github.com/jmarcone/antigram/releases. Free, unlimited, fast CDN. This is how Upscayl, Obsidian, and thousands of OSS tools distribute.

* 3\. **Landing page → GitHub Pages or Cloudflare Pages**. A single static page explaining the project with a big download button pointing to the latest release. Free. Custom domain optional.

  **That is the entire infrastructure.** There is no server because there is no server-side anything. The app runs on the user's machine.

  Set up GitHub Actions to auto-build and publish releases when you push a tag. Tauri has official templates for this. One-time setup, then you never manually compile for three OSes on your laptop again.

  ## **Long-term stability: what to actually worry about**

  Most "what if" worries about open-source projects are imaginary. Here are the real ones, in order:

  ### **1\. Meta changes the GDPR export format (likelihood: high, eventually)**

  THE risk. Meta has changed the format several times in recent years. When they change it, the parser breaks for everyone on the current version.

  Mitigation:

* Version-detect the export format at parse time. Emit a clear error: "Antigram detected an unfamiliar Meta export version. Please open an issue."

* Build a test-fixtures folder with anonymized sample exports across versions

* Users submitting broken exports become free QA

* A new release every few months is fine; this is not a service that must be always-on

  ### **2\. You lose interest (likelihood: high — happens to most side projects)**

  Mitigation:

* Ship the MVP fast. 14 days. Even if you ghost it after, your past self gave hundreds of people a useful tool.

* Document everything. Future-you or a stranger maintainer needs to be able to pick it up.

* Make individual contributions easy: well-scoped issues, clean code, decent tests. 2-3 contributors changes everything.

* Do not promise features publicly that you might not deliver.

  ### **3\. Maintainer responsibility appears that you cannot ignore (likelihood: medium)**

  Examples: "Antigram corrupted my photos." Security vulnerability report. CVE in dependency tree.

  Mitigation:

* README explicitly states "best effort, no SLA, gift to the community"

* Pin dependencies. Use few of them.

* Tauri and Real-ESRGAN ncnn binaries are well-maintained and stable

* Security issues: respond when you can, fix when you can, no obligation

  ### **4\. Drama from users or community (likelihood: low but real)**

  Weird bug reports. Feature demands. Misinterpreted politics. Annoying forks.

  Mitigation:

* Use the standard Contributor Covenant code of conduct

* Maintainer's prerogative: close issues without explanation. Not everything deserves an answer.

* Pre-write a "non-goals" section in the README: "Antigram will never have a hosted version, require accounts, support business accounts, or integrate analytics."

  ### **5\. Real life happens (likelihood: certain)**

  New job, new city, family, the TTRPG paper takes off. Antigram sits in a drawer.

  Mitigation:

* Ship MVP fast. Treat anything after as gravy.

* If the project gains traction and you cannot maintain it, hand it off explicitly. Do not ghost it — announce a maintainer hand-off or graceful sunset.

  ## **Critical things to be aware of (the "do not do this" list)**

* **Do not start with the UI.** Tempting because it is visible and fun, but if the parser does not work, the UI is meaningless. **Parser first.**

* **Do not over-architect.** No microservices, no event sourcing, no DDD aggregates. This is a single-machine ETL pipeline with a UI on top. Keep it boring.

* **Do not try to support every Instagram feature on day one.** Posts only for MVP. Stories, reels, DMs are Phase 2+.

* **Do not worry about scale.** The bottleneck is the user's GPU, not your code. A user with 50,000 photos lets it run overnight. Fine.

* **Do not gold-plate the README before v0.1 ships.** Functional ugly tool \> beautiful README about a tool that does not exist.

* **Do not promise features in the README that are not built yet.** Worst sin in open source. Describe what currently works, nothing more.

* **Do not add telemetry, ever.** Not even "anonymous usage stats to improve the product." Antigram's entire pitch is that nothing leaves the machine. Breaking that for any reason ruins the project. If you want to know how it is being used, ask in GitHub Discussions.


  # **The 5-day alpha plan**

  Goal: in 5 days of focused work, have a desktop binary that takes your Meta export and produces a properly-organized folder of your own photos with metadata embedded. **Upscaling is NOT in scope for the alpha.** The alpha proves the ownership-restoration loop. Upscaling comes later.

  **Definition of alpha-done:** you can drop your Meta export ZIP into Antigram, click one button, and 5 minutes later have \~/Pictures/MyInstagram/ populated, dated, geotagged, and ready to import into Apple Photos.

  ## **Day 0: prerequisites (do this BEFORE Day 1\)**

  These do not count as one of the 5 days. Do them now.

* Request your Meta export **right now**. Settings → Accounts Center → Your information and permissions → Download your information → JSON format, all content, high quality. Wait time: 1-24 hours.

* Verify dev environment: Node 20+, pnpm, Rust (rustup), git

* Create empty public repo: github.com/jmarcone/antigram (README \+ MIT LICENSE only)

* Optionally reserve domain (Porkbun for antigram.app, \~10 EUR/year, no rush)

  ## **Day 1: scaffold \+ parser foundation**

  **Morning (3-4 hours):** scaffold the project

* pnpm dlx create-tauri-app@latest → React \+ TypeScript \+ pnpm

* Add Tailwind v4, shadcn/ui basics

* Add packages/parser/ as a workspace package (separate from the Tauri app, plain TS)

* Add packages/types/ for shared TypeScript types

* Commit, push, verify the default Tauri window opens with \`pnpm tauri dev\`

  **Afternoon (4-5 hours):** start the parser

* Install yauzl (streaming ZIP reader) and JSONStream (streaming JSON parser)

* Write the Post, Comment, Media TypeScript types based on real Meta export shape

* Implement ZIP discovery: open the ZIP, locate posts\_\*.json files, list media URIs

* Write a CLI entry: \`pnpm parse \~/Downloads/instagram-export.zip\` prints "Found N posts, M media files"

  End-of-day deliverable: the CLI runs against your real Meta export and prints accurate counts.

  ## **Day 2: parser completion \+ first photo processing**

  **Morning:** finish parsing

* Stream-parse posts\_\*.json into Post\[\] objects

* Resolve media URIs to absolute paths inside the ZIP

* Extract captions, timestamps, GPS, like counts, comment lists

* Handle multi-photo carousels (group by post\_id)

* Edge cases: posts without media, archived posts, missing fields

  **Afternoon:** extract media \+ EXIF basics

* packages/metadata/: shell out to exiftool (bundle as sidecar binary) to write EXIF

* Write DateTimeOriginal, GPSLatitude, GPSLongitude, ImageDescription (caption)

* Test on 10 photos from your real archive: do they import into Apple Photos with correct dates and GPS?

  End-of-day deliverable: a script that processes 10 photos correctly, end-to-end.

  ## **Day 3: output organization \+ Tauri integration**

  **Morning:** output structure

* packages/organizer/: write photos to \~/Pictures/MyInstagram/YYYY-MM/ with date-prefixed filenames

* Generate parallel \_metadata/YYYY-MM/post\_\*.json sidecars with full IG data

* Write \_archive\_info.json at root with stats (total posts, date range, tool version)

* Verify the output folder looks right when opened in Finder

  **Afternoon:** wire into Tauri

* Tauri command: takes ZIP path, runs full pipeline, emits progress events

* Rust side spawns the Node parser as a sidecar process (simplest approach)

* React side calls the command, listens for progress events

* Minimal UI: "Drop your Meta export here" \+ progress bar

  End-of-day deliverable: the Tauri app processes the full archive when you drop the ZIP into the window.

  ## **Day 4: gallery UI \+ selection**

  **Morning:** gallery view

* Show all parsed posts in a grid, sorted by date descending

* Thumbnail lazy-loading (Intersection Observer)

* Click a thumbnail → detail view (full caption, comments, location, likes)

* Caption text search (client-side, simple includes())

  **Afternoon:** selection \+ action

* Multi-select with shift-click and Cmd/Ctrl-click

* "Select all" and "Select year" shortcuts

* Big "Reclaim selected" button → triggers processing pipeline for chosen posts

* Show progress per-photo in the grid (small overlay)

  End-of-day deliverable: you can browse, select, and process specific photos from your archive.

  ## **Day 5: polish \+ ship alpha**

  **Morning:** polish

* Empty states (no export loaded, no posts selected)

* Error handling: malformed ZIP, missing files, permission errors

* "Reveal in Finder/Explorer" button on completion

* Settings: output folder path picker

* README update: actual usage instructions with screenshots

  **Afternoon:** ship

* Build Mac binary: \`pnpm tauri build\`

* GitHub Actions workflow for automated cross-platform builds (steal from official Tauri template)

* Tag v0.1.0-alpha, push tag → Actions builds Mac/Win/Linux binaries → attaches to release

* Test the Mac .dmg on your own machine end-to-end

* Post on personal Mastodon: "shipped the alpha of Antigram, let me know if you want to try it"

  **End-of-day deliverable:** v0.1.0-alpha tagged on GitHub, Mac binary in the release, you have used it on your own archive.

  ## **Daily time budget**

  Assume 6-7 focused hours per day, not full workdays. The alpha is achievable in 5 such days. *Reality buffer: assume \~30% slippage*, so a 5-day plan is realistically 6-8 days. If you stretch it across evenings and weekends, plan 2-3 weeks calendar time.

  ## **What is NOT in the alpha**

* Upscaling (Phase 2, \~1 extra week)

* Stories, reels, DMs (Phase 2+)

* Photobook generator (Phase 3\)

* Windows/Linux production builds (Phase 1.5 — wait for Mac binary to prove the concept)

* Code signing (do it later if/when warnings become friction)

* Landing page (a GitHub README is enough for the alpha)

* Public launch (Show HN, etc.) — comes AFTER the alpha is dogfooded for 1-2 weeks

  ## **Critical things to watch for during the 5 days**

* **Meta export shape variations.** Different users have different shapes depending on account age, features used, export size (gets chunked). Parser must handle missing fields gracefully — never crash on a missing nested key.

* **Memory blowups.** A 20GB export will OOM Node if loaded into memory. **Stream everything.** yauzl \+ JSONStream are non-negotiable.

* **File path encoding.** Meta exports may contain non-ASCII filenames (especially for non-English users). Handle Unicode paths carefully on Windows.

* **EXIF write quirks.** Some JPEGs in the Meta export have malformed EXIF already. exiftool is more forgiving than piexifjs. **Bundle exiftool**, do not rely on JS libraries.

* **Tauri sidecar binary configuration.** Shipping exiftool as a Tauri sidecar requires correct tauri.conf.json setup and platform-specific binary names (exiftool-x86\_64-apple-darwin, etc.). **Test this on Day 2**, not Day 5\.

* **macOS Gatekeeper on unsigned builds.** Your own machine will refuse to open the .dmg unless you \`xattr \-d com.apple.quarantine antigram.app\`. Document this for testers in the README.

  ## **If you hit a wall on Day X**

  The realistic failure modes and how to unblock:

* **Stuck on Tauri setup** → skip Tauri for now, build the parser \+ CLI first as pure Node. Add Tauri after the parser works. UI can come at the very end.

* **Parser too complex** → start with the absolute minimum: just extract photo files and creation timestamps. Skip captions, GPS, comments for v0.1. Add them in v0.2.

* **EXIF writing breaks** → ship without embedded EXIF. The folder structure \+ sidecar JSON is already useful. Add EXIF in v0.2.

* **Tauri build for Mac fails** → ship a CLI-only v0.1. Tauri UI in v0.2. The product is still useful as a CLI.

  **The principle:** *ship something that works end-to-end, even if simpler than planned. Width over depth. A working CLI without UI beats a polished UI that crashes on real exports.*


  # **What to do right now**

  Three actions, in order. None take more than 5 minutes.

* 1\. **Request your Meta export**. accountscenter.instagram.com → Your information and permissions → Download your information → JSON format, all content, high quality. The wait timer starts the moment you submit.

* 2\. **Create the empty GitHub repo**. github.com/jmarcone/antigram, MIT license, public, README placeholder. 2 minutes.

* 3\. **Check the domain** antigram.app on Porkbun. If available and you want it, grab it (\~10 EUR/year, not required to start).

  Then, when the export arrives (within 24h), start **Day 1 of the alpha plan**.


  # **Appendix: stack decisions at a glance**

| Layer | Choice |
| :---- | :---- |
| **App shell** | Tauri v2 (Rust \+ WebView) |
| **Frontend** | React 19 \+ TypeScript \+ Vite \+ Tailwind v4 |
| **Frontend deps** | @tanstack/react-query, zustand, shadcn/ui components |
| **Package manager** | pnpm with workspaces |
| **Build** | Tauri bundler → .dmg, .msi, .deb, .AppImage |
| **Parser language** | TypeScript (Node) — runs in Tauri sidecar |
| **EXIF/XMP writer** | exiftool sidecar binary (most reliable) or piexifjs / sharp |
| **Upscaler** | Real-ESRGAN ncnn-vulkan binary (per platform) |
| **Face enhancement** | GFPGAN (bundled) |
| **License** | MIT |
| **Repo** | github.com/jmarcone/antigram |
| **Funding** | GitHub Sponsors \+ Ko-fi |
| **Domain** | TBD (antigram.app preferred) |
| **Distribution** | GitHub Releases \+ Homebrew tap (later) |

  *— end of plan —*

  **Now go request your Meta export.**