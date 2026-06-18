/// <reference types="vite/client" />

interface DadBinsApi {
  getRoot: () => Promise<string>;
  loadAll: (profileId?: string) => Promise<Record<string, unknown>>;
  readJson: (relativePath: string) => Promise<unknown>;
  writeJson: (relativePath: string, payload: unknown) => Promise<boolean>;
  writeAttachment: (relativePath: string, dataUrl: string) => Promise<boolean>;
  readAttachment: (relativePath: string) => Promise<string>;
  reset: (profileId?: string) => Promise<boolean>;
  deleteProfileWorkspace: (profileId: string) => Promise<boolean>;
}

declare global {
  interface Window {
    overDriveBins?: DadBinsApi;
  }
}

export {};
