"use client";

import { ArrowRight, AudioLines, Headphones, Pause, Play, SkipForward, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useId } from "react";
import { sceneDetails, scenes, type Scene } from "@/lib/workspace";
import { SceneImage, Waveform } from "./ui";

export type Player = {
  scene: Scene;
  playing: boolean;
  volume: number;
  toggle: () => void;
  changeVolume: (volume: number) => void;
  saveVolume: (volume: number) => void;
};

export function VolumeControl({ player }: { player: Player }) {
  const Icon = player.volume === 0 ? VolumeX : Volume2;
  return (
    <label className="volume-control">
      <Icon size={16} aria-hidden="true" />
      <input type="range" aria-label="Atmosphere volume" min="0" max="1" step="0.01" value={player.volume}
        onChange={(event) => player.changeVolume(Number(event.target.value))}
        onPointerUp={(event) => player.saveVolume(Number(event.currentTarget.value))}
        onKeyUp={(event) => player.saveVolume(Number(event.currentTarget.value))}
        onBlur={(event) => player.saveVolume(Number(event.currentTarget.value))} />
    </label>
  );
}

export function PlayButton({ playing, toggle, className = "" }: { playing: boolean; toggle: () => void; className?: string }) {
  return (
    <button type="button" className={`play-button ${className}`} aria-label={playing ? "Pause atmosphere" : "Play atmosphere"} onClick={toggle}>
      {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
    </button>
  );
}

export function AtmospherePanel({ player, browse }: { player: Player; browse: () => void }) {
  const id = useId();
  const scene = sceneDetails[player.scene];
  return (
    <section className="panel atmosphere-panel" aria-labelledby={id}>
      <div className="panel-heading">
        <div className="panel-title"><span className="feature-icon"><Headphones size={19} /></span><h2 id={id}>Atmosphere</h2></div>
        <button type="button" className="text-button" onClick={browse}>Browse <ArrowRight size={14} /></button>
      </div>
      <div className="featured-scene">
        <SceneImage scene={player.scene} />
        <div className="scene-shade" aria-hidden="true" />
        <span className="scene-indicator"><i /> {player.playing ? "Now playing" : "Selected soundscape"}</span>
        <div className="featured-scene-content">
          <div><span>{scene.category}</span><h3>{scene.title}</h3></div>
          <PlayButton playing={player.playing} toggle={player.toggle} />
        </div>
      </div>
      <div className="player-strip">
        <Waveform playing={player.playing} />
        <VolumeControl player={player} />
      </div>
      <p className="scene-description">{scene.description}</p>
    </section>
  );
}

export function AtmosphereLibrary({ player, select, mix, startMix, nextMix }: {
  player: Player;
  select: (scene: Scene) => void;
  mix: { scenes: Scene[]; index: number } | null;
  startMix: () => void;
  nextMix: () => void;
}) {
  return (
    <div className="atmosphere-library">
      <div className="panel mix-panel">
        <div>
          <div className="panel-title"><span className="feature-icon"><AudioLines size={19} /></span><h2>Focus mix</h2></div>
          <p className="hint">Three original soundscapes sequenced to match your current vibe.</p>
          {mix && <ol className="mix-list" aria-label="Focus mix tracks">
            {mix.scenes.map((scene, index) => <li className={index === mix.index ? "current" : ""} key={scene} aria-current={index === mix.index ? "true" : undefined}>
              <span>{sceneDetails[scene].title}</span><small>{sceneDetails[scene].minutes} min</small>
            </li>)}
          </ol>}
        </div>
        <div className="mix-controls">
          <button className="button primary" type="button" onClick={startMix}><Sparkles size={16} /> {mix ? "Restart mix" : "Build a focus mix"}</button>
          {mix && mix.index < mix.scenes.length - 1 && <button type="button" className="button secondary" onClick={nextMix}><SkipForward size={16} /> Next track</button>}
        </div>
      </div>
      <div className="scene-grid">
        {scenes.map((scene) => {
          const active = scene === player.scene;
          const playing = active && player.playing;
          const detail = sceneDetails[scene];
          return <article className={`library-scene${active ? " selected" : ""}`} key={scene}>
            <div className="library-art">
              <SceneImage scene={scene} />
              {active && <span className="scene-indicator"><i /> {playing ? "Now playing" : "Selected"}</span>}
              <button className="play-button" type="button" aria-label={playing ? `Pause ${detail.title}` : `Play ${detail.title}`}
                onClick={() => active ? player.toggle() : select(scene)}>
                {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
              </button>
            </div>
            <div className="library-copy"><span className="eyebrow">{detail.category}</span><h2>{detail.title}</h2><p>{detail.description}</p></div>
          </article>;
        })}
      </div>
      <div className="panel library-player">
        <div className="panel-title"><PlayButton playing={player.playing} toggle={player.toggle} /><div>
          <strong>{sceneDetails[player.scene].title}</strong><span>{player.playing ? "Playing" : "Ready to play"}</span>
        </div></div>
        <Waveform playing={player.playing} />
        <VolumeControl player={player} />
      </div>
    </div>
  );
}
