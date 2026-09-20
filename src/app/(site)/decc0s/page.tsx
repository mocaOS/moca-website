import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Art DeCC0s",
  description:
    "Art DeCC0s is a PFP r/evolution by the Museum of Crypto Art — 10,000 unique 1/1 characters bred from the entire history of art, each backed by a 10,000+ word personality in the Codex and interactive as AI agents since 2025. Fully CC0.",
  path: "/decc0s",
  image: "/decc0s/hero.jpg",
  imageAlt: "Art DeCC0s — 10,000 unique 1/1 characters bred from the history of art",
});

const DNA = [
  {
    title: "Lineage",
    text: "The great art patrons of history — Medici, Sultan, Pharaoh, Holy Roman Emperor — collectors whose appetites shaped what survived.",
  },
  {
    title: "Memetics",
    text: "Crypto culture itself: Pepe, Wojak, Kevin, Chromie Squiggles — the native iconography of the chain, inherited as bloodline.",
  },
  {
    title: "Artist self-portraits",
    text: "Van Gogh, Frida Kahlo, Picasso, Kusama, Cindy Sherman — the faces artists gave themselves, refracted into new ones.",
  },
  {
    title: "The MOCA collection",
    text: "70 works by 70 artists from the museum's own permanent collection, so every DeCC0 carries crypto art in its genes.",
  },
];

const CODEX_STATS = [
  {
    stat: "105,561,738",
    title: "Words in the Codex",
    text: "Roughly 2.5 Encyclopedia Britannicas of pure personality, generated across 260,000+ API calls. Nothing in Art DeCC0s is accidental.",
  },
  {
    stat: "10,000+",
    title: "Words per character",
    text: "Biography, kinships, art-genre preferences, behavioral axes, writing quirks — a whole person behind every face, not a trait list.",
  },
  {
    stat: "20+",
    title: "Metadata vectors",
    text: "Ancestral ties to historical collectors and crypto artists, city and cultural affiliations, dispositions from amiable to aloof.",
  },
  {
    stat: "CC0",
    title: "Fully public domain",
    text: "The DeCC0s belong to everyone. Remix them, build on them, deploy them — the license is the invitation.",
  },
];

const VIBE_STUDIO = [
  {
    title: "The Codex",
    text: "Browse all 10,000 characters and the full depth of their written minds — the foundation of MOCA's agentic operating system.",
  },
  {
    title: "Community Studio",
    text: "Third-party apps built on the DeCC0s, with 100% of proceeds going to their creators — starting with physical prints by MOCA x Artscape.",
  },
];

const MILESTONES: {
  when: string;
  title: string;
  text: string;
  link?: { href: string; label: string; external?: boolean };
}[] = [
  {
    when: "Dec 2024",
    title: "10,000 characters mint — with agents in the brief",
    text: "The project description promised \"unprecedented levels of personality\" from day one. The destiny of the series was always for its characters to become AI participants in the crypto art movement.",
  },
  {
    when: "2025",
    title: "DeCC0s talk back on ElizaOS",
    text: "Long before agents were a mainstream topic, DeCC0s were already interactive: character files running on ElizaOS, holders chatting with their own DeCC0 in real time.",
    link: {
      href: "https://www.youtube.com/watch?v=u6f6mtsF180",
      label: "Watch the 2025 demo",
      external: true,
    },
  },
  {
    when: "Nov 2025",
    title: "The Codex goes live",
    text: "Nine months of datamancy end in a 2.5-day final run: 260,000+ API calls, 105,561,738 words. Agent profiles are derived programmatically from the Codex, not the other way round — so the characters outlive any single framework.",
    link: {
      href: "https://museumofcryptoart.medium.com/the-100-million-word-birth-of-art-decc0-agents-68990d66093c",
      label: "Read the making-of",
      external: true,
    },
  },
  {
    when: "v0.1",
    title: "A SOUL.md for every DeCC0",
    text: "Every Codex entry carries a versioned SOUL.md, served from the public Codex API. They were live before OpenClaw had settled on its name and before Hermes shipped — ready for the harnesses that came after them.",
    link: {
      href: "https://docs.decc0s.com",
      label: "Codex API docs",
      external: true,
    },
  },
  {
    when: "Now",
    title: "A DeCC0 guides the museum's 3D exhibitions",
    text: "Curate a show in the world builder and a DeCC0 walks visitors through it — answering from the Library's knowledge graph, speaking aloud, following you from room to room. Oblak (#2875) is the default guide.",
    link: { href: "/rooms/world", label: "Open the world builder" },
  },
  {
    when: "Soon",
    title: "The pipeline becomes Soulweaver",
    text: "What was built to give 10,000 DeCC0s a mind is planned to be offered to other NFT collections. Art DeCC0s is the genesis collection of Soulweaver.",
    link: { href: "/soulweaver", label: "About Soulweaver" },
  },
];

