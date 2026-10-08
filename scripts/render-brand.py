"""Render brand PNGs from the HTML templates in assets/brand/ using Playwright (Edge).

Outputs (committed under public/):
  public/apple-touch-icon.png  180x180
  public/og-default.png        1200x630
  public/favicon.ico           32x32 (single PNG-in-ICO image)

Usage (from repo root, with a Python that has playwright installed):
  python scripts/render-brand.py
"""
from __future__ import annotations

import os
import struct
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
PUBLIC = ROOT / "public"
FONTS_DIR = ROOT / "node_modules" / "@fontsource"


def file_url(path: Path) -> str:
    return path.resolve().as_uri()


def write_ico_from_png(png_bytes: bytes, out: Path, size: int = 32) -> None:
    """Wrap one PNG into a valid .ico (ICONDIR + one ICONDIRENTRY + PNG payload)."""
    header = struct.pack("<HHH", 0, 1, 1)  # reserved, type=icon, count=1
    offset = 6 + 16
    entry = struct.pack(
        "<BBBBHHII",
        size if size < 256 else 0,  # width (0 means 256)
        size if size < 256 else 0,  # height
        0,  # colour palette
        0,  # reserved
        1,  # colour planes
        32,  # bits per pixel
        len(png_bytes),
        offset,
    )
    out.write_bytes(header + entry + png_bytes)


def main() -> int:
    if not FONTS_DIR.exists():
        print("node_modules/@fontsource not found; run npm install first", file=sys.stderr)
        return 1

    og_html = (BRAND / "og-template.html").read_text(encoding="utf-8").replace(
        "__FONTS__", file_url(FONTS_DIR)
    )
    icon_html = (BRAND / "icon-template.html").read_text(encoding="utf-8")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        og_path = tmp_dir / "og.html"
        icon_path = tmp_dir / "icon.html"
        og_path.write_text(og_html, encoding="utf-8")
        icon_path.write_text(icon_html, encoding="utf-8")

        with sync_playwright() as p:
            browser = p.chromium.launch(channel="msedge", headless=True)

            # OG image 1200x630
            ctx = browser.new_context(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
            page = ctx.new_page()
            page.goto(file_url(og_path))
            page.evaluate("document.fonts.ready.then(() => true)")
            page.wait_for_function("Array.from(document.fonts).every(f => f.status === 'loaded')")
            page.wait_for_timeout(800)
            page.screenshot(
                path=str(PUBLIC / "og-default.png"),
                clip={"x": 0, "y": 0, "width": 1200, "height": 630},
            )
            ctx.close()

            # Apple touch icon 180x180
            ctx = browser.new_context(viewport={"width": 180, "height": 180}, device_scale_factor=1)
            page = ctx.new_page()
            page.goto(file_url(icon_path))
            page.wait_for_timeout(200)
            page.screenshot(
                path=str(PUBLIC / "apple-touch-icon.png"),
                clip={"x": 0, "y": 0, "width": 180, "height": 180},
            )
            ctx.close()

            # 32x32 PNG for favicon.ico (same template, scaled via CSS zoom)
            ctx = browser.new_context(viewport={"width": 32, "height": 32}, device_scale_factor=1)
            page = ctx.new_page()
            page.goto(file_url(icon_path))
            page.add_style_tag(content=".icon{width:32px;height:32px} svg{width:28px;height:28px}")
            page.wait_for_timeout(200)
            png32 = page.screenshot(clip={"x": 0, "y": 0, "width": 32, "height": 32})
            ctx.close()
            browser.close()

    write_ico_from_png(png32, PUBLIC / "favicon.ico", 32)
    for name in ("og-default.png", "apple-touch-icon.png", "favicon.ico"):
        print(f"wrote public/{name} ({os.path.getsize(PUBLIC / name)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
