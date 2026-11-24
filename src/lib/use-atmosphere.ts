"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AtmosphereEngine } from "./atmosphere-engine";
import { makeFocusMix, sceneDetails, type Mood, type Scene } from "./workspace";

export function useAtmosphere(volume: number, saveScene: (scene: Scene) => void, onError: (message: string) => void) {
  const [playing, setPlaying] = useState(false);
  const [mix, setMix] = useState<{ scenes: Scene[]; index: number } | null>(null);
  const engine = useRef<AtmosphereEngine | null>(null);
  const level = useRef(volume);

  useEffect(() => {
    level.current = volume;
    engine.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => () => {
    engine.current?.dispose();
    engine.current = null;
  }, []);

  const play = useCallback(async (scene: Scene) => {
    try {
      engine.current ??= new AtmosphereEngine();
      if (await engine.current.play(scene, level.current)) setPlaying(true);
    } catch {
      setPlaying(false);
      onError("Couldn’t start audio. Check browser audio permissions and try again.");
    }
  }, [onError]);

  const pause = useCallback(() => {
    engine.current?.pause();
    setPlaying(false);
  }, []);

  const advance = useCallback(() => {
    if (!mix) return;
    const index = mix.index + 1;
    const scene = mix.scenes[index];
    if (!scene) {
      pause();
      setMix(null);
      return;
    }
    setMix({ ...mix, index });
    saveScene(scene);
    void play(scene);
  }, [mix, pause, play, saveScene]);

  useEffect(() => {
    if (!mix || !playing) return;
    const timeout = window.setTimeout(advance, sceneDetails[mix.scenes[mix.index]].minutes * 60_000);
    return () => window.clearTimeout(timeout);
  }, [advance, mix, playing]);

  function startMix(mood: Mood) {
    const scenes = makeFocusMix(mood);
    setMix({ scenes, index: 0 });
    saveScene(scenes[0]);
    void play(scenes[0]);
  }

  function select(scene: Scene) {
    setMix(null);
    saveScene(scene);
    void play(scene);
  }

  return { playing, mix, play, pause, advance, select, startMix, clearMix: () => setMix(null) };
}
