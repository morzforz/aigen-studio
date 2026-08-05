import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  createNote,
  fetchHealth,
  getStoredToken,
  listNotes,
  setStoredToken,
} from "./api";

export function App() {
  const [tokenInput, setTokenInput] = useState(getStoredToken);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tokenSaved, setTokenSaved] = useState(Boolean(getStoredToken()));
  const qc = useQueryClient();

  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
  });

  const notes = useQuery({
    queryKey: ["notes"],
    queryFn: listNotes,
    enabled: tokenSaved,
    retry: false,
  });

  const create = useMutation({
    mutationFn: createNote,
    onSuccess: async () => {
      setTitle("");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  function saveToken(e: FormEvent) {
    e.preventDefault();
    setStoredToken(tokenInput.trim());
    setTokenSaved(Boolean(tokenInput.trim()));
    void qc.invalidateQueries({ queryKey: ["notes"] });
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({ title: title.trim(), body });
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Aigen Studio</h1>
        <p className="tagline">M1 scaffold — health + dummy notes CRUD</p>
      </header>

      <section className="card">
        <h2>Server health</h2>
        {health.isLoading && <p>Checking…</p>}
        {health.isError && (
          <p className="error">
            Cannot reach API. Is <code>pnpm dev</code> running?
          </p>
        )}
        {health.data && (
          <p className="ok">
            <strong>{health.data.status}</strong> · {health.data.service} ·{" "}
            {health.data.time}
          </p>
        )}
      </section>

      <section className="card">
        <h2>App token</h2>
        <p className="hint">
          From server log on first start, or <code>pnpm auth:show</code>
        </p>
        <form onSubmit={saveToken} className="row">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Bearer app token"
            autoComplete="off"
          />
          <button type="submit">Save</button>
        </form>
      </section>

      <section className="card">
        <h2>Notes (smoke CRUD)</h2>
        {!tokenSaved && <p className="hint">Save an app token to load notes.</p>}
        {notes.isError && (
          <p className="error">
            {(notes.error as Error).message || "Failed to load notes"}
          </p>
        )}
        <form onSubmit={onCreate} className="stack">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            disabled={!tokenSaved}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Body"
            rows={3}
            disabled={!tokenSaved}
          />
          <button type="submit" disabled={!tokenSaved || create.isPending}>
            Create note
          </button>
        </form>
        {create.isError && (
          <p className="error">{(create.error as Error).message}</p>
        )}
        <ul className="notes">
          {(notes.data ?? []).map((n) => (
            <li key={n.id}>
              <strong>{n.title}</strong>
              <span className="meta">{n.id.slice(0, 8)}…</span>
              {n.body ? <p>{n.body}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
