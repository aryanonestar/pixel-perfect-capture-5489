import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  voiceId: z.string().regex(/^[A-Za-z0-9]{8,40}$/),
  text: z.string().min(1).max(2500),
});

export const Route = createFileRoute("/api/voice/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return Response.json({ error: "Voice is not set up yet." }, { status: 503 });
        let b;
        try {
          b = Body.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }
        const r = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${b.voiceId}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
            body: JSON.stringify({
              text: b.text,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          },
        );
        if (!r.ok || !r.body) {
          const body = await r.text();
          console.error(`ElevenLabs TTS failed [${r.status}]: ${body}`);
          return Response.json({ error: "Voice generation failed." }, { status: r.status || 502 });
        }
        return new Response(r.body, { headers: { "Content-Type": "audio/mpeg" } });
      },
    },
  },
});
