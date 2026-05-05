import { HomePage } from "@/components/home/home-page";

async function getWorkspaces() {
  const serverUrl = process.env.SERVER_URL || "http://localhost:3100";
  const res = await fetch(`${serverUrl}/api/workspaces`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function Page() {
  const workspaces = await getWorkspaces();
  return <HomePage initialWorkspaces={workspaces} />;
}
