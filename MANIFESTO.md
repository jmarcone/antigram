# The Antigram Manifesto

*Your Instagram. Finally yours.*

Right now, if you are a business, Meta gives you a powerful API. You can pull
data, push posts, schedule content, analyze engagement. You are a customer;
they treat you like one.

If you are a person — the one who actually took the photos, wrote the
captions, lived the moments — you get a form. You fill it out, wait 24 to 48
hours, and Meta emails you a ZIP file of compressed JPEGs and JSON nobody can
read. That is your "access" to your own life.

That asymmetry is not an accident. It is a business decision. Your photos are
more useful to Meta if you cannot actually use them yourself.

Instagram restricts **you** from having access to **your** personal pictures,
while businesses can do whatever they want with their account data. You should
be able to take **your** pictures, **your** captions, and the comments
**your** people wrote you, and own them, store them, distribute them. They
are your pictures. Currently they are Meta's, and you have barely a read-only
window into your own life.

Antigram exists because they are not Meta's photos. They are yours.

## What Antigram is

A free, open-source, local-only desktop tool that takes the data export Meta
is legally required to give you and turns it into something you actually own:

- Your photos, organized by year and month, as real files on your disk.
- Your captions, embedded into each photo's metadata.
- The comments your people wrote you, preserved next to each photo.
- Locations, timestamps, carousel groupings, device used to shoot the photo —
  all the things Meta strips out of the viewing experience.
- Optionally, upscaled to higher resolution because Meta compressed your
  photos and you should not have to live with that.

What you get is a folder. It works in Apple Photos. It works in Google Photos.
It works in Immich, in PixelFed, in Nextcloud, on a hard drive, on a USB stick
mailed to your mom. It works anywhere, because it is just files, and you own
them.

**Free forever. Open source. Local only. Your photos never touch a server we
run, because there is no server.**

## The name

**Antigram.** The *anti-* prefix is doing real work here. It is not
Instagram-without-the-bad-parts. It is the opposite of Instagram: where
Instagram hoards, Antigram returns. Where Instagram compresses, Antigram
restores. Where Instagram restricts, Antigram unlocks. The name announces the
politics at a glance.

It is also a suite name. If this works, the same engine handles Antibook
(Facebook), Antitok (TikTok), Antix (X / Twitter). Same data-export-driven
model, same ethos. Antigram is just the first front.

## Non-goals

Antigram will never:

- Run a hosted version. There is no server.
- Require an account, sign-in, or any form of user tracking.
- Add analytics or telemetry, anonymous or otherwise.
- Integrate with the Instagram Graph API or any scraping toolkit.
- Add a paid tier, a pro version, or a SaaS wrapper.

If you ever see any of the above attached to the name "Antigram", it is a
fork that broke faith with the project. The canonical project is at
github.com/jmarcone/antigram.

*Made with rage and love by Julian Marcone. Donations accepted but never
required. Forks encouraged.*
