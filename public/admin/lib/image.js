// Client-side image pipeline: decode -> fit inside `max` px -> WebP (JPEG when
// the browser cannot encode WebP). Browser only (canvas); not unit-tested.
const TARGET_BYTES = 450 * 1024;

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> */
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("छवि खुल ना पाइल"));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function toBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === "function") return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("छवि खुल ना पाइल"))), type, quality),
  );
}

export async function processImage(file, { max = 1600, quality = 0.82, maxInput = 20 * 1024 * 1024 } = {}) {
  if (!file || !/^image\//.test(file.type)) throw new Error("ई फाइल छवि नइखे");
  if (file.size > maxInput) throw new Error("छवि 20 MB से छोट राखीं");
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error("छवि खुल ना पाइल");
  }
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;
  if (!sw || !sh) throw new Error("छवि खुल ना पाइल");
  const scale = Math.min(1, max / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = makeCanvas(width, height);
  canvas.getContext("2d").drawImage(source, 0, 0, width, height);
  if (typeof source.close === "function") source.close();

  let blob = await toBlob(canvas, "image/webp", quality);
  let ext = "webp";
  if (blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", quality);
    ext = "jpg";
  }
  if (blob.size > TARGET_BYTES) blob = await toBlob(canvas, blob.type, 0.7);
  return {
    blob,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    ext,
    width,
    height,
    oversized: blob.size > TARGET_BYTES,
  };
}
