# Repository Instructions

## Scope

- This is a static Dark Queen / Sofía Arauz brand-asset package; it has no application build, test, lint, or dependency-install workflow.
- Read `README.md`, `manifest.json` or `manifest.csv`, and `05-guidelines/` before changing or selecting assets.

## Asset Semantics

- The active approved logo masters are the four `01-logos/png/*--enhanced-master.png` files; their bytes are intentionally frozen.
- `06-source-reference/` contains authoritative originals, exact opaque crops, and archived previous exports for comparison, not replacement active artwork.
- Files named `--embedded-raster.svg` are self-contained PNG-in-SVG containers, not editable vector logo paths. The true vector SVGs are the solid backgrounds in `03-backgrounds/svg/` and the palette strip in `04-color-and-tokens/`.
- Preserve proportions and original wording. Do not invent vector geometry, recolor raster artwork to palette tokens, infer unverified fonts, or add numeric clear-space/minimum-size rules; these limitations are documented in `07-qa/unresolved-items.json`.
- Convenience `--long-edge-Npx.png` exports add no detail. Use the approved masters or their resized exports for active digital work, and label new derivatives clearly.
- The root `sofia_dark_queen_branding_description.json` is byte-identical to `06-source-reference/brand-specification.json` but is outside the package manifest; use the latter as the canonical indexed source reference.

## Verification

- From the repository root, verify packaged-file integrity with `sha256sum -c SHA256SUMS.txt`.
- `SHA256SUMS.txt` covers the packaged payload and manifests, not this instruction file. If payload files are intentionally changed, update `manifest.json`, `manifest.csv`, and the checksum list together; otherwise leave approved bytes and metadata untouched.
- Treat `07-qa/qa-report.json` as the record of completed checks and approved reconstruction limitations, not as evidence that source vectors, exact alpha, fonts, or print suitability exist.
