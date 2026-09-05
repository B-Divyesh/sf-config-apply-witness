# Apply Witness visual thesis

## Direction: the verification press

Apply Witness uses a dithered/halftone print system inspired by proof sheets, registration marks, and the physical act of stamping an inspected document. That metaphor belongs to this product: a provider success message is only the first printing; the readback receipt is the inspected proof. Decoration therefore explains comparison and evidence instead of filling space.

## Palette

The site is deliberately single-mode, like an archival cream stock under a work lamp.

- `paper #F3EEDF` — warm background; avoids sterile SaaS white.
- `paper-raised #FFFDF6` — reading and demo surfaces.
- `ink #171815` — primary text and press marks; 15.5:1 on paper.
- `ink-muted #54564E` — secondary copy; 6.7:1 on paper.
- `registration #18564E` — primary action/readback teal; 7.2:1 on paper.
- `registration-dark #103D38` — hover and focus support.
- `signal #E05238` — changed/error stamp; used with symbols and words.
- `warning #8A5A0A` — unknown state; always paired with `?` and label.
- `verified #24613B` — applied state; always paired with a check and label.
- `rule #B8B2A3` — large borders only, never body text.

## Type

- Headlines: **Arial Black**, then system heavy sans. Its blunt shapes evoke inked display type without a font download.
- Interface/body: **ui-monospace, SFMono-Regular, Menlo, Consolas**, a self-hosted system stack. It matches receipts, paths, hashes, and terminal output. No third-party font request is made.
- Scale: 14 / 16 / 20 / 28 / clamp(40–72) px, with body copy at 16–18 px and 1.55 line height. Numerals are tabular.

## Grid and spacing

The base unit is 4px. Common steps are 8, 12, 16, 24, 32, 48, 72, and 96px. A twelve-column desktop grid collapses to one column at 760px. Long copy is capped at 68 characters. Rules and registration marks align sections; cards appear only for independent receipt rows and pricing.

## Asset plan and provenance

- `site/public/witness-press.webp`: original raster hero generated for this product using `/opt/fleet/lib/gen-image.sh`, the factory `factory-image` deployment, on 2026-08-28. Prompt: “Editorial halftone screenprint illustration for a developer CLI landing page: an abstract configuration document passes through a compact inspection press and emerges as a field-by-field proof receipt, visible registration targets and check marks, cream paper, nearly black ink, deep teal and vermilion spot colors, coarse authentic Ben-Day dots, crisp flat shapes, no gradients, no readable words, no logos, no UI screenshot, wide landscape composition, generous quiet space, tactile imperfect ink edges.” The generated PNG is converted locally to WebP. License: original project asset, produced for Sociobot.
- `site/public/social-card.webp`: a 1200×630 centre crop derived locally from the original hero for social metadata on 2026-09-05. It introduces no third-party asset or license.
- `site/public/apple-touch-icon.png`: a 180×180 rasterized version of the hand-authored registration mark, composed locally on 2026-09-05. License: original project asset.
- `site/public/cli-demo.svg`: hand-authored, self-hosted SVG terminal recording of the real `apply-witness demo` bundled sample. The page also provides the same transcript as selectable HTML text. License: original project asset.
- Product mark, status glyphs, dot textures, and registration lines are hand-authored in CSS/HTML; no icon library or stock asset.

## Interaction grammar

Controls behave like press switches: square corners, a 2px ink border, and a 2px downward pressed translation. Results enter as a proof strip from their source control; status changes use both glyph and text. The live demo is an actual browser implementation of the conservative comparison rules, not a prerecorded animation.

## Motion policy

Transitions last 160–240ms and use only transform and opacity. The hero proof strip shifts once into registration on load and the demo receipt reveals once after “Run witness.” Nothing loops. Under `prefers-reduced-motion: reduce`, all transforms, scroll behavior, and reveal delays become instant while hierarchy and state remain intact.

## Responsive intent

At 390px the decorative crop marks and secondary nav link disappear; narrative and illustration stack; receipt metadata becomes vertical; terminal commands wrap rather than scroll the page. The demo and purchase controls retain 44px targets. No task capability is removed.
