import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Vazirmatn";
import { FPS, INTRO, OUTRO, SCENES, SPEED, type Cap } from "./script";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "800"], subsets: ["arabic", "latin"] });

export type Mark = { t: number; kind: "click" | "hover" | "view"; label: string; box?: { x: number; y: number; width: number; height: number } };
export type Clip = { id: string; start: number; duration: number; view: { width: number; height: number }; marks: Mark[] };
export type TutorialProps = { clips: Clip[] };

// Brand (green theme of the app). The accent is only for highlights.
const BRAND = "#1f4d2f", BRAND_DARK = "#0b1a11", ACCENT = "#ffc83d";
const WIN_W = 1560, CHROME = 44;

export const Tutorial: React.FC<TutorialProps> = ({ clips }) => {
  let from = INTRO;
  return (
    <AbsoluteFill style={{ fontFamily, background: BRAND_DARK }}>
      <Sequence durationInFrames={INTRO}><Intro /></Sequence>
      {clips.map((c, i) => {
        const frames = Math.ceil(((c.duration - c.start - 0.4) / SPEED) * FPS);
        const start = from; from += frames;
        return <Sequence key={c.id} from={start} durationInFrames={frames}><SceneView clip={c} index={i} /></Sequence>;
      })}
      <Sequence from={from} durationInFrames={OUTRO}><Outro /></Sequence>
    </AbsoluteFill>
  );
};

const Backdrop: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const drift = Math.sin(f / 90) * 40;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at ${30 + drift / 4}% 20%, #1f4d2f 0%, ${BRAND_DARK} 62%)` }}>
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: BRAND, opacity: 0.22, filter: "blur(140px)", right: -120 + drift, bottom: -260 }} />
      {children}
    </AbsoluteFill>
  );
};

const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 14 } });
  const fade = interpolate(f, [INTRO - 14, INTRO], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <Backdrop>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fade, direction: "rtl", color: "#fff" }}>
        <Img src={staticFile("logo.png")} style={{ height: 120, transform: `scale(${0.7 + pop * 0.3})`, opacity: pop }} />
        <div style={{ marginTop: 44, fontSize: 84, fontWeight: 800, opacity: interpolate(f, [18, 36], [0, 1], { extrapolateRight: "clamp" }), transform: `translateY(${interpolate(f, [18, 36], [24, 0], { extrapolateRight: "clamp" })}px)` }}>آموزش استفاده از اپ Drivex</div>
        <div style={{ marginTop: 20, fontSize: 38, opacity: interpolate(f, [34, 54], [0, 0.75], { extrapolateRight: "clamp" }) }}>از ورود تا رزرو ماشین، در ۵ مرحله</div>
      </AbsoluteFill>
    </Backdrop>
  );
};

const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 16 } });
  const fade = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <Backdrop>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fade, direction: "rtl", color: "#fff" }}>
        <Img src={staticFile("logo.png")} style={{ height: 110, transform: `scale(${0.8 + pop * 0.2})` }} />
        <div style={{ marginTop: 20, fontSize: 30, letterSpacing: "0.4em", opacity: 0.6 }} dir="ltr">DRIVE. EASY.</div>
        <div style={{ marginTop: 56, fontSize: 60, fontWeight: 800 }}>اپ Drivex را همین حالا باز کنید</div>
        <div style={{ marginTop: 18, fontSize: 34, opacity: 0.75 }}>سؤال دارید؟ از بخش <b dir="ltr">Support</b> یا واتساپ با ما در تماس باشید</div>
      </AbsoluteFill>
    </Backdrop>
  );
};

