import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Narrative — PDF Reader with Read-Aloud Tracking" },
      {
        name: "description",
        content:
          "Open a PDF and have it read aloud with a word-by-word highlight that follows the text line by line.",
      },
      { property: "og:title", content: "Narrative — PDF Reader" },
      {
        property: "og:description",
        content:
          "Read-aloud PDF reader with accurate word-by-word highlight tracking, summaries and focus timer.",
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
      src="/reader.html"
      title="Narrative PDF Reader"
      className="h-screen w-screen border-0"
      allow="microphone; autoplay; clipboard-write"
    />
  );
}
