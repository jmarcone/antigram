/**
 * Thin async wrapper over yauzl. Opens a ZIP once, indexes entries by
 * filename, and exposes per-entry read helpers. The underlying file stays
 * open until {@link ZipHandle.close} is called — necessary because yauzl
 * streams entries lazily.
 *
 * Why yauzl: the only Node ZIP reader designed for large archives. A 20 GB
 * Meta export can't be loaded into memory (which `adm-zip` does) nor
 * extracted to a temp dir first.
 */

import { Readable } from "node:stream";
import yauzl, { type Entry, type ZipFile } from "yauzl";

export interface ZipHandle {
  readonly path: string;
  /** All file entries, keyed by their forward-slash path inside the ZIP. */
  readonly entries: ReadonlyMap<string, Entry>;
  /** Synchronous list of entry names (useful for discovery). */
  listNames(): string[];
  /** Read a single entry into a buffer. Throws if not found. */
  readEntryBuffer(name: string): Promise<Buffer>;
  /** Open a streaming reader for a single entry. */
  openEntryStream(name: string): Promise<Readable>;
  /** Releases the underlying file handle. Idempotent. */
  close(): Promise<void>;
}

export async function openExportZip(zipPath: string): Promise<ZipHandle> {
  const zipFile = await openZipFile(zipPath);
  const entries = await indexEntries(zipFile);
  let closed = false;

  return {
    path: zipPath,
    entries,
    listNames(): string[] {
      return Array.from(entries.keys());
    },
    async readEntryBuffer(name: string): Promise<Buffer> {
      const stream = await openStream(zipFile, requireEntry(entries, name));
      return streamToBuffer(stream);
    },
    async openEntryStream(name: string): Promise<Readable> {
      return openStream(zipFile, requireEntry(entries, name));
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve) => {
        zipFile.close();
        // yauzl closes synchronously; emit a microtask to give callers a Promise.
        queueMicrotask(resolve);
      });
    },
  };
}

function openZipFile(zipPath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err) return reject(err);
      if (!zip) return reject(new Error(`yauzl returned no zip object for ${zipPath}`));
      resolve(zip);
    });
  });
}

function indexEntries(zip: ZipFile): Promise<Map<string, Entry>> {
  return new Promise((resolve, reject) => {
    const map = new Map<string, Entry>();
    zip.on("entry", (entry: Entry) => {
      // Skip directory placeholders (yauzl uses trailing slash to mark them).
      if (!entry.fileName.endsWith("/")) {
        // Normalize to forward slashes; ZIP spec uses '/', but be safe.
        map.set(entry.fileName.replace(/\\/g, "/"), entry);
      }
      zip.readEntry();
    });
    zip.on("end", () => resolve(map));
    zip.on("error", reject);
    zip.readEntry();
  });
}

function requireEntry(entries: ReadonlyMap<string, Entry>, name: string): Entry {
  const normalized = name.replace(/\\/g, "/");
  const entry = entries.get(normalized);
  if (entry) return entry;
  throw new Error(`ZIP entry not found: ${name}`);
}

function openStream(zip: ZipFile, entry: Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      if (!stream) return reject(new Error(`yauzl returned no stream for ${entry.fileName}`));
      resolve(stream);
    });
  });
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
