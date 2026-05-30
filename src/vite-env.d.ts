/// <reference types="vite/client" />

interface OverDriveBinsApi {
  getRoot: () => Promise<string>;
  loadAll: () => Promise<Record<string, unknown>>;
  readJson: (relativePath: string) => Promise<unknown>;
  writeJson: (relativePath: string, payload: unknown) => Promise<boolean>;
  writeAttachment: (relativePath: string, dataUrl: string) => Promise<boolean>;
  readAttachment: (relativePath: string) => Promise<string>;
  reset: () => Promise<boolean>;
}

declare global {
  interface Window {
    overDriveBins?: OverDriveBinsApi;
  }
}

export {};