/** Caption text with {{names}} shown left-to-right and bold. */
const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>{text.split(/(\{\{.*?\}\})/g).map((p, i) => (p.startsWith("{{") ? <b key={i} dir="ltr" style={{ color: ACCENT, unicodeBidi: "isolate", fontWeight: 800 }}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}</>
);

// 0 -> 1 over 0.55 s before the moment, 1 -> 0 over 1.0 s after it
const bump = (d: number) => {
  if (d < -0.55 || d > 1.0) return 0;
  const k = d < 0 ? 1 + d / 0.55 : 1 - d / 1.0;
  return k * k * (3 - 2 * k);
};

const SceneView: React.FC<{ clip: Clip; index: number }> = ({ clip, index }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const def = SCENES.find((s) => s.id === clip.id)!;
  const t = clip.start + (f / FPS) * SPEED; // time inside the recording
  const k = WIN_W / clip.view.width;
  const H = clip.view.height * k;

  // zoom toward the moment being shown
  const pts = clip.marks.filter((m) => m.kind !== "view" && m.box);
  let best = { e: 0, cx: WIN_W / 2, cy: H / 2 };
  for (const m of pts) {
    const b = bump(t - m.t);
    if (b > best.e) best = { e: b, cx: (m.box!.x + m.box!.width / 2) * k, cy: (m.box!.y + m.box!.height / 2) * k };
  }
  const scale = 1 + 0.2 * best.e;
  const fadeIn = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  // captions: each starts a little before its moment and lasts until the next one
  const starts: { cap: Cap; at: number }[] = [];
  let from = 0;
  for (const cap of def.caps) {
    const i = clip.marks.findIndex((m, idx) => idx >= from && m.label === cap.at);
    if (i < 0) continue;
    starts.push({ cap, at: Math.max(0, clip.marks[i].t - 0.6) });
    from = i + 1;
  }
  const active = [...starts].reverse().find((s) => t >= s.at);
  const age = active ? (t - active.at) / SPEED : 0;

  return (
    <Backdrop>
      <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut), alignItems: "center", justifyContent: "flex-start" }}>
        <div style={{ width: WIN_W, borderRadius: 22, overflow: "hidden", background: "#fff", boxShadow: "0 50px 120px -30px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08)", marginTop: 26 }}>
          <div style={{ height: CHROME, background: "linear-gradient(#f4f4f2,#e9e9e6)", display: "flex", alignItems: "center", padding: "0 18px", gap: 9, position: "relative", direction: "ltr" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => <i key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}
            <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 21, fontWeight: 600, color: "#4a4a46", direction: "rtl" }}>{`مرحله ${index + 1} از ${SCENES.length} · ${def.title}`}</div>
          </div>
          <div style={{ position: "relative", width: WIN_W, height: H, overflow: "hidden", background: "#f6f5f2" }}>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: `${best.cx}px ${best.cy}px` }}>
              <OffthreadVideo src={staticFile(`clips/${clip.id}.mp4`)} startFrom={Math.round(clip.start * FPS)} playbackRate={SPEED} muted style={{ width: WIN_W, height: H }} />
              {pts.map((m, i) => {
                const d = t - m.t;
                if (d < -0.15 || d > 1.5) return null;
                const o = d < 0 ? (d + 0.15) / 0.15 : interpolate(d, [0.8, 1.5], [1, 0], { extrapolateLeft: "clamp" });
                const pulse = 1 + Math.sin(d * 9) * 0.015;
                const b = m.box!;
                return <div key={i} style={{ position: "absolute", left: b.x * k - 10, top: b.y * k - 10, width: b.width * k + 20, height: b.height * k + 20, border: `4px solid ${ACCENT}`, borderRadius: 16, boxShadow: "0 0 0 6px rgba(255,200,61,.22), 0 0 36px rgba(255,200,61,.55)", opacity: Math.max(0, Math.min(1, o)), transform: `scale(${pulse})` }} />;
              })}
            </div>
          </div>
        </div>
      </AbsoluteFill>
      {active && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", justifyContent: "center", opacity: Math.min(fadeIn, fadeOut) * interpolate(age, [0, 0.25], [0, 1], { extrapolateRight: "clamp" }), transform: `translateY(${interpolate(age, [0, 0.3], [14, 0], { extrapolateRight: "clamp" })}px)` }}>
          <div dir="rtl" style={{ maxWidth: 1600, padding: "14px 40px", borderRadius: 22, background: "rgba(8,15,10,.78)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", fontSize: 44, fontWeight: 600, lineHeight: 1.45, textAlign: "center", boxShadow: "0 18px 50px -12px rgba(0,0,0,.6)" }}><Rich text={active.cap.text} /></div>
        </div>
      )}
    </Backdrop>
  );
};
