from pathlib import Path
from PIL import Image, ImageDraw
import math

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
RES = ANDROID / "app" / "src" / "main" / "res"

DARK = "#0B1F3B"
BLUE = "#3B82F6"
LIGHT_BLUE = "#60A5FA"
YELLOW = "#F4B400"
WHITE = "#FFFFFF"
BLACK = "#071427"


def star_points(cx, cy, r1, r2):
    pts = []
    for i in range(8):
        a = math.radians(-90 + i * 45)
        r = r1 if i % 2 == 0 else r2
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def make_icon(size=1024):
    s = size
    im = Image.new("RGB", (s, s), DARK)
    d = ImageDraw.Draw(im)

    # Pilot launcher mark based on the approved Rumevo palette and icon composition.
    d.ellipse((int(.18*s), int(.30*s), int(.82*s), int(.98*s)), fill=BLUE)
    d.ellipse((int(.10*s), int(.22*s), int(.54*s), int(.48*s)), fill=LIGHT_BLUE)
    d.ellipse((int(.27*s), int(.40*s), int(.75*s), int(.69*s)), fill=WHITE)
    d.ellipse((int(.38*s), int(.47*s), int(.44*s), int(.58*s)), fill=BLACK)
    d.ellipse((int(.61*s), int(.46*s), int(.67*s), int(.57*s)), fill=BLACK)
    d.polygon(star_points(.72*s, .22*s, .13*s, .045*s), fill=YELLOW)
    return im


def save_launcher_assets():
    base = make_icon(1024)
    sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, size in sizes.items():
        out = RES / folder
        out.mkdir(parents=True, exist_ok=True)
        for old in out.glob("ic_launcher*.webp"):
            old.unlink()
        img = base.resize((size, size), Image.Resampling.LANCZOS)
        img.save(out / "ic_launcher.png")
        img.save(out / "ic_launcher_round.png")

    adaptive = RES / "mipmap-anydpi-v26"
    if adaptive.exists():
        for old in adaptive.glob("ic_launcher*.xml"):
            old.unlink()


def save_splash():
    canvas = Image.new("RGB", (1024, 1024), DARK)
    mark = make_icon(1024).resize((360, 360), Image.Resampling.LANCZOS)
    canvas.paste(mark, ((1024-360)//2, (1024-360)//2))
    for folder in ["drawable", "drawable-land", "drawable-port"]:
        out = RES / folder
        out.mkdir(parents=True, exist_ok=True)
        canvas.save(out / "splash.png")


def patch_back_button():
    java_file = ANDROID / "app" / "src" / "main" / "java" / "com" / "rumevo" / "app" / "MainActivity.java"
    java_file.parent.mkdir(parents=True, exist_ok=True)
    java = (
        "package com.rumevo.app;\n\n"
        "import android.webkit.WebView;\n"
        "import com.getcapacitor.BridgeActivity;\n\n"
        "public class MainActivity extends BridgeActivity {\n"
        "    @Override\n"
        "    public void onBackPressed() {\n"
        "        WebView webView = getBridge() != null ? getBridge().getWebView() : null;\n"
        "        if (webView != null && webView.canGoBack()) {\n"
        "            webView.goBack();\n"
        "        } else {\n"
        "            super.onBackPressed();\n"
        "        }\n"
        "    }\n"
        "}\n"
    )
    java_file.write_text(java, encoding="utf-8")


def patch_colors():
    colors = RES / "values" / "colors.xml"
    colors.parent.mkdir(parents=True, exist_ok=True)
    xml = (
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
        "<resources>\n"
        "    <color name=\"colorPrimary\">#0B1F3B</color>\n"
        "    <color name=\"colorPrimaryDark\">#0B1F3B</color>\n"
        "    <color name=\"colorAccent\">#F4B400</color>\n"
        "</resources>\n"
    )
    colors.write_text(xml, encoding="utf-8")


if __name__ == "__main__":
    save_launcher_assets()
    save_splash()
    patch_back_button()
    patch_colors()
    print("Rumevo Android pilot branding applied.")
