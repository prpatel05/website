/**
 * Minimal intrinsic-size readers for the image formats this site ships as
 * social cards (PNG for the homepage card, WebP for blog cards).
 *
 * Exists so tests can assert share-card dimensions without pulling in an
 * image-processing dependency for what is a header read.
 */

export interface ImageSize {
  width: number;
  height: number;
}

/** IHDR is always the first chunk: width and height are big-endian at byte 16. */
function pngSize(buf: Uint8Array): ImageSize {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function ascii(buf: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...buf.subarray(start, end));
}

/**
 * WebP has three framings and they store the canvas size differently, so all
 * three are handled rather than assuming the encoder we happen to use today.
 */
function webpSize(buf: Uint8Array): ImageSize {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const format = ascii(buf, 12, 16);

  if (format === "VP8 ") {
    // Lossy: 3-byte frame tag, then the 0x9d012a start code, then 14-bit dims.
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }

  if (format === "VP8L") {
    // Lossless: 14 bits of width then 14 bits of height, each stored minus one.
    const bits = view.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (format === "VP8X") {
    // Extended: 24-bit little-endian canvas dimensions, each stored minus one.
    const read24 = (offset: number) =>
      buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16);
    return { width: read24(24) + 1, height: read24(27) + 1 };
  }

  throw new Error(`Unsupported WebP framing: ${format}`);
}

/** Reads intrinsic dimensions from a PNG or WebP buffer. */
export function imageSize(buf: Uint8Array): ImageSize {
  if (ascii(buf, 1, 4) === "PNG") return pngSize(buf);
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") {
    return webpSize(buf);
  }
  throw new Error("Unrecognized image format: expected PNG or WebP");
}
