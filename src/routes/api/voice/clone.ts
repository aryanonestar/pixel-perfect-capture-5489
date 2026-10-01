import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 11 * 1024 * 1024;

export const Route = createFileRoute("/api/voice/clone")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return Response.json({ error: "Voice cloning is not set up yet." }, { status: 503 });
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Invalid upload." }, { status: 400 });
        }
        const file = form.get("file");
        const name = String(form.get("name") || "My voice").slice(0, 60) || "My voice";
        if (!(file instanceof File) || !file.type.startsWith("audio/") || file.size === 0 || file.size > MAX_BYTES) {
          return Response.json({ error: "Please upload an audio file under 10 MB." }, { status: 400 });
        }
        const fd = new FormData();
        fd.append("files", file, file.name || "sample.mp3");
        fd.append("name", name);
        const r = await fetch("https://api.elevenlabs.io/v1/voices/add", {
          method: "POST",
          headers: { "xi-api-key": key },
          body: fd,
        });
        if (!r.ok) {
          const body = await r.text();
          console.error(`ElevenLabs clone failed [${r.status}]: ${body}`);
          let msg = "Voice cloning failed.";
          try {
            const j = JSON.parse(body);
            msg = j?.detail?.message || j?.detail || msg;
          } catch {}
          return Response.json({ error: String(msg) }, { status: r.status });
        }
        const d = await r.json();
        return Response.json({ voiceId: d.voice_id });
      },
    },
  },
});
