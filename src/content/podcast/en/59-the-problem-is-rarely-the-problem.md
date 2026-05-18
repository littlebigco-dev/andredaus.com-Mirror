---
title: "The Problem Is Rarely the Problem"
og_title: "The Problem Is Rarely the Problem"
date: "2026-04-29T13:00:00.000Z"
episode_number: 59
category: "Business Strategy"
status: "published"
duration: "00:13:17"
audio_url: "https://anchor.fm/s/7320b160/podcast/play/119226466/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-3-29%2F423117072-44100-2-7935967a332e2.mp3"
episode_id: "5c3eb208-57bf-4332-a3fd-74bc1bae9651"
artwork_url: "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/19215224/19215224-1777466458850-facc8655abc4a.jpg"
description: |
  Most people are wrong about what their problem is. Not because they're careless - but because defining a problem is genuinely hard, and almost nobody treats it as the serious intellectual exercise it actually is. In this episode, I break down what a problem actually is, why stripping out dependencies makes your problem statement incomplete rather than clean, and how the wrong definition consistently leads to confident effort in the wrong direction. Three real examples. One from a technical debugging session where the obvious label "plugin conflict" would have sent everyone down the wrong path. One from a security setup where the instinctive fix solved nothing and created a maintenance ritual. And one from a consultant who was proud that he never needed to ask questions anymore; which is precisely the problem. If you've ever invested real effort into solving something, only to find the real obstacle was still exactly where you left it — this one's for you. Iconoclast Insights is a solo show by André Daus. New episodes challenge the assumptions that lead organizations and individuals to solve the wrong things with great confidence.
og_image: "/podcast-artwork/youtube/ep-059-youtube.jpg"
youtube_url: "https://youtu.be/gFM6WzbQXPg"
summary: "Most people invest effort solving the wrong problem because they never properly define what the problem actually is."
---

Here's something I've noticed after years of working with businesses on strategy, technology, and decision-making: most people are remarkably confident about what their problem is — and remarkably wrong.

Not because they're careless. Not because they're unintelligent. But because defining a problem is genuinely hard, and almost nobody treats it as the serious intellectual exercise it actually is.

Today I want to talk about problems. What they are, what they aren't, and why getting this distinction wrong costs people — and organizations — far more than any bad solution ever could. Because if you're solving the wrong problem, every ounce of effort you put in is not just wasted. It's actively misleading you. You generate evidence that you're making progress. You feel productive. And all the while, the real obstacle remains exactly where it was.

## Let's start with a definition.

A problem is a gap between a current state and a desired state. That part is well-known, and broadly right. But it's too abstract to be useful on its own. My working definition adds one more element: a problem is whatever *prevents you from getting from the current state to the desired state.* Not the road itself — the obstacle on the road.

Here's an analogy that makes this concrete. Imagine you're at point A and you need to get to point B. If there's a flat, open road between them — no problem. You just go. But if there's a river in the way, that might be a problem. If there's a canyon, definitely a problem. If you need to scale a cliff face, same thing.

Now here's where it gets interesting: a problem for one person doesn't have to be a problem for another. Take the river. Someone who can swim might look at it and say, "no issue, I'll swim across." But what if you can't swim? Or what if you can swim, but you need to bring your car to the other side? Now swimming is not a solution — it's a completely different problem you don't even have yet, because you haven't described your actual problem accurately.

This is where most people go wrong: they reduce the problem to its most visible element and strip away everything that makes it specific. "There's a river to cross" sounds like a clean problem statement. It isn't. The real problem might be: "There is a river with a very strong current, and we cannot enter the water here because the bank is too steep. We also need to bring a vehicle across." That is a different problem entirely. And every solution you design for the simplified version will fail to account for the river bank, the current, and the car — which then show up as surprises after you've invested time, money, and organizational goodwill in a direction that was always going to hit a wall.

Dependencies are not optional footnotes. They're part of the problem. Leaving them out doesn't make the problem simpler. It makes your solution wrong.

## Let me give you three real examples. All of them from my own work.

The first one comes from a technical debugging session I worked through not long ago. I was using a WordPress page builder — for those unfamiliar, that's a visual design tool — alongside two companion plugins. At some point, the fonts stopped loading in the editor canvas. Silently. No error messages. Just gone.

The immediate assumption — the one that gets filed instinctively in situations like this — was: "Plugin conflict." Two plugins don't play nicely, one breaks the other. Simple, obvious, move on.

That assumption is wrong. And if you act on it, you'll either abandon one of the tools you need, or you'll add a workaround that doesn't fix the root cause and creates new failure modes later.

