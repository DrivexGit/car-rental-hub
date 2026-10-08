import { Composition, staticFile, type CalculateMetadataFunction } from "remotion";
import { Tutorial, type Clip, type TutorialProps } from "./Tutorial";
import { FPS, INTRO, OUTRO, SCENES, SPEED } from "./script";

const calculateMetadata: CalculateMetadataFunction<TutorialProps> = async () => {
  const clips: Clip[] = await Promise.all(SCENES.map(async (s) => {
    const r = await fetch(staticFile(`clips/${s.id}.json`));
    const j = await r.json();
    return { id: s.id, start: j.start as number, duration: j.duration as number, view: j.view, marks: j.marks };
  }));
  const frames = clips.reduce((n, c) => n + Math.ceil(((c.duration - c.start - 0.4) / SPEED) * FPS), 0);
  return { durationInFrames: INTRO + frames + OUTRO, props: { clips } };
};

export const RemotionRoot: React.FC = () => (
  <Composition id="Tutorial" component={Tutorial} width={1920} height={1080} fps={FPS} durationInFrames={900}
    defaultProps={{ clips: [] }} calculateMetadata={calculateMetadata} />
);
