import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { FileStorage } from './file-storage';

/** Files on a local directory — in Docker, a volume shared by the API and the worker. */
export class LocalDiskStorage extends FileStorage {
  private readonly root: string;

  constructor(rootDir: string) {
    super();
    this.root = resolve(rootDir);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    // Defence in depth: keys are generated server-side, but never escape the root.
    if (!path.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return path;
  }
}
