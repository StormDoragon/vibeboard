"use client";

import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownUp, ArrowRight, Check, Ellipsis, GripVertical, ListTodo, Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { energies, taskTitleSchema, type Energy, type Task } from "@/lib/workspace";
import { Dialog, EnergyTag } from "./ui";

function TaskRow({ task, toggle, edit }: { task: Task; toggle: () => void; edit: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <li ref={setNodeRef} className={`task-row${task.done ? " task-done" : ""}${isDragging ? " task-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button ref={setActivatorNodeRef} type="button" className="task-grip icon-button" {...attributes} {...listeners}
        aria-label={`Reorder ${task.title}`}><GripVertical size={15} /></button>
      <button type="button" role="checkbox" aria-checked={task.done} aria-label={task.title} className="task-check" onClick={toggle}>
        {task.done && <Check size={12} strokeWidth={2.6} />}
      </button>
      <button type="button" onClick={edit} className="task-title" title={task.title}>{task.title}</button>
      <EnergyTag energy={task.energy} />
      <button type="button" className="task-more icon-button" aria-label={`Edit ${task.title}`} onClick={edit}><Ellipsis size={17} /></button>
    </li>
  );
}

export function TaskPanel({ tasks, preview, add, edit, toggle, reorder, match, viewAll, energy }: {
  tasks: Task[];
  preview?: boolean;
  add: () => void;
  edit: (task: Task) => void;
  toggle: (task: Task) => void;
  reorder: (dragged: string, target: string) => void;
  match: () => void;
  viewAll: () => void;
  energy: Energy;
}) {
  const id = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const done = tasks.filter((task) => task.done).length;
  const visible = preview ? tasks.slice(0, 4) : tasks;

  function drop(event: DragEndEvent) {
    if (event.over && event.active.id !== event.over.id) reorder(String(event.active.id), String(event.over.id));
  }

  return (
    <section className="panel task-panel" aria-labelledby={id}>
      <div className="panel-heading">
        <div className="panel-title"><span className="feature-icon"><ListTodo size={19} /></span><h2 id={id}>Soft tasks</h2></div>
        <button type="button" className="button secondary compact" onClick={add}><Plus size={16} /> Add task</button>
      </div>
      <div className="task-progress">
        <div><span>Progress</span><span><strong>{done}</strong> of {tasks.length} complete</span></div>
        <progress aria-label="Task progress" max={Math.max(1, tasks.length)} value={done} />
      </div>
      {visible.length > 0 ? (
        <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop}>
          <SortableContext items={visible.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            <ul className="task-list">
              {visible.map((task) => <TaskRow key={task.id} task={task} toggle={() => toggle(task)} edit={() => edit(task)} />)}
            </ul>
          </SortableContext>
        </DndContext>
      ) : <div className="empty-state"><ListTodo size={24} /><p>What would you like to make time for?</p>
        <button type="button" className="button secondary compact" onClick={add}><Plus size={15} /> Add your first task</button></div>}
      {tasks.length > 0 && <div className="panel-footer task-footer">
        <button className="text-button" type="button" onClick={match} title={`Move ${energy}-energy tasks to the top`}><ArrowDownUp size={14} /> Match energy</button>
        {preview && <button className="text-button" type="button" onClick={viewAll}>View all tasks <ArrowRight size={14} /></button>}
        {!preview && <span className="hint">Drag a handle to move a task</span>}
      </div>}
    </section>
  );
}

export function TaskDialog({ task, error, onSave, onDelete, onClose }: {
  task: Task | null;
  error?: string;
  onSave: (title: string, energy: Energy) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [energy, setEnergy] = useState<Energy>(task?.energy ?? "medium");
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = taskTitleSchema.safeParse(title);
    if (!value.success || working) return;
    setWorking(true);
    if (await onSave(value.data, energy)) onClose();
    else setWorking(false);
  }

  async function remove() {
    if (!confirm) { setConfirm(true); return; }
    setWorking(true);
    if (await onDelete()) onClose();
    else setWorking(false);
  }

  return (
    <Dialog title={task ? "Edit task" : "Add a task"} onClose={() => { if (!working) onClose(); }}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field"><span>Task</span><input autoFocus required maxLength={140} value={title}
          onChange={(event) => setTitle(event.target.value)} placeholder="One thing you’d like to do" /></label>
        <fieldset className="field"><legend>Energy needed</legend>
          <div className="energy-options">
            {energies.map((value) => <label className="energy-choice" key={value}>
              <input type="radio" name="task-energy" value={value} checked={energy === value} onChange={() => setEnergy(value)} />
              <EnergyTag energy={value} />
            </label>)}
          </div>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions split">
          {task && <button type="button" className="button subtle remove-button" disabled={working} onClick={() => void remove()}>{confirm ? "Confirm removal" : "Remove task"}</button>}
          <button type="submit" className="button primary" disabled={working || !title.trim()}>
            {working ? "Saving…" : task ? "Save task" : "Add task"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
