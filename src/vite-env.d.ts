/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly MASSIVE_API_KEY?: string;
  readonly MASSIVE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
