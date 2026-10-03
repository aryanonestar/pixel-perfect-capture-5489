import { createFileRoute } from "@tanstack/react-router";
import { head } from "@vercel/blob";
import { z } from "zod";

function hashPin(pin: string): string {
  let h = 5381;
  for (const c of pin) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

const Body = z.object({
  code: z.string().regex(/^\d{4}$/),
  pin: z.string().regex(/^\d{4}$/),
});

export const Route = createFileRoute("/api/cloud-access")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["BLOB_READ_WRITE_TOKEN"];
        if (!token) {
          return Response.json(
            { error: "Cloud storage is not configured on this server." },
            { status: 503 },
          );
        }

        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request body." }, { status: 400 });
        }

        const { code, pin } = body;

        // Derive the Vercel Blob public base URL from the token's store ID
        // Token format: vercel_blob_rw_<storeId>_<secret>
        const storeIdMatch = token.match(/vercel_blob_rw_([^_]+)_/);
        if (!storeIdMatch) {
          return Response.json({ error: "Misconfigured blob token." }, { status: 500 });
        }
        const storeId = storeIdMatch[1]!.toLowerCase();
        const baseUrl = `https://${storeId}.public.blob.vercel-storage.com`;
        const metaUrl = `${baseUrl}/cloud-read/meta-${code}.json`;

        // Fetch the metadata blob
        let meta: {
          code: string;
          pinHash: string;
          name: string;
          pdfUrl: string;
          expires: number;
          uploadedAt: number;
        };

        try {
          const metaRes = await fetch(metaUrl);
          if (!metaRes.ok) {
            return Response.json(
              { error: "Code not found. Double-check the access code." },
              { status: 404 },
            );
          }
          meta = await metaRes.json();
        } catch {
          return Response.json(
            { error: "Could not reach cloud storage. Try again." },
            { status: 502 },
          );
        }

        // TTL check
        if (Date.now() > meta.expires) {
          return Response.json(
            { error: "This PDF has expired (7-day limit reached)." },
            { status: 410 },
          );
        }

        // PIN check
        if (hashPin(pin) !== meta.pinHash) {
          return Response.json({ error: "Incorrect PIN." }, { status: 403 });
        }

        // All good — return the public PDF URL and filename
        return Response.json({ pdfUrl: meta.pdfUrl, name: meta.name });
      },
    },
  },
});
