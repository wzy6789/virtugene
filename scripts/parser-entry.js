import fs from 'fs';
import path from 'path';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';

// Expose the worker message handler on the main thread so pdfjs-dist runs its
// "fake worker" in-process instead of trying to dynamically import a separate
// pdf.worker.mjs file (which wouldn't exist next to this single-file bundle).
globalThis.pdfjsWorker = { WorkerMessageHandler: pdfjsWorker.WorkerMessageHandler };

// pdfjs-dist evaluates `new DOMMatrix()` at module load (even for text-only
// extraction). @napi-rs/canvas normally supplies it, but that native module is
// intentionally excluded from this on-demand bundle. Provide a minimal
// polyfill so PDF text extraction works without a canvas dependency.
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
      if (init == null) return;
      if (typeof init === 'string') {
        const m = init.match(/matrix\(([^)]+)\)/);
        if (m) {
          const [a, b, c, d, e, f] = m[1].split(',').map(Number);
          if ([a, b, c, d, e, f].every((n) => Number.isFinite(n))) {
            this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
          }
        }
        return;
      }
      const arr = Array.isArray(init) || ArrayBuffer.isView(init)
        ? Array.from(init).map(Number)
        : null;
      if (!arr) return;
      if (arr.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = arr;
      } else if (arr.length === 16) {
        [this.m11, this.m12, this.m13, this.m14] = arr.slice(0, 4);
        [this.m21, this.m22, this.m23, this.m24] = arr.slice(4, 8);
        [this.m31, this.m32, this.m33, this.m34] = arr.slice(8, 12);
        [this.m41, this.m42, this.m43, this.m44] = arr.slice(12, 16);
        this.a = this.m11; this.b = this.m12; this.c = this.m21; this.d = this.m22;
        this.e = this.m41; this.f = this.m42;
      }
    }
    multiply(other) {
      const o = other instanceof DOMMatrix
        ? [other.a, other.b, other.c, other.d, other.e, other.f]
        : Array.from(other).map(Number);
      const [a, b, c, d, e, f] = [this.a, this.b, this.c, this.d, this.e, this.f];
      const [a2, b2, c2, d2, e2, f2] = o;
      return new DOMMatrix([
        a * a2 + c * b2, b * a2 + d * b2,
        a * c2 + c * d2, b * c2 + d * d2,
        a * e2 + c * f2 + e, b * e2 + d * f2 + f,
      ]);
    }
    translate(x, y) {
      return this.multiply([1, 0, 0, 1, x, y]);
    }
    scale(sx, sy) {
      return this.multiply([sx, 0, 0, sy, 0, 0]);
    }
    multiplySelf(other) {
      const m = this.multiply(other);
      [this.a, this.b, this.c, this.d, this.e, this.f] = [m.a, m.b, m.c, m.d, m.e, m.f];
      return this;
    }
    preMultiplySelf(other) {
      const o = other instanceof DOMMatrix ? other : new DOMMatrix(other);
      const m = o.multiply(this);
      [this.a, this.b, this.c, this.d, this.e, this.f] = [m.a, m.b, m.c, m.d, m.e, m.f];
      return this;
    }
    invertSelf() {
      const [a, b, c, d, e, f] = [this.a, this.b, this.c, this.d, this.e, this.f];
      const det = a * d - b * c;
      if (!det) return this;
      [this.a, this.b, this.c, this.d] = [d / det, -b / det, -c / det, a / det];
      this.e = (c * f - d * e) / det;
      this.f = (b * e - a * f) / det;
      return this;
    }
  }
  globalThis.DOMMatrix = DOMMatrix;
}

export async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.txt':
      return fs.readFileSync(filePath, 'utf-8').slice(0, 10000);
    case '.pdf': {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: fs.readFileSync(filePath), disableWorker: true });
      const result = await parser.getText();
      return (result.text ?? '').slice(0, 10000);
    }
    case '.docx': {
      const mod = await import('mammoth');
      const mammoth = mod.default ?? mod;
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value.slice(0, 10000);
    }
    default:
      throw new Error(`不支持的文件格式: ${ext}`);
  }
}
