/**
 * Minimal intrinsic-size readers for the image formats this site ships: PNG
 * for the homepage card, JPEG for the per-post cards, WebP for the masters
 * those cards are derived from and for everything the page itself paints.
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

/**
 * JPEG keeps its dimensions in whichever start-of-frame marker the encoder
 * chose (baseline SOF0, progressive SOF2, and others), so this walks the
 * segment chain rather than assuming a fixed offset. mozjpeg — what the social
 * cards are encoded with — emits SOF2.
 */
function jpegSize(buf: Uint8Array): ImageSize {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 2; // past SOI

  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      throw new Error("Malformed JPEG: expected a marker");
    }

    const marker = buf[offset + 1];

    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // Every SOFn except the DHT/JPG/DAC holes at C4, C8 and CC.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrameHeader) {
      // length(2) + precision(1), then height then width, both big-endian.
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }

    offset += 2 + view.getUint16(offset + 2);
  }

  throw new Error("Malformed JPEG: no start-of-frame marker");
}

/** Reads intrinsic dimensions from a PNG, WebP or JPEG buffer. */
export function imageSize(buf: Uint8Array): ImageSize {
  if (ascii(buf, 1, 4) === "PNG") return pngSize(buf);
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") {
    return webpSize(buf);
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(buf);
  throw new Error("Unrecognized image format: expected PNG, WebP or JPEG");
}
