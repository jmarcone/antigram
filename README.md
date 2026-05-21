# Antigram

*Your Instagram. Finally yours.*

**Meta has your photos. This gives them back.**

> Status: **v0.1.0 in development.** Pre-alpha. Things will change. Do not use
> against irreplaceable archives yet — keep your original Meta export ZIP
> until v1.0.

Right now, if you're a business, Meta gives you a powerful API. You can pull
data, push posts, schedule content, analyze engagement. You're a customer;
they treat you like one.

If you're a person — the one who actually took the photos, wrote the
captions, lived the moments — you get a form. You fill it out, wait 24 to 48
hours, and Meta emails you a ZIP file of compressed JPEGs and JSON nobody can
read. That's your "access" to your own life.

That asymmetry isn't an accident. It's a business decision. Your photos are
more useful to Meta if you can't actually use them yourself.

**Antigram exists because they're not Meta's photos. They're yours.**

## What it does

Takes the data export Meta is legally required to give you and turns it into:

- your photos, organized by date, as files you actually own
- your captions, embedded into the photo metadata
- the comments your people wrote you, preserved alongside each photo
- the locations, timestamps, carousel groupings, the things Meta strips out
  when you view them
- optionally: upscaled, because Meta compressed them and there's no reason you
  should have to live with that

What you get is a folder. It works in Apple Photos, Google Photos, Immich,
PixelFed, Nextcloud, on a hard drive, in an email to your mom. It works
anywhere, because it's just files, and you own them.

**Free forever. Open source. Local only. Your photos never touch a server we
run, because there isn't one.**

## How to get your Instagram export

1. Go to <https://accountscenter.instagram.com/>.
2. *Your information and permissions* → *Download your information*.
3. Choose **JSON** format, **All available information**, **High quality**.
4. Wait 1–48 hours. Meta emails you when the ZIP is ready.
5. Download the ZIP. Do not unzip it. Drop it into Antigram.

The wait is not us — that's Meta's pace. Pour yourself a coffee. They will
email you when it's ready.

## Repo layout

```
antigram/
├── apps/
│   └── desktop/             # Tauri v2 app (Rust shell + React frontend)
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── parser/              # Meta ZIP → normalized Post[]
│   ├── metadata/            # EXIF / XMP writer (exiftool sidecar)
│   ├── organizer/           # Output folder structure builder
│   └── cli/                 # Standalone CLI (works without the desktop app)
├── binaries/                # Vendored exiftool / Real-ESRGAN (per-platform)
├── MANIFESTO.md
├── LICENSE                  # MIT
└── README.md
```

## Development

Requirements:

- Node 20+ (24 recommended)
- pnpm 10+
- Rust stable (only for the desktop app — parser and CLI run pure Node)
- On Windows, MSVC Build Tools for the Tauri build only

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @antigram/cli parse <path-to-export.zip>
```

Status of each piece is tracked in the issue list, not here. If a feature
isn't documented above, it isn't built yet.

## Non-goals

Antigram will never run a hosted version, require an account, add analytics,
integrate with the Instagram Graph API, or add a paid tier. See
[MANIFESTO.md](./MANIFESTO.md) for the full list.

## License

MIT. See [LICENSE](./LICENSE).

*Made with rage and love by Julian Marcone. Donations accepted but never
required. Forks encouraged.*
