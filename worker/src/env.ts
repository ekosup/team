export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_API_KEY: string;
  DOCS_ENC_KEY: string;
};

export type Variables = {
  managerId: string;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