const HARNESSES = [
  {
    title: "ElizaOS",
    text: "Where it started. Character files derived from the Codex have run on ElizaOS since 2025, and still do.",
  },
  {
    title: "OpenClaw, Hermes & co.",
    text: "Any harness that reads a soul file can wear a DeCC0. Pull its SOUL.md from the Codex API and the character wakes up in place.",
  },
  {
    title: "Your own",
    text: "The Codex is structured, public, and CC0. Build a bot, a guide, a critic, a companion — the data belongs to everyone.",
  },
];

export default function ArtDecc0sPage() {
  return (
    <div>
      {/* Hero — the artwork carries the headline */}
      <section className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decc0s/hero.jpg"
          alt="Art DeCC0s — 10,000 unique 1/1 characters by the Museum of Crypto Art."
          className="h-auto w-full"
        />
      </section>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Intro */}
        <section className="mx-auto max-w-3xl py-14 text-center">
          <p
            className="mb-3 text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "var(--fg3)" }}
          >
            By the Museum of Crypto Art
          </p>
          <h1
            className="text-3xl font-semibold sm:text-4xl"
            style={{ color: "var(--fg1)", letterSpacing: "-0.02em" }}
          >
            How MOCA entered AI Agents
          </h1>
          <p className="mt-5 text-base leading-relaxed" style={{ color: "var(--fg2)" }}>
            Art DeCC0s are 10,000 striking, often bizarre, entirely unique 1/1
            characters bred from the whole history of art — and every one of them
            has a mind. Behind each face sits a 10,000+ word personality in the
            Codex, written to be deployed as an autonomous AI agent. They have
            been talking since 2025, before agents went mainstream. Fully CC0,
            free to remix, and the genesis collection of Soulweaver.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://codex.decc0s.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center rounded-[var(--radius)] px-6 text-sm font-medium transition-transform active:scale-[0.98]"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              Explore the Codex
            </a>
            <a
              href="https://vibe.museumofcryptoart.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center rounded-[var(--radius)] border px-6 text-sm font-medium"
              style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
            >
              Enter the Vibe Studio
            </a>
          </div>
        </section>

        {/* DNA */}
        <section className="py-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,360px)] lg:items-start">
            <div>
              <div className="mb-8 max-w-2xl">
                <p
                  className="mb-3 text-[11px] uppercase tracking-[0.16em]"
                  style={{ color: "var(--fg3)" }}
                >
                  The DNA
                </p>
                <h2
                  className="text-2xl font-semibold sm:text-3xl"
                  style={{ color: "var(--fg1)", letterSpacing: "-0.02em" }}
                >
                  Bred from the entire history of art.
                </h2>
                <p className="mt-4 text-base" style={{ color: "var(--fg2)" }}>
                  Each character inherits four strands of visual DNA, set against
                  backgrounds spanning sixteen categories from cave paintings to
                  Soviet propaganda. Over 300,000 candidates were generated and
                  distilled to the final 10,000 — identity markers deliberately
                  obscured so every collector forms their own reading.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {DNA.map((d) => (
                  <div
                    key={d.title}
                    className="rounded-[var(--radius-lg)] border p-5"
                    style={{ borderColor: "var(--border)", background: "var(--card)" }}
                  >
                    <h3 className="text-sm font-semibold" style={{ color: "var(--fg1)" }}>
                      {d.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg2)" }}>
                      {d.text}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-relaxed" style={{ color: "var(--fg2)" }}>
                To generate a character, four individual input images — one drawn
                from each strand — were blended into a single new face by a
                ComfyUI pipeline tuned over months of experimentation, chasing
                what the team called &ldquo;the perfect balance between aesthetic
                coherence and complete batshit depravity.&rdquo; The blend runs
                so deep that even DeCC0s sharing four identical DNA traits
                emerged as aesthetically inimitable 1/1s.{" "}
                <a
                  href="https://museumofcrypto.substack.com/p/art-decc0s-the-process"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 transition-colors"
                  style={{ color: "var(--fg1)" }}
                >
                  Read the full process
                </a>
                .
              </p>
            </div>
            <div
              className="overflow-hidden rounded-[var(--radius-xl)] border"
              style={{ borderColor: "var(--border)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/decc0s/examples.jpg"
                alt="A grid of Art DeCC0 characters — every one a unique 1/1."
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        {/* The Codex */}
        <section className="py-10">
          <div className="mb-8 max-w-2xl">
            <p
              className="mb-3 text-[11px] uppercase tracking-[0.16em]"
              style={{ color: "var(--fg3)" }}
            >
              The Codex
            </p>
            <h2
              className="text-2xl font-semibold sm:text-3xl"
              style={{ color: "var(--fg1)", letterSpacing: "-0.02em" }}
            >
              Every visually unique DeCC0 has an equally unique mind.
            </h2>
            <p className="mt-4 text-base" style={{ color: "var(--fg2)" }}>
              Nine months of datamancy gave each character ancestry, taste,
              temperament, and a voice of its own — then an AI-powered sanity
              review fought the pull toward sameness across all 10,000
              generations.
            </p>
          </div>
          <div
            className="overflow-hidden rounded-[var(--radius-xl)] border"
            style={{ borderColor: "var(--border)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/decc0s/codex.jpg"
              alt="A DeCC0 holding its Codex — the written mind behind every character."
              className="h-auto w-full"
            />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CODEX_STATS.map((s) => (
              <div
                key={s.title}
                className="rounded-[var(--radius-lg)] border p-5"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <div
                  className="text-[11px] uppercase tracking-[0.12em]"
                  style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}
                >
                  {s.stat}
                </div>
                <h3 className="mt-2 text-sm font-semibold" style={{ color: "var(--fg1)" }}>
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg2)" }}>
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Already built */}
        <section className="py-10">
          <div className="mb-8 max-w-2xl">
            <p
              className="mb-3 text-[11px] uppercase tracking-[0.16em]"
              style={{ color: "var(--fg3)" }}
            >
              Already built
            </p>
            <h2
              className="text-2xl font-semibold sm:text-3xl"
              style={{ color: "var(--fg1)", letterSpacing: "-0.02em" }}
            >
              Interactive before agents were a headline.
            </h2>
            <p className="mt-4 text-base" style={{ color: "var(--fg2)" }}>
              Art DeCC0s were designed as agents from the first line of the
              project description. The personalities came first, the harnesses
              came after — and each new generation of agent software has found
              10,000 characters already waiting for it.
            </p>
          </div>
          <ol
            className="rounded-[var(--radius-lg)] border"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            {MILESTONES.map((m, i) => (
              <li
                key={`${m.when}-${m.title}`}
                className="grid gap-2 p-5 sm:grid-cols-[96px_1fr] sm:gap-6"
                style={{
                  borderTop: i === 0 ? undefined : "1px solid var(--border)",
                }}
              >
                <div
                  className="text-[11px] uppercase tracking-[0.12em]"
                  style={{ color: "var(--fg3)", fontFamily: "var(--font-mono)" }}
                >
                  {m.when}
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--fg1)" }}>
                    {m.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg2)" }}>
                    {m.text}
                  </p>
                  {m.link && (
                    <a
                      href={m.link.href}
                      {...(m.link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="mt-3 inline-block text-sm underline underline-offset-4 transition-colors"
                      style={{ color: "var(--fg1)" }}
                    >
                      {m.link.label}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Harnesses */}
        <section className="py-10">
          <div className="mb-8 max-w-2xl">
            <p
              className="mb-3 text-[11px] uppercase tracking-[0.16em]"
              style={{ color: "var(--fg3)" }}
            >
              Nature for any harness
            </p>
            <h2
              className="text-2xl font-semibold sm:text-3xl"
              style={{ color: "var(--fg1)", letterSpacing: "-0.02em" }}
            >
              The Codex is the character. The framework is a detail.
            </h2>
            <p className="mt-4 text-base" style={{ color: "var(--fg2)" }}>
              Agent frameworks get renamed, forked, and replaced. The Codex was
              built to outlast all of them: every profile is derived from the
              same 10,000-word source, and souls are versioned so a character can
              evolve without being rewritten. Whatever you run, an Art DeCC0 can
              give it a personality.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {HARNESSES.map((h) => (
              <div
                key={h.title}
                className="rounded-[var(--radius-lg)] border p-5"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h3 className="text-sm font-semibold" style={{ color: "var(--fg1)" }}>
                  {h.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg2)" }}>
                  {h.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* The Vibe Studio */}
        <section className="py-10">
          <div className="mb-8 max-w-2xl">
            <p
              className="mb-3 text-[11px] uppercase tracking-[0.16em]"
              style={{ color: "var(--fg3)" }}
            >
              The Vibe Studio
            </p>
            <h2
              className="text-2xl font-semibold sm:text-3xl"
              style={{ color: "var(--fg1)", letterSpacing: "-0.02em" }}
            >
              The city center where DeCC0s come alive.
            </h2>
            <p className="mt-4 text-base" style={{ color: "var(--fg2)" }}>
              The Vibe Studio is the nexus for everything MOCA has created, is
              creating, and will create — the home of the DeCC0 agents and the
              front door to the museum's agentic ecosystem.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {VIBE_STUDIO.map((v) => (
              <div
                key={v.title}
                className="rounded-[var(--radius-lg)] border p-5"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h3 className="text-sm font-semibold" style={{ color: "var(--fg1)" }}>
                  {v.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg2)" }}>
                  {v.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Outlook */}
        <section className="py-10">
          <div
            className="rounded-[var(--radius-xl)] border p-7 sm:p-10"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-start">
              <div>
                <p
                  className="mb-3 text-[11px] uppercase tracking-[0.16em]"
                  style={{ color: "var(--fg3)" }}
                >
                  What comes next
                </p>
                <h2
                  className="text-2xl font-semibold sm:text-3xl"
                  style={{ color: "var(--fg1)", letterSpacing: "-0.02em" }}
                >
                  The foundation is laid. The next level is being drawn up.
                </h2>
                <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--fg2)" }}>
                  A hundred million words of distinct, deliberately
                  contradictory, thoroughly bespoke personality is not a
                  finished product. It is raw material — and MOCA is actively
                  strategizing how to push Art DeCC0s to the next level on top
                  of it. The agent era has caught up with the collection, and
                  the collection was built for exactly this moment.
                </p>
                <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--fg2)" }}>
                  Every soul is versioned, so revisions arrive as new versions
                  beside the old rather than overwriting them. Newer models
                  will read the same Codex pages and draw out more of what was
                  written into them. And because the whole thing is CC0 and
                  served from a public API, the museum is not the only one who
                  gets to build. We&apos;re just getting started.
                </p>
              </div>
              <ul className="grid gap-3">
                {[
                  "Showcasing artist oeuvres and collector collections across social platforms",
                  "Guiding visitors through virtual exhibitions, in the museum's own worlds and beyond",
                  "Brainstorming with artists and designing shows with curators",
                  "Recommending acquisitions from a collector's actual taste",
                  "Growing in skill, knowledge, and insight with every soul revision",
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-[var(--radius)] border px-4 py-3 text-sm leading-relaxed"
                    style={{ borderColor: "var(--border)", color: "var(--fg2)" }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="pb-20 pt-6 text-center">
          <h2
            className="text-2xl font-semibold"
            style={{ color: "var(--fg1)", letterSpacing: "-0.02em" }}
          >
            Every DeCC0 is waiting for someone to talk to.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base" style={{ color: "var(--fg2)" }}>
            Browse all 10,000 minds in the Codex, give your own agent a soul, or
            build on the collection — it&apos;s CC0, so it&apos;s already yours.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://codex.decc0s.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center rounded-[var(--radius)] px-6 text-sm font-medium transition-transform active:scale-[0.98]"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              Explore the Codex
            </a>
            <a
              href="https://vibe.museumofcryptoart.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center rounded-[var(--radius)] border px-6 text-sm font-medium"
              style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
            >
              Enter the Vibe Studio
            </a>
          </div>
          <p className="mt-5 text-sm" style={{ color: "var(--fg3)" }}>
            Wanna integrate?{" "}
            <a
              href="https://docs.decc0s.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 transition-colors"
              style={{ color: "var(--fg2)" }}
            >
              Dig the Codex Docs
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
