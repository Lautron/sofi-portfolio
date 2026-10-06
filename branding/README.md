# Dark Queen / Sofía Arauz — brand asset package

Owner-approved enhancement edition 2.0 · 6 October 2026

Start with `01-logos/png/*--enhanced-master.png` for the four approved high-resolution logos. The exact approved images are preserved byte-for-byte. Use the 256, 512 or 1024-pixel exports for digital layouts. Read `05-guidelines/dark-queen-brand-guidelines.pdf` for current usage and limits. These are approved raster reconstructions, not recovered vector masters.

The primary uses the first enhancement you approved. The symbol, secondary emblem and DQ monogram use the three enhancements you approved together. No later cleanup or alternate generation is included. Original source files, exact source crops and the previous logo exports remain in `06-source-reference`.

## Folder map

| Folder | Contents |
| --- | --- |
| 01-logos | Four approved enhanced marks; PNG masters, resized exports and embedded-raster SVGs |
| 02-elements | Signature plus six motifs; transparent PNGs and embedded-raster SVGs |
| 03-backgrounds | Exact Void and Charcoal solid PNGs and true vector SVGs |
| 04-color-and-tokens | Palette JSON/CSV, true vector swatches, design tokens, CSS, typography verification |
| 05-guidelines | PDF guidelines and source analysis |
| 06-source-reference | Unchanged source bytes, exact crops and previous logo exports |
| 07-qa | Visual comparisons, measured extraction error, QA report, unresolved items |

## Names and dimensions

- `--enhanced-master.png`: exact user-approved generation, at its actual generated resolution.
- `--native.png` in elements or previous-logo-exports: original source-extraction resolution; transparent matte approximation.
- `--long-edge-Npx.png`: resized export with longest edge N pixels; other dimension rounded to nearest pixel. Logos are downscaled from approved enhanced masters; supporting elements retain edition-1 source enlargements.
- `--embedded-raster.svg`: self-contained SVG with the applicable PNG master embedded losslessly. These are **not editable vector logo paths**.
- `--source-crop.png`: pixel-exact opaque source crop.
- Background filenames include width × height; source logos are never stretched to a square.

`manifest.json` and `manifest.csv` list every payload file with dimensions, format, intended use, provenance and SHA-256 where applicable. The three root index files (`manifest.json`, `manifest.csv`, `SHA256SUMS.txt`) list themselves without recursive hashes or sizes. `SHA256SUMS.txt` covers all other files, including both manifests.

## Typography and tokens

Uncial Antiqua and Inter are names explicitly specified in the references. Actual rendered font family, style, weight and logo modifications cannot be verified from the rasters. Reckless Neue is provisional; the signature's font is unknown. No font files or inferred font metrics are included. Helvetica in the PDF is documentation typesetting only.

Exact colors are Blood Red #8B1E24; Void #0B0B0B; Charcoal #1F1F1F; Stone #E8E4DE; Dusty Rose #9A6B7A; Moss #3A3E3A. RGB and HSL conversions are provided. Raster shades are preserved rather than forced to these palette values. No numerical spacing tokens are invented.

## Usage and limitations

Keep mark proportions and original wording. Use one main identity mark per placement, clear surrounding space, dark fields and restrained red accents. Inspect at the intended final size. Numeric clear space and minimum sizes are unresolved.

The four active logos are owner-approved generative enhancements. Reconstructed contours, added distress, stroke changes and residual colored/white edge pixels are retained exactly as approved; their artwork is not certified as palette-exact or source-identical. The previous source-derived exports remain for comparison. No additional cleanup was applied after approval.

Supporting elements still use an estimated near-black matte. Faint details may be omitted. Obtain original paths for exact print, embroidery, precision cutting or truly scalable logos. No new palette, guessed font, numeric spacing rule or seamless pattern is introduced.

See `07-qa/unresolved-items.json` for all unresolved details and `07-qa/qa-report.json` for completed checks. View `07-qa/approved-logo-comparison.png` for the updated approved logos on source, dark, light and checker fields. `visual-comparison.png` documents only the original source-extraction edition.

## File integrity

From this folder: `sha256sum -c SHA256SUMS.txt`. SVGs contain no scripts or external dependencies. All source originals are included unchanged. This package grants no additional rights to source photographs or third-party fonts.
