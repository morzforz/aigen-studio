# Aigen Studio — Research Log (image-focused)

Findings log for third-party frontends, NovelAI platform behavior, and implications for **Aigen Studio** (aigen-studio). Claims cite source URLs. Product goals and constraints live in [CONCEPT.md](./CONCEPT.md).

**Scope note:** This document remains primarily an **image** research log (prior-art clients, NovelAI image APIs/metadata, human-initiated generation policy). Product scope now also includes **text generation assistance**, a **lore repository**, and **story scaffolding** (memory / lorebook / system prompts); those outcomes are defined in CONCEPT.md. Deep research into NovelAI text APIs, lorebook formats, scripting, and browser extensions/userscripts is **not** covered here yet—tracked as later work. NovelAI text-UI integration (replace vs extend vs leave-in-place) is explicitly deferred in CONCEPT.

---

## 1. Sources researched

| Source | URL | Role |
|--------|-----|------|
| NAI Artist Mixer (repo) | https://github.com/UraganAI/NAI-Artist-Mixer | Prior art: artist tags / mix tooling |
| NAI Artist Mixer v0.2.0-beta | https://github.com/UraganAI/NAI-Artist-Mixer/releases/tag/v.0.2.0-beta | Release notes for features |
| NAIWeaver (repo + README) | https://github.com/ststoryweaver/NAIWeaver | Prior art: full unofficial image frontend |
| NAIWeaver FEATURES.md | https://github.com/ststoryweaver/NAIWeaver/blob/master/FEATURES.md | Feature catalog |
| NAIWeaver ARCHITECTURE.md | https://github.com/ststoryweaver/NAIWeaver/blob/master/ARCHITECTURE.md | Client architecture & data lifecycle |
| NAIWeaver API_DOCUMENTATION.md | https://github.com/ststoryweaver/NAIWeaver/blob/master/API_DOCUMENTATION.md | Unofficial NovelAI image API notes |
| NovelAI docs (home) | https://docs.novelai.net/en | Official documentation root |
| NovelAI Image Generation | https://docs.novelai.net/en/image | Image feature overview |
| NovelAI History | https://docs.novelai.net/en/image/history | Session history behavior |
| NovelAI Vibe Transfer | https://docs.novelai.net/en/image/vibetransfer | Vibes + metadata caveats |
| NovelAI FAQ (image privacy / metadata) | https://docs.novelai.net/en/faq | Storage + save-path metadata rules |
| NovelAI ToS | https://novelai.net/terms/ | Service restrictions (automation, etc.) |
| novelai-image-metadata (official) | https://github.com/NovelAI/novelai-image-metadata | Stealth PNG alpha metadata tooling |
| Inspect tool (official) | https://novelai.net/inspect | View prompt/settings/seed from saved images |

