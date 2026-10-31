"""Download the graphics libraries MediaPipe's Linux build loads.

Render's free Python image is Debian 12 and does not include libEGL.so.1 or
libGLESv2.so.2. MediaPipe is linked against those exact names. The three
Debian packages below are the small GLVND dispatch libraries, not the Mesa
driver stack.
"""

import io
import sys
import tarfile
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
LIB_DIR = ROOT / "vendor" / "libs"
MIRROR = "https://deb.debian.org/debian"
PACKAGES = ("libglvnd0", "libegl1", "libgles2")
REQUIRED = ("libGLdispatch.so.0", "libEGL.so.1", "libGLESv2.so.2")


def ensure_graphics_libs() -> None:
    if sys.platform != "linux":
        print(f"skip graphics libraries on {sys.platform}")
        return
    if all((LIB_DIR / name).is_file() and (LIB_DIR / name).stat().st_size > 10_000 for name in REQUIRED):
        print(f"present {LIB_DIR}")
        return
    LIB_DIR.mkdir(parents=True, exist_ok=True)
    for filename in _package_filenames():
        print(f"download {filename}")
        with urlopen(f"{MIRROR}/{filename}", timeout=120) as response:
            payload = response.read()
        _extract_shared_libraries(payload, LIB_DIR)
    missing = [name for name in REQUIRED if not (LIB_DIR / name).is_file()]
    if missing:
        raise SystemExit(f"graphics libraries were not extracted: {', '.join(missing)}")
    for name in REQUIRED:
        path = LIB_DIR / name
        print(f"saved {path} ({path.stat().st_size} bytes)")


def _package_filenames() -> list[str]:
    index_url = f"{MIRROR}/dists/bookworm/main/binary-amd64/Packages.gz"
    import gzip

    with urlopen(index_url, timeout=120) as response:
        text = gzip.decompress(response.read()).decode("utf-8", "replace")
    found: dict[str, str] = {}
    for block in text.split("\n\n"):
        fields: dict[str, str] = {}
        key = None
        for line in block.splitlines():
            if line.startswith(" ") and key:
                fields[key] += " " + line.strip()
            elif ": " in line:
                key, value = line.split(": ", 1)
                fields[key] = value
        name = fields.get("Package")
        filename = fields.get("Filename")
        if name in PACKAGES and filename:
            found[name] = filename
    missing = [name for name in PACKAGES if name not in found]
    if missing:
        raise SystemExit(f"Debian bookworm is missing packages: {', '.join(missing)}")
    return [found[name] for name in PACKAGES]


def _extract_shared_libraries(payload: bytes, destination: Path) -> None:
    archive = _data_tarball(payload)
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:*") as tar:
        for member in tar.getmembers():
            if not member.isfile() or ".so" not in Path(member.name).name:
                continue
            extracted = tar.extractfile(member)
            if extracted is None:
                continue
            blob = extracted.read()
            soname = _soname(blob)
            if soname not in REQUIRED:
                continue
            (destination / soname).write_bytes(blob)


def _data_tarball(payload: bytes) -> bytes:
    if not payload.startswith(b"!<arch>\n"):
        raise SystemExit("Debian package did not start with an archive header.")
    position = 8
    while position + 60 <= len(payload):
        header = payload[position : position + 60]
        name = header[:16].decode("ascii", "replace").strip()
        size = int(header[48:58].decode("ascii").strip())
        body = payload[position + 60 : position + 60 + size]
        if name.startswith("data.tar"):
            return body
        position += 60 + size
        if position % 2:
            position += 1
    raise SystemExit("Debian package did not contain data.tar.")


def _soname(data: bytes) -> str | None:
    if data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
        return None
    section_offset = int.from_bytes(data[40:48], "little")
    section_size = int.from_bytes(data[58:60], "little")
    section_count = int.from_bytes(data[60:62], "little")
    names_index = int.from_bytes(data[62:64], "little")

    def section(index: int) -> tuple[int, int, int]:
        start = section_offset + index * section_size
        name_offset = int.from_bytes(data[start : start + 4], "little")
        offset = int.from_bytes(data[start + 24 : start + 32], "little")
        size = int.from_bytes(data[start + 32 : start + 40], "little")
        return name_offset, offset, size

    _, names_offset, names_size = section(names_index)
    names = data[names_offset : names_offset + names_size]
    dynamic = dynstr = None
    for index in range(section_count):
        name_offset, offset, size = section(index)
        name = names[name_offset:].split(b"\x00", 1)[0]
        blob = data[offset : offset + size]
        if name == b".dynamic":
            dynamic = blob
        elif name == b".dynstr":
            dynstr = blob
    if dynamic is None or dynstr is None:
        return None
    for cursor in range(0, len(dynamic), 16):
        tag = int.from_bytes(dynamic[cursor : cursor + 8], "little", signed=True)
        value = int.from_bytes(dynamic[cursor + 8 : cursor + 16], "little")
        if tag == 0:
            break
        if tag == 14:
            return dynstr[value:].split(b"\x00", 1)[0].decode("ascii", "replace")
    return None


if __name__ == "__main__":
    try:
        ensure_graphics_libs()
    except Exception as exc:
        print(f"graphics library download failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
