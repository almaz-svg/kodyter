# Anasym website image sources

## Update 2026-11-10: processed photo set

All site photos were replaced with the 84 processed photos from the project folder `обработанные/`. The file names were kept, so existing references still resolve:

- `hero.webp`: photo #32 (baguette), cropped to 16:9 and saved at 1672 × 941.
- `croissant`, `cake`, `tart`, `buns`, `catering`, `baker` `.webp`: 512 × 512 crops of photos #05, #11, #06, #15, #79, #20.
- `catalog/pdf-01…10-*.webp`: demo products from `backend/shop/data/pdf_catalog_20261017.json`, 800 × 800, photos #64, #16, #65, #82, #45, #49, #63, #77, #62, #35.
- `catalog/card-01…48.webp` and `catalog/v2/card-01…05.webp`: overwritten with the remaining photos, 800 × 800.
- `catalog/card-49…62.webp`: 14 new files. No product references them yet.

The original generated images remain in git history.

## Original generation (2026-10-15)

Created 2026-10-15 with the built-in image_gen tool. All final assets are generated editorial bakery imagery; no external stock service or remote runtime image dependency is used. The provided phone/laptop references informed only the palette and subject styling, and are not embedded or copied into these images.

## Assets

- `hero.webp`: landscape croissant still life; generated 1672 × 941; WebP quality 87.
- `croissant.webp`, `cake.webp`, `tart.webp`, `buns.webp`, `catering.webp`, `baker.webp`: 512 × 512 individual crops from the exact 3 × 2 generated contact sheet; WebP quality 88.

Original generations remain in `C:/Users/Lenovo/.codex/generated_images/01a140a1-3188-7222-877e-7a77323a7194/`. All production images are copied into this workspace as optimized WebPs.

## Prompt set

### hero

Use case: photorealistic-natural. Asset type: premium artisan bakery website full-bleed hero photograph, landscape 16:9. Photograph only, not a webpage or device mockup. Create an exquisitely realistic still life of three large handmade French croissants with shiny golden-brown laminated layers, arranged on a rustic dark walnut board in the RIGHT TWO THIRDS of frame. One foreground croissant should be exceptionally detailed. Small bowl of raspberries and blueberries partially visible behind, linen napkin, a few pastry flakes. LEFT THIRD MUST BE EMPTY very dark deep forest green smooth shadow with subtle background texture, usable for cream website headline. Palette deep evergreen, buttery gold, muted warm brown, restrained cream. Warm soft window light from upper right, rich shadows, low-key editorial food photograph, shallow depth of field, bakery craftsmanship. No words, text, lettering, logo, watermark, borders, phones, laptops, website UI, graphics, or human hands. Generate the image and provide the saved image file path.

### categories

Use case: photorealistic-natural. Asset type: a clean 3-column by 2-row image contact sheet of SIX premium artisan bakery editorial photographs. Exactly six equally sized rectangular panels in a seamless precise grid, no gaps or borders; all outer edges fully filled with photos; landscape total ratio 3:2 so each photo panel is square. Each panel independently photographed, no object crosses a panel boundary. Panel order LEFT TO RIGHT, TOP ROW: (1) richly golden buttery laminated croissants piled on rustic walnut board, (2) round small cream layer cake with fresh raspberries blueberries strawberries and white rustic buttercream, (3) elegant golden fruit tart with red berries and tiny choux pastry details. BOTTOM ROW LEFT TO RIGHT: (4) freshly baked round savory buns, triangular samsa and small golden pies with sesame, (5) elegant catered selection of small canapés, mini tartlets and petit fours on a dark wooden tray, (6) cropped torso and two natural human hands of an artisan baker in dark forest green apron dusting flour from a fine sieve onto fresh croissants on a wooden work surface; face not visible. Consistent rich warm bakery photography, soft directional window light, deep forest green shadowed background, natural golden-brown pastry, realistic crisp delicious texture, shallow depth of field. Each pastry centered and fully in its own panel. All six are full photos without text, labels, letters, logos, watermark, mockups, devices or website elements. Generate the image and provide the saved image file path.