What actually happened was two separate mistakes in two separate tools — and neither of them had anything to do with the other. Picture it like this. You have two workers on an assembly line. Worker A accidentally duplicates a step — he does his job twice without realizing it. Worker B is responsible for quality control, and his job is to remove duplicates. He does his job correctly. But the way he removes them leaves a gap in the numbering — like crossing items off a list but leaving the original numbers in place, so instead of 1, 2, 3, you now have 1, 2, 4. The package that arrives at the end of the line is malformed. Not because Worker A and Worker B were fighting. They weren't even talking to each other. Each made their own independent mistake, and the combination of the two produced a failure that looked like something else entirely.

The label "these two don't work well together" would have sent someone down the path of replacing one of the workers. But the problem wasn't the relationship. It was two distinct, unrelated errors that happened to interact in a specific way. The fix was small and precise. But you only find it if you resist the first comfortable explanation.

The problem was not a conflict between tools. The problem was a failure nobody had anticipated, sitting quietly in a gap between two separate implementations. Name it wrong, and every action you take reinforces the wrong direction.

## Second example. Same ecosystem, different failure mode.

Think of it like this. You have a building with a security guard at the door. His job is to watch for suspicious behavior — and one of his triggers is: "if someone knocks fifty times in under a minute, that's not a visitor, that's a threat." That's a reasonable rule. The problem is that a piece of software I was using to do my work happened to knock on that door fifty times every time I opened it — not because it was doing anything wrong, but because it was designed in a way that required many small check-ins rather than one composed request. The guard didn't know the difference. So he locked me out. Of my own building.

The solution everyone reaches for: "give me a permanent pass." In other words, whitelist my identity so the rule doesn't apply to me. The problem with that is twofold. First, my identity changes — the pass is issued to a name, and the name changes. So I'd be locked out again within days. Second, and more importantly, I've misunderstood what triggered the lockout. It wasn't about *who* was knocking. It was about *which door* was being knocked on. And that particular door — the one my software was using — has zero reason to ever be touched by an actual threat. Nobody else uses it. Telling the guard "ignore suspicious behavior at that specific door" costs nothing defensively and solves the problem permanently.

The problem was not "I'm being locked out." The problem was "the guard has no way to distinguish my legitimate, repetitive check-ins from an attack, because nobody told him that this particular door only I use." That's a longer sentence. It's also the one that leads somewhere real.

## Third example. This one isn't technical at all.

A while back, I was in a conversation with a consultant who worked with architecture firms on digitalization. He made a claim that I find deeply revealing of how problem-solving culture breaks down at scale. He said: "Once I've identified the same problem at fifty architecture firms and solved it each time, I don't need to ask many questions when I arrive at the fifty-first."

I want you to sit with that for a moment.

If your solution works identically at fifty clients without asking questions, one of two things is true. Either your solution is so generic that it's not actually solving a specific problem — it's installing a workflow that looks productive but doesn't address the real obstacle. Or you are systematically ignoring the dependencies that make each client's situation distinct — the river bank, the current, the car — and your clients are left to discover those on their own, after you've been paid and moved on.

"We've seen this fifty times" is not expertise. It's pattern-matching without interrogation. And the organizations that need help the most are usually the ones whose problem does not fit the fifty-case template — the ones who will be failed hardest by someone who already knows the answer before asking the question.

This is what I mean when I say the problem is rarely the problem. The problem your client names when they call you is almost never the one that matters. It's what was visible, what felt urgent, what they had language for. Your job — whether you're a consultant, a developer, a leader, or anyone else trying to move from A to B — is to resist that first framing and earn the right to describe the actual obstacle.

## So what do you watch for? Here's what I'd flag.

First: urgency is not a definition. When something feels urgent, we name it fast and start acting. That speed is often the enemy of accuracy. The more pressure you're under to solve something quickly, the more important it is to pause and ask whether you've described the problem or just the symptom that's making noise right now.

Second: simple problem statements that leave out dependencies are not clean — they're incomplete. If your problem statement fits in six words, you probably haven't described your problem yet. You've described an obstacle. The problem is the obstacle *plus the constraints on how you can address it.*

Third: if your solution has been applied identically in multiple different contexts, be suspicious of it. Real problems are specific. Generic solutions, applied without interrogation, are evidence that someone has stopped thinking and started executing a template.

Fourth: when you're given a label — "plugin conflict," "sales problem," "communication issue," "culture problem" — treat it as the beginning of the investigation, not the conclusion. Labels are shorthand. They are not diagnoses. Every label is an invitation to ask what's actually underneath it.

## And here's the food for thought I'll leave you with.

The organizations that fail spectacularly — the ones that miss markets, that ship the wrong product, that lose clients they never saw coming — almost never made a catastrophic mistake in execution. They executed well. They executed confidently. On the wrong problem.

The premium skill in any field is not solving problems. It's identifying them. And identifying them means resisting the reflex to accept the first version of the problem you encounter, asking what dependencies belong in the description, and being willing to do the slower, less satisfying work of actually defining what's in the way before you decide what to do about it.

Because here's the thing about a river: if you need to get your car across, learning to swim is not wasted effort. It's just not the answer to your problem.