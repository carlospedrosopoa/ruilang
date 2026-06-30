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

declare module "https://esm.sh/docx@9.5.0" {
  export const Document: any;
  export const Packer: any;
  export const Paragraph: any;
  export const TextRun: any;
  export const AlignmentType: any;
  export const Header: any;
  export const Footer: any;
  export const PageNumber: any;
  export const BorderStyle: any;
  export const TabStopType: any;
  export const TabStopPosition: any;
  export const Table: any;
  export const TableRow: any;
  export const TableCell: any;
  export const WidthType: any;
  export const ShadingType: any;
  export const VerticalAlign: any;
  export const ImageRun: any;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
