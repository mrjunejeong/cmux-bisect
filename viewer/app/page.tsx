import { promises as fs } from "node:fs";
import path from "node:path";
import Viewer, { type Status } from "./Viewer";

// Server component — reads frozen demo at build/request time.
// Why: SSR ships actual data in the first byte so the page never flashes
// an empty/loading state. The client side then takes over with SWR for
// any live updates (when `viewer/public/demo-status.json` changes locally).
async function loadInitialStatus(): Promise<Status> {
  const filePath = path.join(process.cwd(), "public", "demo-status.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

export default async function Page() {
  const initial = await loadInitialStatus();
  return <Viewer initialData={initial} />;
}
