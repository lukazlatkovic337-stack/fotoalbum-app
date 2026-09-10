import { notFound } from "next/navigation";
import { ALBUM_TYPES } from "@/lib/albumConfig";
import Editor from "@/components/Editor";

export function generateStaticParams() {
  return ALBUM_TYPES.map((t) => ({ type: t.id }));
}

export function generateMetadata({ params }) {
  const type = ALBUM_TYPES.find((t) => t.id === params.type);
  return {
    title: type ? `${type.label} – uređivanje` : "Foto album",
  };
}

export default function EditorPage({ params }) {
  const type = ALBUM_TYPES.find((t) => t.id === params.type);
  if (!type) notFound();
  return <Editor typeId={type.id} />;
}
