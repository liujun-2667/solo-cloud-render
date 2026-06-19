// Compact self-contained GIF89a encoder with a 216-color web-safe palette and
// variable-length LZW compression. No external dependencies.

const PALETTE_SIZE = 216; // 6^3 web-safe colors

function buildPalette(): Uint8Array {
  const table = new Uint8Array(256 * 3);
  let i = 0;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        table[i++] = r * 51;
        table[i++] = g * 51;
        table[i++] = b * 51;
      }
    }
  }
  return table;
}

const PALETTE = buildPalette();

/** Map an RGBA byte buffer to 216-color web-safe indexed pixels. */
export function quantizeToIndexed(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    const a = rgba[p + 3];
    // Transparent pixels map to index 0 (treated as background).
    if (a < 16) {
      out[i] = 0;
      continue;
    }
    const qR = Math.min(5, Math.round(r / 51));
    const qG = Math.min(5, Math.round(g / 51));
    const qB = Math.min(5, Math.round(b / 51));
    out[i] = qR * 36 + qG * 6 + qB;
  }
  return out;
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private current: number[] = [];
  pushByte(b: number): void {
    this.current.push(b & 0xff);
    if (this.current.length >= 4096) this.flush();
  }
  pushBytes(arr: ArrayLike<number>): void {
    for (let i = 0; i < arr.length; i++) this.pushByte(arr[i]);
  }
  pushString(s: string): void {
    for (let i = 0; i < s.length; i++) this.pushByte(s.charCodeAt(i));
  }
  private flush(): void {
    if (this.current.length) {
      this.chunks.push(new Uint8Array(this.current));
      this.current = [];
    }
  }
  toUint8Array(): Uint8Array {
    this.flush();
    let total = 0;
    for (const c of this.chunks) total += c.length;
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
}

function lzwEncode(pixels: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const dict = new Map<number, number>();

  const out: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;

  const emit = (code: number) => {
    bitBuf |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuf & 0xff);
      bitBuf >>>= 8;
      bitCount -= 8;
    }
  };

  const reset = () => {
    dict.clear();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  emit(clearCode);
  if (pixels.length === 0) {
    emit(eoiCode);
    if (bitCount > 0) out.push(bitBuf & 0xff);
    return new Uint8Array(out);
  }

  let w = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const c = pixels[i];
    const key = (w << 8) | c;
    const found = dict.get(key);
    if (found !== undefined) {
      w = found;
    } else {
      emit(w);
      if (nextCode < 4096) {
        dict.set(key, nextCode);
        nextCode++;
        if (nextCode === (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        emit(clearCode);
        reset();
      }
      w = c;
    }
  }
  emit(w);
  emit(eoiCode);
  if (bitCount > 0) out.push(bitBuf & 0xff);
  return new Uint8Array(out);
}

function writeSubBlocks(writer: ByteWriter, data: Uint8Array): void {
  for (let i = 0; i < data.length; i += 255) {
    const len = Math.min(255, data.length - i);
    writer.pushByte(len);
    writer.pushBytes(data.subarray(i, i + len));
  }
  writer.pushByte(0); // block terminator
}

export interface GifFrame {
  indexed: Uint8Array;
  width: number;
  height: number;
  delayCs: number; // hundredths of a second
}

export function encodeGif(frames: GifFrame[], loop = 0): Blob {
  if (frames.length === 0) throw new Error("No frames to encode.");
  const width = frames[0].width;
  const height = frames[0].height;
  const writer = new ByteWriter();

  // Header + Logical Screen Descriptor.
  writer.pushString("GIF89a");
  writer.pushByte(width & 0xff);
  writer.pushByte((width >> 8) & 0xff);
  writer.pushByte(height & 0xff);
  writer.pushByte((height >> 8) & 0xff);
  // Packed: global color table = 1, color resolution = 7, sort = 0, GCT size = 7 (256 entries)
  writer.pushByte(0b11110111);
  writer.pushByte(0); // background color index
  writer.pushByte(0); // pixel aspect ratio

  // Global Color Table (256 entries).
  writer.pushBytes(PALETTE);
  for (let i = PALETTE_SIZE * 3; i < 256 * 3; i++) writer.pushByte(0);

  // Netscape looping extension.
  writer.pushByte(0x21);
  writer.pushByte(0xff);
  writer.pushByte(0x0b);
  writer.pushString("NETSCAPE2.0");
  writer.pushByte(0x03);
  writer.pushByte(0x01);
  writer.pushByte(loop & 0xff);
  writer.pushByte((loop >> 8) & 0xff);
  writer.pushByte(0x00);

  const minCodeSize = 7; // codes 0..215 + clear/eoi fit; use 7-bit min -> clear=128? No.
  // We need minCodeSize such that 2^minCodeSize > max index (215). 2^7=128 < 216, so use 8.
  const mcs = 8;

  for (const frame of frames) {
    // Graphic Control Extension.
    writer.pushByte(0x21);
    writer.pushByte(0xf9);
    writer.pushByte(0x04);
    writer.pushByte(0x00); // packed (no transparency)
    writer.pushByte(frame.delayCs & 0xff);
    writer.pushByte((frame.delayCs >> 8) & 0xff);
    writer.pushByte(0x00); // transparent color index
    writer.pushByte(0x00); // block terminator

    // Image Descriptor.
    writer.pushByte(0x2c);
    writer.pushByte(0);
    writer.pushByte(0);
    writer.pushByte(0);
    writer.pushByte(0);
    writer.pushByte(frame.width & 0xff);
    writer.pushByte((frame.width >> 8) & 0xff);
    writer.pushByte(frame.height & 0xff);
    writer.pushByte((frame.height >> 8) & 0xff);
    writer.pushByte(0x00); // no local color table, not interlaced

    // Image data.
    writer.pushByte(mcs);
    const compressed = lzwEncode(frame.indexed, mcs);
    writeSubBlocks(writer, compressed);
  }

  writer.pushByte(0x3b); // trailer

  return new Blob([writer.toUint8Array()], { type: "image/gif" });
}
