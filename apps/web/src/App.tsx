import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Character, CharacterWrite, Setting, SettingWrite } from "@aigen-studio/shared";
import {
  createCharacter,
  createSetting,
  deleteCharacter,
  deleteSetting,
  fetchHealth,
  getStoredToken,
  listCharacters,
  listSettings,
  setStoredToken,
  updateCharacter,
  updateSetting,
} from "./api";

type Tab = "characters" | "settings";

const emptyCharacter = (): CharacterWrite => ({
  name: "",
  bio: "",
  personality: "",
  voiceStyle: "",
  notes: "",
  relationships: "",
  tags: "",
  ucNegatives: "",
  refImagePath: "",
});

const emptySetting = (): SettingWrite => ({
  name: "",
  description: "",
  atmosphere: "",
  notes: "",
  tags: "",
  ucNegatives: "",
  refImagePath: "",
});

export function App() {
  const [tokenInput, setTokenInput] = useState(getStoredToken);
  const [tokenSaved, setTokenSaved] = useState(Boolean(getStoredToken()));
  const [tab, setTab] = useState<Tab>("characters");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const qc = useQueryClient();

  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
  });

  function saveToken(e: FormEvent) {
    e.preventDefault();
    setStoredToken(tokenInput.trim());
    setTokenSaved(Boolean(tokenInput.trim()));
    void qc.invalidateQueries();
  }

  function applySearch(e: FormEvent) {
    e.preventDefault();
    setSearchApplied(search.trim());
  }

  return (
    <div className="page wide">
      <header className="header">
        <h1>Aigen Studio</h1>
        <p className="tagline">Lore repository — characters &amp; settings</p>
      </header>

      <section className="card">
        <h2>Server health</h2>
        {health.isLoading && <p>Checking…</p>}
        {health.isError && (
          <p className="error">
            Cannot reach API. Run <code>./scripts/run-dev.sh</code> or{" "}
            <code>pnpm start</code>.
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
          <code>pnpm auth:show</code> or first-start server log
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

      <nav className="tabs">
        <button
          type="button"
          className={tab === "characters" ? "tab active" : "tab"}
          onClick={() => setTab("characters")}
        >
          Characters
        </button>
        <button
          type="button"
          className={tab === "settings" ? "tab active" : "tab"}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </nav>

      <section className="card">
        <form onSubmit={applySearch} className="row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "characters"
                ? "Search characters (name, bio, …)"
                : "Search settings (name, description, …)"
            }
            disabled={!tokenSaved}
          />
          <button type="submit" disabled={!tokenSaved}>
            Search
          </button>
          {searchApplied ? (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSearch("");
                setSearchApplied("");
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
      </section>

      {!tokenSaved && (
        <p className="hint">Save an app token to use the lore repository.</p>
      )}

      {tokenSaved && tab === "characters" && (
        <CharactersPanel search={searchApplied} />
      )}
      {tokenSaved && tab === "settings" && (
        <SettingsPanel search={searchApplied} />
      )}
    </div>
  );
}

function CharactersPanel({ search }: { search: string }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CharacterWrite>(emptyCharacter);

  const list = useQuery({
    queryKey: ["characters", search],
    queryFn: () => listCharacters(search || undefined),
    retry: false,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) return updateCharacter(editingId, form);
      return createCharacter(form);
    },
    onSuccess: async () => {
      setEditingId(null);
      setForm(emptyCharacter());
      await qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteCharacter,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  function startEdit(c: Character) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      bio: c.bio,
      personality: c.personality,
      voiceStyle: c.voiceStyle,
      notes: c.notes,
      relationships: c.relationships,
      tags: c.tags,
      ucNegatives: c.ucNegatives,
      refImagePath: c.refImagePath,
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    save.mutate();
  }

  return (
    <div className="split">
      <section className="card">
        <h2>{editingId ? "Edit character" : "New character"}</h2>
        <form onSubmit={onSubmit} className="stack">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Bio
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </label>
          <label>
            Personality
            <textarea
              rows={2}
              value={form.personality}
              onChange={(e) =>
                setForm({ ...form, personality: e.target.value })
              }
            />
          </label>
          <label>
            Voice / style
            <textarea
              rows={2}
              value={form.voiceStyle}
              onChange={(e) => setForm({ ...form, voiceStyle: e.target.value })}
            />
          </label>
          <label>
            Notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label>
            Relationships
            <textarea
              rows={2}
              value={form.relationships}
              onChange={(e) =>
                setForm({ ...form, relationships: e.target.value })
              }
            />
          </label>
          <label>
            Tags (image)
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </label>
          <label>
            UC / negatives
            <input
              value={form.ucNegatives}
              onChange={(e) =>
                setForm({ ...form, ucNegatives: e.target.value })
              }
            />
          </label>
          <label>
            Ref image path
            <input
              value={form.refImagePath}
              onChange={(e) =>
                setForm({ ...form, refImagePath: e.target.value })
              }
            />
          </label>
          <div className="row">
            <button type="submit" disabled={save.isPending}>
              {editingId ? "Update" : "Create"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyCharacter());
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
          {save.isError && (
            <p className="error">{(save.error as Error).message}</p>
          )}
        </form>
      </section>

      <section className="card">
        <h2>Characters {search ? `(search: ${search})` : ""}</h2>
        {list.isLoading && <p>Loading…</p>}
        {list.isError && (
          <p className="error">{(list.error as Error).message}</p>
        )}
        <ul className="entity-list">
          {(list.data ?? []).map((c) => (
            <li key={c.id}>
              <div className="entity-head">
                <strong>{c.name}</strong>
                <span className="meta">{c.id.slice(0, 8)}…</span>
              </div>
              {c.bio ? <p className="snippet">{c.bio}</p> : null}
              {c.personality ? (
                <p className="snippet muted">Personality: {c.personality}</p>
              ) : null}
              {c.tags ? <p className="meta">tags: {c.tags}</p> : null}
              <div className="row">
                <button type="button" className="secondary" onClick={() => startEdit(c)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm(`Delete character “${c.name}”?`)) {
                      remove.mutate(c.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {list.data?.length === 0 && <p className="hint">No characters yet.</p>}
      </section>
    </div>
  );
}

function SettingsPanel({ search }: { search: string }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SettingWrite>(emptySetting);

  const list = useQuery({
    queryKey: ["settings", search],
    queryFn: () => listSettings(search || undefined),
    retry: false,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) return updateSetting(editingId, form);
      return createSetting(form);
    },
    onSuccess: async () => {
      setEditingId(null);
      setForm(emptySetting());
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteSetting,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  function startEdit(s: Setting) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description,
      atmosphere: s.atmosphere,
      notes: s.notes,
      tags: s.tags,
      ucNegatives: s.ucNegatives,
      refImagePath: s.refImagePath,
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    save.mutate();
  }

  return (
    <div className="split">
      <section className="card">
        <h2>{editingId ? "Edit setting" : "New setting"}</h2>
        <form onSubmit={onSubmit} className="stack">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label>
            Atmosphere
            <textarea
              rows={2}
              value={form.atmosphere}
              onChange={(e) =>
                setForm({ ...form, atmosphere: e.target.value })
              }
            />
          </label>
          <label>
            Notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label>
            Tags
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </label>
          <label>
            UC / negatives
            <input
              value={form.ucNegatives}
              onChange={(e) =>
                setForm({ ...form, ucNegatives: e.target.value })
              }
            />
          </label>
          <label>
            Ref image path
            <input
              value={form.refImagePath}
              onChange={(e) =>
                setForm({ ...form, refImagePath: e.target.value })
              }
            />
          </label>
          <div className="row">
            <button type="submit" disabled={save.isPending}>
              {editingId ? "Update" : "Create"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptySetting());
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
          {save.isError && (
            <p className="error">{(save.error as Error).message}</p>
          )}
        </form>
      </section>

      <section className="card">
        <h2>Settings {search ? `(search: ${search})` : ""}</h2>
        {list.isLoading && <p>Loading…</p>}
        {list.isError && (
          <p className="error">{(list.error as Error).message}</p>
        )}
        <ul className="entity-list">
          {(list.data ?? []).map((s) => (
            <li key={s.id}>
              <div className="entity-head">
                <strong>{s.name}</strong>
                <span className="meta">{s.id.slice(0, 8)}…</span>
              </div>
              {s.description ? <p className="snippet">{s.description}</p> : null}
              {s.atmosphere ? (
                <p className="snippet muted">Atmosphere: {s.atmosphere}</p>
              ) : null}
              <div className="row">
                <button type="button" className="secondary" onClick={() => startEdit(s)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm(`Delete setting “${s.name}”?`)) {
                      remove.mutate(s.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {list.data?.length === 0 && <p className="hint">No settings yet.</p>}
      </section>
    </div>
  );
}
