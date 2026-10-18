# Box

Upload an image, describe or ask about one target, and display Jev's bounding box on the image. Built with React and Bun.

## Run

Create `box/.env` with `JEV_API_KEY` (see `.env.example`), then run from the repository root:

```sh
bun install --frozen-lockfile
bun run --filter jev-box dev
```

Open http://127.0.0.1:4326. Use `PORT` to change the port. The API key is read only by the server.

Choose a PNG or JPEG up to 16 MiB, enter a question such as “Where is the leftmost apple?”, and select **枠で囲む**. Japanese and English questions can both be entered. One run locates one target; distinguish repeated objects by their position or appearance.

The browser applies image orientation, reduces the longest side to at most 1568 pixels, and pads sides smaller than 280 pixels with white. It sends the resulting PNG and displays that exact image so the overlay uses the same coordinates. Transparent pixels are flattened onto white. The image and question are sent to Jev only when the run button is pressed.

## Results

Requests use `jev-1.14.0` and the experimental `TypeSafe-Danger-Zone-Images: true` header. A Noul question checks whether the requested target is visible; a Box question returns one rectangle. Both see the same image and user request.

Box always returns coordinates, even for absent targets. The app draws the box only when presence probability is at least 0.5. This is a prototype display policy, not a vendor-recommended threshold or proof that the target is present. Confidence is shown separately and can be unknown. Details include raw coordinates, model IDs, latency and token usage.

Changing the image or question clears the result. A failed rerun also clears the old box. Images and results are not saved by the app and are lost on reload. Image and Box support are experimental; inspect the overlay against the image.

Official references: [Images](https://docs.typesafe.ai/images), [Box](https://docs.typesafe.ai/primitives/box).

## Checks

```sh
bun run --filter jev-box test
bun run --filter jev-box lint
bun run --filter jev-box fmt:check
bun run --filter jev-box build
```

Tests mock upstream Jev responses; they do not measure localization accuracy.
