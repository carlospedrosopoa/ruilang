/// <reference types="vite/client" />

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: unknown,
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  export const createClient: any;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
