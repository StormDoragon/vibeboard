"use client";

import { ArrowUpRight, CalendarDays, Leaf } from "lucide-react";
import { moodDetails, type Vibe } from "@/lib/workspace";
import { MoodIcon } from "./ui";

function localDay(timestamp: string | number, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(new Date(timestamp));
}

export function VibeHistory({ vibes, now, local, checkIn }: {
  vibes: Vibe[];
  now: number;
  local: boolean;
  checkIn: () => void;
}) {
  const zone = local ? undefined : "UTC";
  const date = new Date(now);
  if (local) date.setHours(12, 0, 0, 0);
  else date.setUTCHours(12, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    if (local) day.setDate(day.getDate() + index - 6);
    else day.setUTCDate(day.getUTCDate() + index - 6);
    return {
      key: localDay(day.getTime(), zone),
      name: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: zone }).format(day),
      vibe: vibes.find((vibe) => localDay(vibe.createdAt, zone) === localDay(day.getTime(), zone)),
    };
  });

  return <div className="history-stack">
    <section className="panel week-panel">
      <div className="panel-title"><span className="feature-icon"><CalendarDays size={19} /></span><h2>Last 7 days</h2></div>
      <ul className="week-grid">
        {days.map(({ key, name, vibe }) => <li key={key}>
          <span className={`week-mood${vibe ? " has-vibe" : ""}`} aria-label={vibe ? moodDetails[vibe.mood].label : "No check-in"}
            style={vibe ? { color: moodDetails[vibe.mood].color } : undefined}>
            {vibe ? <MoodIcon mood={vibe.mood} size={21} /> : <i />}
          </span><span>{name}</span>
        </li>)}
      </ul>
    </section>
    {vibes.length ? <section className="panel history-panel" aria-label="Check-in entries">
      <h2>Check-ins</h2>
      {vibes.map((vibe) => <article className="history-entry" key={vibe.id}>
        <span className="history-icon" style={{ color: moodDetails[vibe.mood].color }}><MoodIcon mood={vibe.mood} size={21} /></span>
        <div>
          <div className="history-entry-heading">
            <h3>{moodDetails[vibe.mood].label}</h3>
            <time dateTime={vibe.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(vibe.createdAt))}</time>
          </div>
          <p>{vibe.summary}</p>
          {vibe.note && <blockquote>{vibe.note}</blockquote>}
          <div className="history-metrics"><span>Energy {vibe.energy}/5</span><span>Intensity {vibe.intensity}/5</span></div>
        </div>
      </article>)}
    </section> : <div className="panel empty-state history-empty"><Leaf size={27} /><h2>No check-ins yet</h2>
      <p>Your past moods and journal notes will appear here.</p>
      <button type="button" className="button primary" onClick={checkIn}>Check in <ArrowUpRight size={16} /></button>
    </div>}
  </div>;
}