Related third-party projects mentioned by NAIWeaver (not deep-dived here): [novelai-python](https://github.com/LlmKira/novelai-python), [NAI_UI_2](https://github.com/EctoplasmicNeko/NAI_UI_2), [ComfyUI_NAIDGenerator](https://github.com/bedovyy/ComfyUI_NAIDGenerator).

---

## 2. NAI Artist Mixer (UraganAI)

### 2.1 What it is

Unofficial tool aimed at **NovelAI v4.5** for finding, sorting, and formatting **artist tags**, and mixing Danbooru artists (and custom photos) into formatted prompt lists.

- Repo description: “An unofficial AI-made tool for NovelAI v4.5, to find, sort through and format artist tags.”
- `metadata.json` describes: “Mix Danbooru artists and custom photos into formatted prompt lists,” with a Gemini-oriented capability flag (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`).
- Stack signals: Android/Kotlin Gradle project (`app/`, Compose plugins, KSP)—a mobile-first companion rather than a full web stack.

Sources: https://github.com/UraganAI/NAI-Artist-Mixer · https://github.com/UraganAI/NAI-Artist-Mixer/blob/main/metadata.json

### 2.2 Features relevant to us (from v0.2.0-beta notes)

Release https://github.com/UraganAI/NAI-Artist-Mixer/releases/tag/v.0.2.0-beta highlights:

- **NovelAI API link** (requires NAI API key)—can generate a picture with the selected artist mix (“Try Mix”), with re-roll of some/all artists.
- Generation settings (defaults referenced from nax.moe constrained prompt settings).
- **Favorite mixes**—restore artists from a previous generation.
- **Tag system** for favorite artists and mixes (manual tags when favoriting) for categorization.
- Theme system aligned with NovelAI themes + custom themes.

### 2.3 Relevance mapping

| Our goal | Artist Mixer overlap |
|----------|----------------------|
| Tag / snippet library | Strong for **artist** tags and mix recipes; not a full Danbooru library product |
| Character profiles | Weak / none as primary focus |
| Gallery auto-save | Not the product focus |
| Feedback KB | Favorites of mixes/artists are a light “this mix was good” signal |
| Metadata extract | Not a documented focus of the release notes |
| LLM analysis | Built around Gemini-oriented tooling for the mix experience; different from our “analyze vault feedback” goal |

**Takeaway:** Prior art for **curated artist-tag mixing**, favorites, and light categorization—not a full vault + feedback + server-side analysis product.

---

## 3. NAIWeaver (ststoryweaver)

### 3.1 What it is

Unofficial **cross-platform frontend** for NovelAI image generation (Diffusion **V4.5**), built with **Flutter** (Windows, Linux, Android, Web). Focus: organization, tag management, and prompt control.

- Repo: https://github.com/ststoryweaver/NAIWeaver  
- Web demo mentioned in README: https://ststoryweaver.github.io/NAIWeaver/  
- Requires a NovelAI API key (subscription).

### 3.2 Feature areas relevant to our goals

Summarized from README + FEATURES.md + ARCHITECTURE.md (not exhaustive).

#### Image generation surface

- txt2img, img2img, inpainting, precise/director reference, vibe transfer, multi-character (coords + interactions)
- Seed control, custom resolutions (64-snap), Anlas balance display
- Keyboard shortcuts (e.g. Ctrl+Enter generate)—still user-driven generation

#### Tags, snippets, styles, presets

- Danbooru tag library with autocomplete; tag library with visual examples
- Wildcards (`__pattern__`), prompt styles (prefix/suffix/negative), full preset manager
- Packs (`.vpack`) for portable export/import of presets, styles, wildcards, refs, vibes, characters, themes, albums

#### Characters

- Saved personas as local JSON; appearance buckets; per-character closets/outfits
- Tag autocomplete expansion `[Name]` / `[Name (Outfit)]`
- AI character/wardrobe drafting via NovelAI **text** models (not the same as our local LLM analysis goal)

#### Gallery / auto-save

- Gallery vault with favorites, albums, search, multi-select, metadata display
- **Auto-save** of generated images to a configurable output folder
- Import preserves EXIF / injects `OriginalDate` PNG chunk for sort stability

#### PNG metadata round-trip

- Inject generation settings into PNG **Comment/Description text chunks** (isolate-based)
- Extract on drag-and-drop / img2img load; selective category import (prompt, negative, characters, seed, styles, settings)
- Documented as enabling generate → save → re-import workflows

#### Vibes / references

- Director Reference (Character / Style / Character & Style) with strength & fidelity
- Vibe Transfer with strength and information-extracted controls
- Managers + shelves in the main UI; pack support for portability

#### On-device / offline-ish processing (inspiration only)

- ONNX Runtime: BG removal, upscale, segmentation—**local** post-processing, not NovelAI gen
- Director Tools still call NovelAI `augment-image` (service-side)

#### What NAIWeaver does *not* emphasize (vs our concept)

- Dedicated **server-side** multi-user or single-user web backend with central DB (state is largely local app files + SharedPreferences)
- Structured **feedback KB** (likes/ratings/reviews) for LLM pattern mining over “what worked”
- **Local LLM** analysis of the vault as a first-class product goal
- **External paid LLM** analysis with explicit manual gate
- Deferred local imagegen / remote home GPU API as product pillars

### 3.3 Architecture notes (for comparison)

- Feature modules: `generation`, `gallery`, `characters`, `director_ref`, `vibe_transfer`, `text_gen`, `tools/*`
- `NovelAIService`: Dio client, ZIP response decompression for `generate-image`
- `ImageUtils`: PNG metadata inject/extract
- Data lifecycle: user generate → inject metadata → save under `output/` → gallery indexer

Source: https://github.com/ststoryweaver/NAIWeaver/blob/master/ARCHITECTURE.md

### 3.4 Unofficial API surface (as documented by NAIWeaver)

Third-party documentation only—NovelAI may change endpoints; treat as prior art, not a contract.

| Item | Notes |
|------|--------|
| Generate | `POST https://image.novelai.net/ai/generate-image` → ZIP of PNG(s) |
| Augment | `POST https://image.novelai.net/ai/augment-image` (BG remove, lineart, sketch, colorize, emotion, declutter) |
| Auth | `Bearer <API_KEY>` |
| V4.5 structure | `v4_prompt` / `v4_negative_prompt` with `char_captions` + optional coords |
| Director ref | Parallel arrays: images, descriptions, strength, secondary strength, info extracted |
| Vibe transfer | `reference_image_multiple`, `reference_strength_multiple`, `reference_information_extracted_multiple` |

Source: https://github.com/ststoryweaver/NAIWeaver/blob/master/API_DOCUMENTATION.md

**TOS note for us:** Even if an API key enables third-party clients, our product still requires **every** NovelAI image job to be **human-initiated** (see CONCEPT.md §6). API access is not a license to unattended batch generation.

---

## 4. NovelAI platform facts (official docs)

### 4.1 Image generation overview

Official image docs cover tagging, models, img2img, canvas, steps/guidance, UC, quality tags, seed, enhance, upscale, inpaint, history, vibe transfer, multi-character, prompt randomizer/chunks, director tools, precise reference, sampling, etc.

Source: https://docs.novelai.net/en/image

### 4.2 Transient history / no permanent service-side image store

From History + FAQ:

- History holds images **only for the session**; leave or refresh → history is emptied.
- FAQ: generations are **not stored or saved** by NovelAI long-term; session-wise only. Users must download to keep images.
- Requests/uploads/generations are not logged/stored on their side for browsing later (privacy stance); last prompt may remain in **browser local** storage.

Sources:

- https://docs.novelai.net/en/image/history  
- https://docs.novelai.net/en/faq (sections: “Are my image generations stored?”, “I refreshed or left the Image Generation…”)

**Implication for us:** Auto-save to **our server-side** vault is a core product differentiator, not a nice-to-have.

### 4.3 Image metadata: save path, clipboard, stealth PNG

#### Official FAQ (user-facing save rules)

- Prompt, settings, and seed are recoverable **only from metadata of a properly saved file**.
- **Clipboard export does not contain metadata.**
- **Right-click → save does not contain metadata.**
- The UI **save/download icon** must be used for metadata to be included.
- Official [inspect tool](https://novelai.net/inspect) can show prompt/settings/seed; dragging an image back onto the site can offer to reuse settings.

Source: https://docs.novelai.net/en/faq (“I lost my text prompt, seed or settings…”)

#### Official stealth PNG / alpha channel tooling

NovelAI publishes https://github.com/NovelAI/novelai-image-metadata :

- Metadata is stored in the **stealth pnginfo** format in the **alpha channel**.
- `nai_meta.py` extracts prompt/settings from the alpha channel.
- `nai_meta_writer.py` can write metadata to alpha **and** regular PNG metadata, plus optional FEC for RGB.
- Signature verification via `signed_hash` (model provenance; no user-specific data in that field).
- Note in README: FEC is designed for slight pixel damage (e.g. clipboard paths); NovelAI does not currently add FEC by default.

#### Vibe transfer metadata

- Encoded vibes can be embedded in image metadata when saving via the **Download** button.
- **Not** embedded when copying/pasting images from the site (technical limitation).
- Embedded vibes are encodings only—not full original reference pixels; changing “Information Extracted” after import from an image is not possible.
- Pre-encoded vibes avoid re-encoding Anlas cost; `.naiv4vibe` / `.naiv4vibeBundle` download formats exist for reuse/share.

Source: https://docs.novelai.net/en/image/vibetransfer

**Implication for us:** Implement extractors that understand both **stealth alpha pnginfo** and ordinary PNG text chunks (as NAIWeaver does for round-trip). Prefer download/API PNG paths that preserve metadata; treat clipboard and some browser “save as” paths as metadata-lossy.

### 4.4 Terms of Service (automation posture)

ToS (https://novelai.net/terms/) includes restrictions such as not using **botnets or automated systems** that disrespect service limitations or place **excessive strain** on the service (see §9.1.6 in publicly mirrored/crawled text). Community discussion also associates account restrictions with unusual automated activity.

**Product policy (our hard rule):** Regardless of API convenience, Aigen Studio treats **all NovelAI image generation as human-initiated only**. No automated image generation features. See CONCEPT.md §6.

---

## 5. Cross-cutting relevance matrix

| Our goal | NAIWeaver | Artist Mixer | NovelAI official |
|----------|-----------|--------------|------------------|
| Auto-save images to durable store | Local folder auto-save + gallery | Minimal | Session-only history; user must download |
| Tags / snippets / presets | Strong (tags, wildcards, styles, presets, packs) | Artist-focused tags/mixes | Tagging docs; no personal cloud library for images |
| Character profiles | Strong local character + outfit system | Weak | Multi-character prompting docs |
| Vibe / director refs | Strong managers + UI shelves | N/A primary | Vibe transfer + precise reference docs |
| Feedback KB (like/rate/review) | Favorites/gallery only (weak vs full reviews) | Favorite mixes | Explore is separate opt-in social path |
| Metadata extract | PNG text-chunk round-trip | Not focus | Stealth alpha + FAQ save rules + inspect tool |
| Local LLM pattern mining | Not core product | Gemini-oriented mix tool | N/A |
| Manual external LLM analysis | Not core product | Gemini usage | N/A |
| Local imagegen (later) | ONNX post-process only | N/A | Service-side models only |
| Human-only NovelAI gen | UI generate actions | Try Mix is user-driven | Interactive product + ToS automation limits |

---

## 6. Open questions (research → design)

1. **Integration model:** Full custom client (NAIWeaver-like) vs. companion server that intercepts/saves from a browser workflow vs. hybrid.
2. **Metadata stack:** Rely on official `novelai-image-metadata` Python tooling vs. reimplement stealth decode in our server language; whether to also write our own sidecar JSON for feedback that is not in NovelAI’s schema.
3. **API stability:** NAIWeaver’s API_DOCUMENTATION is excellent prior art but unofficial—expect breakage; pin versions and degrade gracefully.
4. **Vibe files:** Whether to natively store `.naiv4vibe` / bundles server-side for Anlas-efficient reuse.
5. **Single-user local server:** Auth, LAN access from other devices, and backup strategy for the image vault on M3/M4 Mac hardware.
6. **Feedback schema:** Minimal (like + optional note) vs. multi-axis ratings that LLMs can mine more effectively.

---

## 7. Research method notes

- Primary sources: GitHub README/FEATURES/ARCHITECTURE/API docs for NAIWeaver; release notes + repo metadata for Artist Mixer; NovelAI official docs/FAQ/vibe/history; official metadata GitHub README.
- Not done in this pass: full reverse-engineering of closed web app bundles, exhaustive tag of every NAIWeaver release, legal review beyond publicly posted ToS language.
- This document should be updated when NovelAI ships material metadata or API changes, or when we evaluate additional prior-art clients.
