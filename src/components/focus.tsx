"use client";

import { ArrowLeft, AudioLines, Pause, Play, RotateCcw, Square, Timer } from "lucide-react";
import type { CSSProperties } from "react";
import { sceneDetails, type Focus, type Task } from "@/lib/workspace";
import { PlayButton, VolumeControl, type Player } from "./atmosphere";
import { SceneImage, VibeMark, Waveform } from "./ui";

function formatSeconds(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function FocusScreen({ session, seconds, task, defaultMinutes, player, exit, start, pause, reset, end }: {
  session: Focus | null;
  seconds: number;
  task?: Task;
  defaultMinutes: number;
  player: Player;
  exit: () => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  end: () => void;
}) {
  const complete = Boolean(session && seconds === 0);
  const running = Boolean(session?.endsAt && !complete);
  const percent = session ? Math.min(100, 100 * (1 - seconds / session.duration)) : 0;
  return (
    <main className="focus-screen" aria-label="Focus mode">
      <SceneImage scene={player.scene} />
      <div className="focus-shade" aria-hidden="true" />
      <header className="focus-top">
        <button type="button" className="button focus-ghost" onClick={exit}><ArrowLeft size={16} /> Back to workspace</button>
        <span className="focus-brand"><VibeMark /> vibeboard</span>
      </header>
      <div className="focus-center">
        <span className="focus-kicker eyebrow"><Timer size={15} /> {complete ? "Session complete" : running ? "In focus" : session ? "On pause" : "Focus mode"}</span>
        <h1>{complete ? "Take a breath." : task ? task.title : "One thing at a time."}</h1>
        <div className="time-circle" style={{ "--timer-progress": `${percent}%` } as CSSProperties}>
          <div role="timer" aria-label="Time remaining">{formatSeconds(session ? seconds : defaultMinutes * 60)}</div>
          <span>{complete ? "Well done" : running ? "Remaining" : session ? "Paused" : "Minutes"}</span>
        </div>
        <div className="focus-actions">
          {session && !complete && <button type="button" className="icon-button focus-ghost" aria-label="Reset timer" onClick={reset}><RotateCcw size={19} /></button>}
          <button type="button" className="button primary" onClick={running ? pause : start}>
            {running ? <Pause size={17} /> : <Play size={17} />}{complete ? "Start a new session" : running ? "Pause session" : session ? "Resume session" : "Start session"}
          </button>
          {session && <button type="button" className="icon-button focus-ghost" aria-label="End focus session" onClick={end}><Square size={16} /></button>}
        </div>
      </div>
      <div className="focus-player">
        <PlayButton playing={player.playing} toggle={player.toggle} />
        <div><span><AudioLines size={13} /> Atmosphere</span><strong>{sceneDetails[player.scene].title}</strong></div>
        <Waveform playing={player.playing} />
        <VolumeControl player={player} />
      </div>
    </main>
  );
}
