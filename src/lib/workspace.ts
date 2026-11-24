import { z } from "zod";

export const moods = ["drained", "calm", "steady", "energized", "restless"] as const;
export const energies = ["low", "medium", "high"] as const;
export const scenes = ["rain", "cafe", "moon", "forest"] as const;
export const themes = ["mood", "dark", "light"] as const;

export type Mood = (typeof moods)[number];
export type Energy = (typeof energies)[number];
export type Scene = (typeof scenes)[number];
export type Theme = (typeof themes)[number];

export const moodDetails = {
  drained: { label: "Drained", energy: 1, intensity: 2, scene: "moon", color: "#a6b5da" },
  calm: { label: "Calm", energy: 2, intensity: 1, scene: "forest", color: "#a3c8bf" },
  steady: { label: "Steady", energy: 3, intensity: 2, scene: "rain", color: "#bed499" },
  energized: { label: "Energized", energy: 5, intensity: 4, scene: "cafe", color: "#edc08a" },
  restless: { label: "Restless", energy: 4, intensity: 5, scene: "rain", color: "#d5b2db" },
} as const satisfies Record<Mood, { label: string; energy: number; intensity: number; scene: Scene; color: string }>;

export const sceneDetails = {
  rain: {
    title: "Rain on Pines",
    category: "Rain · Nature",
    description: "Soft rainfall drifting through a quiet evergreen forest.",
    minutes: 8,
  },
  cafe: {
    title: "Corner Café",
    category: "Warm · Textured",
    description: "A gentle murmur and soft chords from a corner table.",
    minutes: 6,
  },
  moon: {
    title: "Blue Hour",
    category: "Ambient · Soft synth",
    description: "Slow, spacious tones for winding down or finding your footing.",
    minutes: 10,
  },
  forest: {
    title: "Fern & Cedar",
    category: "Nature · Airy",
    description: "Moving leaves and distant birds under a cedar canopy.",
    minutes: 7,
  },
} as const satisfies Record<Scene, { title: string; category: string; description: string; minutes: number }>;

const axisSchema = z.number().int().min(1).max(5);
export const checkInSchema = z.object({
  mood: z.enum(moods),
  energy: axisSchema,
  intensity: axisSchema,
  note: z.string().trim().max(800),
});

const vibeSchema = checkInSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  summary: z.string().max(360),
  source: z.enum(["adaptive", "ai"]),
});

export const taskTitleSchema = z.string().trim().min(1).max(140);
const taskSchema = z.object({
  id: z.uuid(),
  title: taskTitleSchema,
  energy: z.enum(energies),
  done: z.boolean(),
});

export const usernameSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{2,23}$/, "Use 3–24 letters, numbers, dashes, or underscores.");

const profileSchema = z.object({
  username: z.union([z.literal(""), usernameSchema]),
  visibility: z.enum(["private", "unlisted", "public"]),
  message: z.string().trim().max(160),
  showFocus: z.boolean(),
}).refine((profile) => profile.visibility === "private" || profile.username !== "", {
  message: "Add a username to share your status.",
  path: ["username"],
});

const focusSchema = z.object({
  taskId: z.uuid().nullable(),
  duration: z.number().int().min(300).max(7200),
  remaining: z.number().int().min(1).max(7200),
  endsAt: z.number().int().positive().max(8_640_000_000_000_000).nullable(),
});

export const workspaceSchema = z.object({
  tasks: z.array(taskSchema).max(200),
  vibes: z.array(vibeSchema).max(120),
  preferences: z.object({
    theme: z.enum(themes),
    scene: z.enum(scenes),
    volume: z.number().min(0).max(1),
    focusMinutes: z.number().int().min(5).max(120),
    autoMatch: z.boolean(),
  }),
  profile: profileSchema,
  focus: focusSchema.nullable(),
});

export const workspaceUpdateSchema = z.object({
  revision: z.number().int().nonnegative(),
  state: workspaceSchema,
});

export type CheckIn = z.infer<typeof checkInSchema>;
export type Vibe = z.infer<typeof vibeSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Focus = z.infer<typeof focusSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceVersion = z.infer<typeof workspaceUpdateSchema>;
export type WorkspaceChange = (state: Workspace) => Workspace;

export function newWorkspace(demo = false): Workspace {
  return {
    tasks: demo ? [
      { id: "aef1b971-bd51-4d94-8a85-58dad068fa01", title: "Sketch ideas for the next project", energy: "medium", done: false },
      { id: "aef1b971-bd51-4d94-8a85-58dad068fa02", title: "Clear out the inbox", energy: "low", done: false },
      { id: "aef1b971-bd51-4d94-8a85-58dad068fa03", title: "Write a first draft", energy: "high", done: false },
      { id: "aef1b971-bd51-4d94-8a85-58dad068fa04", title: "Set an intention for today", energy: "low", done: true },
    ] : [],
    vibes: [],
    preferences: { theme: "mood", scene: "rain", volume: 0.55, focusMinutes: 25, autoMatch: true },
    profile: { username: "", visibility: "private", message: "", showFocus: true },
    focus: null,
  };
}

export function energyBand(energy: number): Energy {
  if (energy <= 2) return "low";
  if (energy >= 4) return "high";
  return "medium";
}

export function orderForEnergy(tasks: Task[], energy: Energy): Task[] {
  const target = energies.indexOf(energy);
  const rank = (task: Task) => (task.done ? 10 : 0) + Math.abs(energies.indexOf(task.energy) - target);
  return tasks.toSorted((first, second) => rank(first) - rank(second));
}

export function adaptiveSummary(checkIn: Pick<CheckIn, "mood" | "energy" | "intensity">): string {
  const observations: Record<Mood, string> = {
    drained: "Today calls for an easier pace.",
    calm: "There’s room for quiet, unhurried work.",
    steady: "You’re in a steady rhythm today.",
    energized: "You have momentum to work with today.",
    restless: "Your energy is moving in a few directions today.",
  };
  const suggestedAction: Record<Energy, string> = {
    low: "Start with one small task and leave room to rest.",
    medium: "Give one clear task your attention for a little while.",
    high: "Put some of that energy into a task that needs your full attention.",
  };
  const next = checkIn.intensity >= 4 && checkIn.mood === "restless"
    ? "A short focus session with a single, concrete next step may help you find your footing."
    : suggestedAction[energyBand(checkIn.energy)];
  return `${observations[checkIn.mood]} ${next}`;
}

export function remainingSeconds(session: Focus, now = Date.now()): number {
  return session.endsAt === null ? session.remaining : Math.max(0, Math.ceil((session.endsAt - now) / 1000));
}

export function makeFocusMix(mood: Mood): Scene[] {
  const first = moodDetails[mood].scene;
  const next: Scene[] = mood === "energized" ? ["forest", "rain"] : ["forest", "rain", "moon"];
  return [first, ...next.filter((scene) => scene !== first)].slice(0, 3);
}
