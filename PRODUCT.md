# Kalandra

<!-- impeccable:product-schema 1 -->

## Platform

Web. This repository's SvelteKit website introduces the native Kalandra programming language.

## Users

Developers exploring native CPU/GPU programming and the numerical foundations of AI and LLM workloads. The landing page must explain what Kalandra is and lead to native documentation and source.

## Product Purpose

Kalandra is a native mixed CPU/GPU language. Typed CPU workers, explicit tensor transfers, placed GPU tasks and structured parallel scopes share one language.

## Capabilities and Constraints

Native sources use .k. Apple Metal is the current GPU backend, targeting macOS 26+ on Apple silicon. Linux and Windows support CPU execution. GPU numerical programs support ten numeric types, dense tensor ranks zero through eight, rank-two matrix products, balanced sums, explicit conversions and resident numerical/control graphs. The toolchain includes a compiler, checker, formatter, language server and VS Code extension. Model loading, a full LLM inference runtime and CUDA are outside current release scope. Do not fabricate benchmarks, customers, availability of a public release, or model inference support.

## Brand Commitments

User-confirmed: retain the Kalandra name; emphasize GPU and AI/LLM foundations; make the website playful and distinctive. No green and no emojis. The user subsequently confirmed that both the website and documentation must default to dark, with black backgrounds; this overrides the earlier cream-ground direction. The previous dark, corporate split-hero design was rejected. Remove JavaScript-era content from the current website; reserve its history for a future blog section. Existing Kalandra mark assets can be retained. These facts and constraints come from the current conversation; the user explicitly authorized installing Impeccable and proceeding with the redesign.

## Stack

Existing SvelteKit 5 site, static adapter, Bun build, native-only Tiramisu documentation. Vercel preview deployments use the existing Kalandra project. The user is reviewing remotely; supply a hosted preview after implementation.

## Evidence on Hand

native/README.md; docs/design/native-gpu-capabilities.md; docs/design/native-gpu-completion.md; docs/design/native-platform-qualification-2026-10-23.json; native/metal-source/matrix-graph.k; native/metal-source/pre-matmul.k; native/benchmarks/gpu.k.

## Updated website direction

The user rejected the tensor-playground design as cheesy and cartoonish and explicitly selected TypeScript and Swift websites as references. This supersedes the earlier request for a playful treatment. Build a mature language-first site: restrained typography/motion, real source examples, direct factual explanation, clear documentation/onboarding. Retain true-black default website/docs, no green, no emojis, GPU and AI/LLM foundations, no JavaScript-era website content. No cartoon processor, animated tile toy, novelty typography, tilted panels or playful slogans.

## Personality refinement

The user found the literal TypeScript/Swift-style execution soulless. Preserve their clarity and mature language-site structure, but restore Kalandra’s own voice. The current refinement uses expressive serif contrast, an asymmetric introduction and a mathematical parallel-strand artwork with restrained motion. The user’s no-cartoon, no-green, no-emoji and black website/docs requirements still hold. Do not substitute a generic corporate page for personality.

## Current reference correction

The user rejected the serif/parallel-strand revision as ugly, added Elixir and Kotlin references, and called Kotlin the best reference. They then explicitly rejected copying Kotlin one-to-one. Use the references’ clarity, strong sans typography and rich original artwork, with Kalandra’s own composition and product story. Do not copy Kotlin’s giant name + three-adjective statement + stacked solution cards topology, artwork or brand. The present implementation is a draft awaiting user taste feedback. Retain black website/docs, native-only content and no green/emojis.

## Website accepted; logo work

User accepted the sculptural native CPU/GPU page as “awesome, acceptable for now” on 2026-10-23. Preserve that website direction. Next request is to touch up/redesign the existing logo, which the user dislikes. Explore logo proposals before replacing shipped brand assets; check navigation and favicon sizes as well as monochrome.

Logo direction confirmed: explore new abstract and K-based marks; preserving the bird is not required. Round-one vector studies are under .impeccable/brand/round-1/. No replacement selected yet.

Logo round two: user clarified that Kalandra is a woman, accepted exploring a more personal/elegant wordmark and requested several visual options. Type-based serif, italic and softer lowercase studies are in .impeccable/brand/round-2/. These are proposals for selection and later custom lettering; no accepted website changes or logo replacement yet.

Current logo decision: user abandoned the woman mascot and returned to round-one Confluence (the merging CPU/GPU mark). They like the merging idea but see a whale-tail resemblance. Preserve this concept and explore altered proportions, asymmetry or explicit incoming paths. Round-four vector refinements are in .impeccable/brand/round-4/. No replacement selected or deployed yet.

Logo selected: user chose round-four B, the offset merge. Adopt its exact geometry for the website, docs and favicon; preserve the accepted page design. This supersedes all other logo and mascot proposals.
