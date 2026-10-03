import { createFileRoute } from "@tanstack/react-router";
import { put } from "@vercel/blob";

// djb2 hash — same algo used client-side so codes are verifiable without plaintext storage
function hashPin(pin: string): string {
  let h = 5381;
  for (const c of pin) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

function genCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getBlobToken(): string | undefined {
  if (process.env["BLOB_READ_WRITE_TOKEN"]) return process.env["BLOB_READ_WRITE_TOKEN"];
  for (const [key, val] of Object.entries(process.env)) {
    if (val && (key.endsWith("_READ_WRITE_TOKEN") || val.startsWith("vercel_blob_rw_"))) {
      return val;
    }
  }
  return undefined;
}

export const Route = createFileRoute("/api/cloud-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = getBlobToken();
        if (!token) {
          return Response.json(
            { error: "Cloud storage is not configured on this server." },
            { status: 503 },
          );
        }

        // Parse multipart form: fields "pin" + file "pdf"
        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return Response.json({ error: "Invalid form data." }, { status: 400 });
        }

        const pin = formData.get("pin");
        const pdfFile = formData.get("pdf");

        if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
          return Response.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
        }
        if (!(pdfFile instanceof File) || pdfFile.size === 0) {
          return Response.json({ error: "No PDF file provided." }, { status: 400 });
        }
        if (pdfFile.size > 30 * 1024 * 1024) {
          return Response.json({ error: "PDF must be under 30 MB." }, { status: 413 });
        }

        const code = genCode();
        const pinHash = hashPin(pin);
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        try {
          // 1. Upload the PDF blob
          const pdfBlob = await put(`cloud-read/pdf-${code}.pdf`, pdfFile, {
            access: "public",
            token,
            addRandomSuffix: false,
            // Vercel Blob doesn't support expiresAt on PUT yet — we track TTL in metadata
          });

          // 2. Upload a tiny metadata JSON alongside it
          const meta = JSON.stringify({
            code,
            pinHash,
            name: pdfFile.name,
            pdfUrl: pdfBlob.url,
            expires: expires.getTime(),
            uploadedAt: Date.now(),
          });

          await put(`cloud-read/meta-${code}.json`, new Blob([meta], { type: "application/json" }), {
            access: "public",
            token,
            addRandomSuffix: false,
          });

          return Response.json({ code, expires: expires.getTime() });
        } catch (err: unknown) {
          console.error("[cloud-upload] Vercel Blob error:", err);
          const errMessage = err instanceof Error ? err.message : String(err);
          let userError = "Failed to upload to cloud storage.";
          if (errMessage.includes("private store")) {
            userError = "Vercel Blob store is configured as Private. Please create a Public Blob store in Vercel and update BLOB_READ_WRITE_TOKEN.";
          } else if (errMessage) {
            userError = errMessage;
          }
          return Response.json({ error: userError }, { status: 502 });
        }
      },
    },
  },
});
