Icons
=====

Tauri bundles platform-specific icons. Generate them into this folder before building packages:

1) Prepare a square source image at least 512x512 (PNG or SVG), e.g. `assets/app-icon.png`.
2) Run:

   npm run tauri:icon -- assets/app-icon.png

This will create files like:

- icons/icon.icns (macOS)
- icons/icon.ico (Windows)
- icons/32x32.png, 128x128.png, 256x256.png (Linux/AppImage)

The bundler is configured in `src-tauri/tauri.conf.json` to pick up these files.

