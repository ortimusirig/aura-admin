import { createFileRoute } from '@tanstack/react-router';
import { Embed } from '@/aura';

export const Route = createFileRoute('/_app/tools/$id')({
  component: ToolRoute,
});

function ToolRoute() {
  const { id } = Route.useParams();
  return <Embed id={id} />;
}
