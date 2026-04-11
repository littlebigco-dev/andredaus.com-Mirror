---
title: "How the Most Promising Builder Gave Me an Architecture That Needs No Builder at All"
date: 2026-04-10
og_title: "The Builder That Made Me Ditch Builders"
summary: "I went all in on Etch. The bugs didn't kill it — they diagnosed something deeper. How the most promising WordPress builder led me to an architecture that needs no builder at all."
category: [Strategy, WordPress]
status: published
---

There is a particular kind of problem that doesn't announce itself as a problem. It arrives as friction. A bug here. A workaround there. A plugin that needs a fix before the tool that needs the plugin will work. You keep moving. You ship things. You tell yourself this is just how complex systems behave.

You are wrong. The friction is trying to tell you something. You're just not listening yet.

---

## I was all in on Etch.

In a WordPress builder landscape that had given us everything from bloated page soup to opinionated frameworks that lock you out of your own markup, Etch felt different. Clean architecture. Logical API. It treated developers like adults. I committed — rebuilt on Etch and ACSS, invested real time, went deep.

Then the friction started.

ACSS double-registers its filter hook. Fonts break silently depending on load order. Etch's `array_unique()` call leaves non-sequential array keys, which PHP's `json_encode()` then serializes as an object instead of an array. The whole font stack collapses. And Etch's aggressive REST API polling — a perfectly reasonable implementation choice — trips CrowdSec's rate limits and gets your builder banned from its own site.

Each bug was fixable. I fixed them. I wrote an MU-plugin to patch the conflicts. I whitelisted the REST API paths in CrowdSec. I documented the whole chain.

And then I stopped and looked at what I had built.

---

## I was writing infrastructure to fix a tool whose entire purpose was to reduce infrastructure.

That's the moment worth paying attention to. Not the bugs — bugs exist in every piece of software. The signal was the *pattern*. Every solution added a layer. Every layer added a dependency. Every dependency added a surface area where the next thing could go wrong.

I started pulling the thread.

WordPress stores content in MySQL. Not in files. Not in Git. In a database that you query through an abstraction layer, that you version through plugins that were never quite production-ready, that you back up through yet another tool, that you migrate through export XML that no diff tool can make sense of.

The builder was supposed to be the answer to the complexity. Instead it was revealing the complexity that was always there — the complexity I had accepted as the cost of doing business on WordPress.

---

## The problem was never Etch.

This is the part that takes a moment to sit with.

Etch didn't fail me. It diagnosed me.

The assumption I had never questioned was this: that WordPress was the right foundation for a content-driven professional site. It was a reasonable assumption — half the internet runs on WordPress. But reasonable assumptions are exactly the ones you need to interrogate most carefully, because they're the ones nobody bothers to challenge.

Once I started pulling the thread, the assumption didn't survive scrutiny. WordPress is a publishing platform from an era when content lived in a database and you fetched it per-request. It's extraordinarily good at that. But what I was actually trying to build was not a dynamic application. It was a set of documents — insights, services, use cases, library entries — that changed infrequently, needed version control, and should load instantly anywhere in the world.

For that problem, a database is the wrong substrate. I had been solving the wrong problem.

*The problem is rarely the problem.* I've said that to clients for years. It turns out it applies to your own stack too.

---

## The architecture that emerged.

Once the assumption broke, the direction was obvious.

Content as Markdown files, committed to Git. Six typed content collections with proper schemas and cross-references — Insights, Services, Use Cases, Library, FAQs, Podcast. Astro at build time, converting those files into static HTML. Cloudflare Pages distributing the result to every edge node on the planet.

No database. No builder. No plugin surface area to maintain or defend.

The content is just files. Diffable. Taggable. Readable in any editor, on any device, without a connection to anything. Git is simultaneously the version control layer, the backup, the changelog, and the audit trail. The entire deployment is a `git push`.

Every "solution" I had been stacking on WordPress to achieve these properties — backup plugins, migration tools, version control workarounds, REST API patches — simply disappears. Not because I solved them. Because I removed the substrate that made them necessary.

---

## Etch didn't fail me. It diagnosed me.

The most promising builder in the WordPress ecosystem led me to an architecture that needs no builder at all.

That's not a criticism of Etch. The product is genuinely well-made. For sites where WordPress is genuinely the right substrate — complex applications, dynamic content, client-managed CMS scenarios — Etch is still one of the most coherent tools available.

But for my site — a content-driven consulting presence that needs to load fast, stay secure, and never surprise me at 2am — the diagnosis was unambiguous. And I would not have reached it without the friction.

The bugs were not the problem. The bugs were the messenger.

---

*What tool are you defending right now that's actually just revealing a deeper assumption you haven't questioned yet?*
