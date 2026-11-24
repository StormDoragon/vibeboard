"use client";

import { arrayMove } from "@dnd-kit/sortable";
import {
  ArrowRight, ArrowUpRight, AudioLines, CalendarDays, Check, CircleAlert, House, ListTodo, Radio, ScanLine, Settings2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import { useAtmosphere } from "@/lib/use-atmosphere";
import {
  adaptiveSummary, energyBand, moodDetails, orderForEnergy, remainingSeconds, type CheckIn, type Energy,
  type Focus, type Mood, type Profile, type Scene, type Task, type Vibe, type Workspace, type WorkspaceVersion,
} from "@/lib/workspace";
import { AtmosphereLibrary, AtmospherePanel, type Player } from "./atmosphere";
import { CheckInCard, CheckInDialog } from "./check-in";
import { FocusScreen } from "./focus";
import { VibeHistory } from "./history";
import { Settings, type Account } from "./settings";
import { StatusSettings } from "./status";
import { TaskDialog, TaskPanel } from "./tasks";
import { VibeMark } from "./ui";

const navigation = [
  { id: "today", label: "Today", icon: House },
  { id: "tasks", label: "Soft tasks", icon: ListTodo },
  { id: "atmospheres", label: "Atmospheres", icon: AudioLines },
  { id: "history", label: "Vibe history", icon: CalendarDays },
  { id: "status", label: "Public status", icon: Radio },
] as const;

type View = (typeof navigation)[number]["id"] | "settings" | "focus";
const headings: Record<Exclude<View, "focus">, { title: string; description: string }> = {
  today: { title: "Make room for focus.", description: "A quieter workspace, tuned to how you feel." },
  tasks: { title: "Soft tasks", description: "Make a little progress at a pace that feels right." },
  atmospheres: { title: "Atmospheres", description: "Settle into an original soundscape or a mix for your mood." },
  history: { title: "Vibe history", description: "A quiet record of how you’ve been feeling." },
  status: { title: "Public status", description: "Share a little of where you’re at, on your terms." },
  settings: { title: "Settings", description: "Make this workspace your own." },
};

function viewUrl(view: View) {
  return view === "today" ? "/" : `/?view=${view}`;
}

function isView(value: string | null): value is View {
  return value === "settings" || value === "focus" || navigation.some((item) => item.id === value);
}

export function Dashboard({ initial, account, now, aiEnabled, canTranscribe }: {
  initial: WorkspaceVersion;
  account: Account | null;
  now: number;
  aiEnabled: boolean;
  canTranscribe: boolean;
}) {
  const params = useSearchParams();
  const route = params.get("view");
  const view = isView(route) ? route : "today";
  const lastView = useRef<Exclude<View, "focus">>("today");
  const [checkInMood, setCheckInMood] = useState<Mood | null>(null);
  const [taskEditor, setTaskEditor] = useState<{ task: Task | null } | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [clock, setClock] = useState(now);
  const [local, setLocal] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const toast = useRef<number | null>(null);

  const tell = useCallback((message: string, error = false) => {
    if (toast.current !== null) window.clearTimeout(toast.current);
    setNotice({ message, error });
    toast.current = window.setTimeout(() => setNotice(null), error ? 6500 : 3400);
  }, []);
  const reportError = useCallback((message: string) => tell(message, true), [tell]);
  const { workspace, update, saving } = useWorkspace(initial, Boolean(account), reportError);
  const { vibes, focus, tasks, preferences } = workspace;
  const currentVibe = vibes[0];
  const mood = currentVibe?.mood ?? "steady";
  const energy = energyBand(currentVibe?.energy ?? 3);
  const scene = preferences.scene;
  const volume = volumeDraft ?? preferences.volume;

  const setPreferences = useCallback((change: Partial<Workspace["preferences"]>) => {
    void update((state) => ({ ...state, preferences: { ...state.preferences, ...change } }));
  }, [update]);
  const saveScene = useCallback((scene: Scene) => setPreferences({ scene }), [setPreferences]);
  const audio = useAtmosphere(volume, saveScene, reportError);

  useEffect(() => {
    setLocal(true);
    setClock(Date.now());
    const interval = window.setInterval(() => setClock(Date.now()), focus?.endsAt ? 250 : 30_000);
    return () => window.clearInterval(interval);
  }, [focus?.endsAt]);

  useEffect(() => () => {
    if (toast.current !== null) window.clearTimeout(toast.current);
  }, []);

  const seconds = focus ? remainingSeconds(focus, clock) : 0;
  const focusActive = Boolean(focus && seconds > 0);
  const focusRunning = Boolean(focusActive && focus?.endsAt);
  const finished = useRef<number | null>(null);
  const { pause: pauseAudio } = audio;
  useEffect(() => {
    if (focus?.endsAt && seconds === 0 && finished.current !== focus.endsAt) {
      finished.current = focus.endsAt;
      pauseAudio();
      tell("Focus session complete.");
    }
  }, [focus?.endsAt, pauseAudio, seconds, tell]);

  function go(next: View) {
    if (view === next) return;
    if (next === "focus" && view !== "focus") lastView.current = view;
    window.history.pushState(null, "", viewUrl(next));
    window.scrollTo({ top: 0 });
  }

  function nav(event: MouseEvent<HTMLAnchorElement>, next: View) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(next);
  }

  async function saveCheckIn(checkIn: CheckIn) {
    let summary = adaptiveSummary(checkIn);
    let source: Vibe["source"] = "adaptive";
    if (aiEnabled) {
      try {
        const response = await fetch("/api/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkIn),
        });
        if (response.ok) {
          const result = await response.json();
          if (typeof result.summary === "string" && result.source === "ai") {
            summary = result.summary;
            source = "ai";
          }
        }
      } catch {
        // The adaptive summary keeps check-ins available if the AI provider is offline.
      }
    }
    const vibe: Vibe = { ...checkIn, id: crypto.randomUUID(), createdAt: new Date().toISOString(), source, summary };
    const recommended = moodDetails[vibe.mood].scene;
    const saved = await update((state) => ({
      ...state,
      vibes: [vibe, ...state.vibes.filter(({ id }) => id !== vibe.id)].slice(0, 120),
      tasks: state.preferences.autoMatch ? orderForEnergy(state.tasks, energyBand(vibe.energy)) : state.tasks,
      preferences: { ...state.preferences, scene: recommended },
    }));
    if (saved) {
      audio.clearMix();
      if (audio.playing && recommended !== scene) void audio.play(recommended);
      tell("Your workspace is tuned.");
    }
    return saved;
  }

  function saveTask(title: string, energy: Energy) {
    if (taskEditor?.task) {
      const id = taskEditor.task.id;
      return update((state) => ({ ...state, tasks: state.tasks.map((task) => task.id === id ? { ...task, title, energy } : task) }));
    }
    if (tasks.length >= 200) {
      reportError("Your workspace has 200 tasks. Remove a task to add another.");
      return Promise.resolve(false);
    }
    const task: Task = { id: crypto.randomUUID(), title, energy, done: false };
    return update((state) => state.tasks.some(({ id }) => id === task.id) ? state : { ...state, tasks: [task, ...state.tasks] });
  }

  function deleteTask() {
    const id = taskEditor?.task?.id;
    return update((state) => ({ ...state, tasks: state.tasks.filter((task) => task.id !== id) }));
  }

  function reorder(dragged: string, target: string) {
    void update((state) => {
      const from = state.tasks.findIndex((task) => task.id === dragged);
      const to = state.tasks.findIndex((task) => task.id === target);
      return from < 0 || to < 0 ? state : { ...state, tasks: arrayMove(state.tasks, from, to) };
    });
  }

  function startFocus() {
    const at = Date.now();
    const length = focus && remainingSeconds(focus, at) > 0 ? remainingSeconds(focus, at) : 0;
    const goal = orderForEnergy(tasks, energy).find((task) => !task.done);
    const duration = preferences.focusMinutes * 60;
    const next: Focus = focus && length > 0 ? { ...focus, remaining: length, endsAt: at + 1000 * length } :
      { taskId: goal?.id ?? null, duration, remaining: duration, endsAt: at + duration * 1000 };
    setClock(at);
    void update((state) => ({ ...state, focus: next }));
    void audio.play(scene);
    go("focus");
  }

  function pauseFocus(reset = false) {
    if (!focus) return;
    const remaining = reset ? focus.duration : remainingSeconds(focus);
    if (remaining <= 0) return;
    void update((state) => ({ ...state, focus: { ...focus, endsAt: null, remaining } }));
    audio.pause();
  }

  function endFocus() {
    void update((state) => ({ ...state, focus: null }));
    audio.pause();
    go(lastView.current);
  }

  function saveVolume(value: number) {
    setVolumeDraft(null);
    if (preferences.volume !== value) setPreferences({ volume: value });
  }

  function openCheckIn(mood: Mood) {
    setNotice(null);
    setCheckInMood(mood);
  }

  function editTask(task: Task | null) {
    setNotice(null);
    setTaskEditor({ task });
  }

  const player: Player = {
    scene, playing: audio.playing, volume,
    toggle: () => audio.playing ? audio.pause() : void audio.play(scene),
    changeVolume: setVolumeDraft, saveVolume,
  };
  const displayDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: local ? undefined : "UTC",
  }).format(new Date(clock));

  function renderTasks(preview: boolean) {
    return <TaskPanel tasks={tasks} energy={energy} preview={preview}
      add={() => editTask(null)} edit={editTask}
      toggle={(task) => void update((state) => ({ ...state, tasks: state.tasks.map((item) =>
        item.id === task.id ? { ...item, done: !task.done } : item) }))}
      reorder={reorder}
      match={() => void update((state) => ({ ...state, tasks: orderForEnergy(state.tasks, energy) })).then((saved) => {
        if (saved) tell(`Tasks matched to ${energy} energy.`);
      })}
      viewAll={() => go("tasks")} />;
  }

  const navLink = ({ id, label, icon: Icon }: { id: View; label: string; icon: typeof House }) => (
    <Link key={id} href={viewUrl(id)} className="nav-link" aria-current={view === id ? "page" : undefined}
      onClick={(event) => nav(event, id)} title={label}>
      <Icon size={18} strokeWidth={1.75} /><span>{label}</span>
    </Link>
  );

  return <div className="app-shell" data-mood={preferences.theme === "mood" ? mood : "steady"} data-theme={preferences.theme}>
    {view === "focus" ? <FocusScreen session={focus} seconds={seconds} task={tasks.find((task) => task.id === focus?.taskId)}
      defaultMinutes={preferences.focusMinutes} player={player} exit={() => go(lastView.current)}
      start={startFocus} pause={() => pauseFocus()} reset={() => pauseFocus(true)} end={endFocus} /> :
      <>
        <a href="#workspace" className="skip-link">Skip to workspace</a>
        <aside className="sidebar">
          <Link href="/" className="wordmark" onClick={(event) => nav(event, "today")} aria-label="VibeBoard home"><VibeMark /><span>vibeboard<span>.</span></span></Link>
          <nav aria-label="Workspace" className="workspace-nav">
            <span className="nav-label">Workspace</span>
            {navigation.map(navLink)}
          </nav>
          <div className="sidebar-bottom">
            {navLink({ id: "settings", label: "Settings", icon: Settings2 })}
            {account ? <Link href="/?view=settings" className="account-chip" aria-label={`Account settings for ${account.name}`} onClick={(event) => nav(event, "settings")}>
              <span className="account-avatar">{(account.name || account.email).slice(0, 2).toUpperCase()}</span>
              <span><strong>{account.name}</strong><small>{account.pro ? "Pro workspace" : "Personal workspace"}</small></span>
            </Link> : <Link href="/account" className="account-chip" aria-label="Sign in to sync">
              <span className="account-avatar"><VibeMark /></span><span><strong>Guest workspace</strong><small>Sign in to sync</small></span><ArrowUpRight size={14} />
            </Link>}
          </div>
        </aside>
        <main id="workspace" tabIndex={-1} className="main-content">
          <header className="page-heading">
            <div>
              <div className="eyebrow page-date"><CalendarDays size={14} /> {displayDate}</div>
              <h1>{headings[view].title}</h1>
              <p>{headings[view].description}</p>
            </div>
            <div className="page-actions">
              <Link href="/?view=settings" className="icon-button mobile-settings" onClick={(event) => nav(event, "settings")} aria-label="Settings"><Settings2 size={21} /></Link>
              <button className="button focus-entry" type="button" onClick={() => focusActive ? go("focus") : startFocus()}>
                <ScanLine size={17} /> {focusRunning ? "In focus" : focusActive ? "Return to focus" : "Focus mode"} <ArrowRight size={14} />
              </button>
            </div>
          </header>
          {view === "today" && <>
            <CheckInCard vibe={currentVibe} onOpen={openCheckIn} />
            <div className="today-grid">{renderTasks(true)}<AtmospherePanel player={player} browse={() => go("atmospheres")} /></div>
          </>}
          {view === "tasks" && renderTasks(false)}
          {view === "atmospheres" && <AtmosphereLibrary player={player} select={audio.select} mix={audio.mix}
            startMix={() => audio.startMix(mood)} nextMix={audio.advance} />}
          {view === "history" && <VibeHistory vibes={vibes} now={clock} local={local} checkIn={() => openCheckIn(mood)} />}
          {view === "status" && <StatusSettings profile={workspace.profile} vibe={currentVibe} scene={scene}
            focusEndsAt={focus?.endsAt ?? null} now={clock} account={Boolean(account)} pro={Boolean(account?.pro)}
            save={(profile: Profile) => update((state) => ({ ...state, profile }))} tell={tell} />}
          {view === "settings" && <Settings preferences={preferences} account={account} setPreferences={setPreferences}
            saving={saving} tell={reportError} paymentReturn={params.get("billing") === "success"} />}
        </main>
      </>}
    {checkInMood && <CheckInDialog mood={checkInMood} aiEnabled={aiEnabled} canTranscribe={canTranscribe} error={notice?.error ? notice.message : undefined}
      onSave={saveCheckIn} onClose={() => setCheckInMood(null)} />}
    {taskEditor && <TaskDialog task={taskEditor.task} error={notice?.error ? notice.message : undefined} onSave={saveTask} onDelete={deleteTask} onClose={() => setTaskEditor(null)} />}
    <div className={`toast${notice && !checkInMood && !taskEditor ? " visible" : ""}`} role="status" aria-live="polite">
      {notice && !checkInMood && !taskEditor && <>{notice.error ? <CircleAlert size={18} /> : <Check size={18} />}{notice.message}</>}
    </div>
  </div>;
}
