"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceSchema, workspaceUpdateSchema, type WorkspaceChange, type WorkspaceVersion } from "./workspace";

const demoKey = "vibeboard:demo:v1";

type PendingChange = { apply: WorkspaceChange; finish: (saved: boolean) => void };

function readDemo() {
  try {
    const raw = localStorage.getItem(demoKey);
    return raw ? workspaceSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function useWorkspace(initial: WorkspaceVersion, account: boolean, onError: (message: string) => void) {
  const [workspace, setWorkspace] = useState(initial.state);
  const [saving, setSaving] = useState(false);
  const base = useRef(initial);
  const pending = useRef<PendingChange[]>([]);
  const syncing = useRef(false);

  useEffect(() => {
    if (account) return;
    const syncDemo = () => {
      const state = readDemo();
      if (state) {
        base.current = { revision: 0, state };
        setWorkspace(state);
      }
    };
    syncDemo();
    const storage = (event: StorageEvent) => {
      if (event.key === demoKey) syncDemo();
    };
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, [account]);

  const refresh = useCallback(() => {
    setWorkspace(pending.current.reduce((state, change) => change.apply(state), base.current.state));
  }, []);

  const flush = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    setSaving(true);
    while (pending.current.length) {
      const change = pending.current[0];
      let success = false;
      try {
        for (let attempts = 0; attempts < 3; attempts += 1) {
          const version = base.current;
          const state = change.apply(version.state);
          if (state === version.state) {
            success = true;
            break;
          }
          const response = await fetch("/api/workspace", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revision: version.revision, state }),
          });
          const json = await response.json();
          if (!response.ok && response.status !== 409) throw new Error(json.error || "Couldn’t save your change.");
          base.current = workspaceUpdateSchema.parse(json);
          if (response.ok) {
            success = true;
            break;
          }
          refresh();
        }
        if (!success) onError("Your workspace changed in another tab. Try saving again.");
      } catch (error) {
        const message = error instanceof Error && !["TypeError", "SyntaxError", "ZodError"].includes(error.name)
          ? error.message : "Couldn’t save your change. Check your connection and try again.";
        onError(message);
      }
      pending.current.shift();
      change.finish(success);
      refresh();
    }
    syncing.current = false;
    setSaving(false);
  }, [onError, refresh]);

  const update = useCallback((apply: WorkspaceChange) => {
    if (!account) {
      const state = apply(readDemo() ?? base.current.state);
      base.current = { revision: 0, state };
      try {
        localStorage.setItem(demoKey, JSON.stringify(state));
      } catch {
        onError("Browser storage is unavailable. Changes will last for this visit.");
      }
      setWorkspace(state);
      return Promise.resolve(true);
    }
    return new Promise<boolean>((finish) => {
      pending.current.push({ apply, finish });
      refresh();
      void flush();
    });
  }, [account, flush, onError, refresh]);

  return { workspace, update, saving };
}
