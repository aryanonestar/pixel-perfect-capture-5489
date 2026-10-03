import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Narrative — Cinematic PDF Reader with Spatial Intelligence" },
      {
        name: "description",
        content:
          "AI-powered PDF reader with pixel-perfect word tracking, voice cloning, multi-engine speech synthesis, and intelligent page summaries.",
      },
      { property: "og:title", content: "Narrative — Cinematic PDF Reader" },
      {
        property: "og:description",
        content:
          "Read-aloud PDF reader with cinematic 3D interface, accurate word-by-word highlight tracking, AI summaries and focus timer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/homepage.html"
      title="Narrative PDF Reader"
      className="h-screen w-screen border-0"
      allow="microphone; autoplay; clipboard-write"
    />
  );
}
