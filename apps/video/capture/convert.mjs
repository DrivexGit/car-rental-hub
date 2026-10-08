// Converts the recorded .webm clips to .mp4 with many keyframes: Remotion seeks into them much faster than into webm.
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "clips");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".webm"))) {
  const out = f.replace(/\.webm$/, ".mp4");
  execFileSync("npx", ["remotion", "ffmpeg", "-y", "-i", join(dir, f), "-c:v", "libx264", "-crf", "14", "-g", "15", "-pix_fmt", "yuv420p", "-an", join(dir, out)], { stdio: "ignore", shell: true });
  console.log(out);
}
