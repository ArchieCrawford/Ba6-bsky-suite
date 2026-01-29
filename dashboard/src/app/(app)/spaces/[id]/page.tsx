import { redirect } from "next/navigation";

export default function SpaceIndexPage({ params }: { params: { id: string } }) {
  redirect(`/spaces/${params.id}/chat`);
}
