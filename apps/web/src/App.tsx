import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import type {
  Character,
  CharacterWrite,
  ScaffoldingComposeResult,
  Setting,
  SettingWrite,
  VaultImage,
} from "@aigen-studio/shared";
import {
  composeScaffolding,
  createCharacter,
  createSetting,
  deleteCharacter,
  deleteSetting,
  fetchHealth,
  fetchVaultImageObjectUrl,
  generateNaiImage,
  getStoredToken,
  importVaultPng,
  listCharacters,
  listSettings,
  listVaultImages,
  setStoredToken,
  updateCharacter,
  updateSetting,
} from "./api";

type Tab = "characters" | "settings" | "scaffold" | "gallery";

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

const TAB_HELP: Record<Tab, { label: string; blurb: string }> = {
  characters: {
    label: "Characters",
    blurb:
      "Save people for your stories: prose bios, personality, voice notes, and optional image tags.",
  },
  settings: {
    label: "Settings",
    blurb:
      "Places and world lore—locations, atmosphere, and notes you can reuse across stories and image prompts.",
  },
  scaffold: {
    label: "Scaffold",
    blurb:
      "Pick characters and settings to draft NovelAI-oriented memory, lorebook entries, and a system prompt (copy or download).",
  },
  gallery: {
    label: "Gallery",
    blurb:
      "Human-only NovelAI image generate (one click = one image) or import PNGs into your durable vault.",
  },
};

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
    const next = tokenInput.trim();
    setStoredToken(next);
    setTokenSaved(Boolean(next));
    void qc.invalidateQueries();
  }

  function clearToken() {
    setTokenInput("");
    setStoredToken("");
    setTokenSaved(false);
    void qc.invalidateQueries();
  }

  function applySearch(e: FormEvent) {
    e.preventDefault();
    setSearchApplied(search.trim());
  }

  const apiReachable = Boolean(health.data) && !health.isError;
  const activeTab = TAB_HELP[tab];

  return (
    <div className="page wide">
      <header className="header">
        <h1>Aigen Studio</h1>
        <p className="tagline">
          Your local hub for NovelAI <strong>image</strong> workflows and{" "}
          <strong>story lore</strong>—durable character/setting notes, story
          scaffolding drafts, and a private image vault.
        </p>
        <p className="lede">
          This page talks to the Aigen Studio server running on your machine (or
          over Tailscale). It does not replace NovelAI&apos;s website; it stores
          your library and vault, and can call NovelAI image generation only when{" "}
          <em>you</em> click Generate.
        </p>
      </header>

      <section className="card intro-card" aria-labelledby="get-started-heading">
        <h2 id="get-started-heading">Get started</h2>
        <p className="hint">
          Follow these steps in order the first time you open the app.
        </p>
        <ol className="steps">
          <li>
            <strong>Start the server</strong> (if it is not already running): from
            the project folder run{" "}
            <code>./scripts/run-dev.sh</code> or <code>pnpm start</code>. You
            should see the API on port <code>8787</code> and this UI on{" "}
            <code>5173</code>.
          </li>
          <li>
            <strong>Confirm server health</strong> below turns green
            (&quot;API reachable&quot;). If it is red, the browser cannot reach
            the API—start the server and refresh.
          </li>
          <li>
            <strong>Paste your app token</strong> and click Save. The token unlocks
            Characters, Settings, Scaffold, and Gallery. Get it with{" "}
            <code>pnpm auth:show</code> or from the server log on first start.
          </li>
          <li>
            <strong>Pick a tab</strong>: start with Characters or Settings to add
            lore, use Scaffold to export story setup text, or Gallery for images.
          </li>
        </ol>
      </section>

      <section className="card" aria-labelledby="health-heading">
        <h2 id="health-heading">1. Server health</h2>
        <p className="hint">
          Checks whether this browser can reach the Aigen Studio API. Health does{" "}
          <strong>not</strong> require your app token.
        </p>
        {health.isLoading && <p className="hint">Checking connection…</p>}
        {health.isError && (
          <div className="callout callout-error">
            <p className="error">
              <strong>API not reachable.</strong> The UI is open, but the server
              is not responding.
            </p>
            <p className="hint">
              From the repo root, start it with{" "}
              <code>./scripts/run-dev.sh</code> or <code>pnpm start</code>, then
              wait a few seconds and this section should update automatically.
            </p>
          </div>
        )}
        {health.data && (
          <div className="callout callout-ok">
            <p className="ok">
              <strong>API reachable</strong> — {health.data.service} reports{" "}
              <code>{health.data.status}</code>.
            </p>
            <p className="meta">Last check: {health.data.time}</p>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="token-heading">
        <h2 id="token-heading">2. App token (required for features)</h2>
        <p>
          The <strong>app token</strong> is a secret password for{" "}
          <em>your</em> Aigen Studio server. Every feature except health sends it
          as a Bearer token so only you can read or write the lore vault and
          gallery.
        </p>
        <ul className="plain-list">
          <li>
            <strong>Where to get it:</strong> run <code>pnpm auth:show</code> in
            the project, or copy the token printed in the server log the first
            time the server starts (file{" "}
            <code>secrets/app-token</code> under your data directory).
          </li>
          <li>
            <strong>Where it is stored:</strong> only in this browser&apos;s{" "}
            <code>localStorage</code> after you click Save—not on NovelAI, and not
            in the URL.
          </li>
          <li>
            <strong>Without a saved token:</strong> tabs stay locked. You can
            still see this page and health status.
          </li>
        </ul>
        <form onSubmit={saveToken} className="stack token-form">
          <label>
            App token
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste token from pnpm auth:show"
              autoComplete="off"
              aria-describedby="token-status"
            />
          </label>
          <div className="row wrap">
            <button type="submit">Save token</button>
            {tokenSaved ? (
              <button type="button" className="secondary" onClick={clearToken}>
                Clear saved token
              </button>
            ) : null}
          </div>
        </form>
        <div id="token-status" className="token-status">
          {tokenSaved ? (
            <p className="ok">
              <strong>Token saved in this browser.</strong> Characters, Settings,
              Scaffold, and Gallery can call the API. Continue with the tabs
              below.
            </p>
          ) : (
            <p className="callout callout-warn">
              <strong>No token saved yet.</strong> Feature tabs are locked until
              you paste a token and click Save. Obtain one with{" "}
              <code>pnpm auth:show</code>
              {apiReachable
                ? " (server is up—good time to grab the token)."
                : " after the server is running."}
            </p>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="areas-heading">
        <h2 id="areas-heading">3. What you can do here</h2>
        <p className="hint">
          Choose an area. Each tab needs a saved app token
          {tokenSaved ? " (you are unlocked)." : " (save a token first)."}
        </p>
        <nav className="tabs" aria-label="Product areas">
          {(Object.keys(TAB_HELP) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={tab === key ? "tab active" : "tab"}
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
            >
              {TAB_HELP[key].label}
            </button>
          ))}
        </nav>
        <div className="tab-blurb">
          <p>
            <strong>{activeTab.label}:</strong> {activeTab.blurb}
          </p>
        </div>
        <ul className="tab-guide plain-list">
          {(Object.keys(TAB_HELP) as Tab[]).map((key) => (
            <li key={key}>
              <strong>{TAB_HELP[key].label}</strong> — {TAB_HELP[key].blurb}
            </li>
          ))}
        </ul>
      </section>

      {tab !== "scaffold" && tab !== "gallery" && (
        <section className="card">
          <h2 className="visually-quiet">
            Search {tab === "characters" ? "characters" : "settings"}
          </h2>
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
      )}

      {!tokenSaved && (
        <section className="card callout callout-warn" aria-live="polite">
          <h2>Features locked</h2>
          <p>
            Save an app token in step 2 above to unlock{" "}
            <strong>{activeTab.label}</strong> and the other tabs. Until then the
            server will reject API calls as unauthorized.
          </p>
          <p className="hint">
            After saving: open <strong>Characters</strong> or{" "}
            <strong>Settings</strong> to add lore, then <strong>Scaffold</strong>{" "}
            to compose story text, or <strong>Gallery</strong> for images.
          </p>
        </section>
      )}

      {tokenSaved && tab === "characters" && (
        <CharactersPanel search={searchApplied} />
      )}
      {tokenSaved && tab === "settings" && (
        <SettingsPanel search={searchApplied} />
      )}
      {tokenSaved && tab === "scaffold" && <ScaffoldPanel />}
      {tokenSaved && tab === "gallery" && <GalleryPanel />}
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

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ScaffoldPanel() {
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [settingIds, setSettingIds] = useState<string[]>([]);
  const [storyTitle, setStoryTitle] = useState("");
  const [draft, setDraft] = useState<ScaffoldingComposeResult | null>(null);
  const [copyMsg, setCopyMsg] = useState("");

  const characters = useQuery({
    queryKey: ["characters", ""],
    queryFn: () => listCharacters(),
    retry: false,
  });
  const settings = useQuery({
    queryKey: ["settings", ""],
    queryFn: () => listSettings(),
    retry: false,
  });

  const compose = useMutation({
    mutationFn: composeScaffolding,
    onSuccess: (result) => {
      setDraft(result);
      setCopyMsg("");
    },
  });

  function onCompose(e: FormEvent) {
    e.preventDefault();
    if (characterIds.length === 0 && settingIds.length === 0) return;
    compose.mutate({
      characterIds,
      settingIds,
      storyTitle: storyTitle.trim() || undefined,
    });
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`Copied ${label}`);
    } catch {
      setCopyMsg(`Clipboard failed — use Download instead`);
    }
  }

  const canCompose = characterIds.length > 0 || settingIds.length > 0;

  return (
    <div className="stack-gap">
      <section className="card">
        <h2>Story scaffolding</h2>
        <p className="hint">
          Select lore entities, compose NovelAI-oriented memory, lorebook entries, and a
          system prompt. Export via copy or download — no NovelAI text-UI or image generate.
        </p>
        <form onSubmit={onCompose} className="stack">
          <label>
            Story title (optional)
            <input
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              placeholder="e.g. Compass Lost"
            />
          </label>

          <div className="split">
            <div>
              <h3 className="subhead">Characters</h3>
              {(characters.data ?? []).map((c) => (
                <label key={c.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={characterIds.includes(c.id)}
                    onChange={() =>
                      setCharacterIds((ids) => toggleId(ids, c.id))
                    }
                  />
                  <span>{c.name}</span>
                </label>
              ))}
              {characters.data?.length === 0 && (
                <p className="hint">No characters — create some first.</p>
              )}
            </div>
            <div>
              <h3 className="subhead">Settings</h3>
              {(settings.data ?? []).map((s) => (
                <label key={s.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={settingIds.includes(s.id)}
                    onChange={() => setSettingIds((ids) => toggleId(ids, s.id))}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
              {settings.data?.length === 0 && (
                <p className="hint">No settings — create some first.</p>
              )}
            </div>
          </div>

          <button type="submit" disabled={!canCompose || compose.isPending}>
            Compose drafts
          </button>
          {compose.isError && (
            <p className="error">{(compose.error as Error).message}</p>
          )}
        </form>
      </section>

      {draft && (
        <section className="card">
          <h2>Drafts — {draft.storyTitle}</h2>
          <div className="row wrap">
            <button
              type="button"
              className="secondary"
              onClick={() => copyText("plain text", draft.plainText)}
            >
              Copy all (plain)
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                downloadText(
                  `${slug(draft.storyTitle)}-scaffold.txt`,
                  draft.plainText,
                  "text/plain;charset=utf-8",
                )
              }
            >
              Download .txt
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                downloadText(
                  `${slug(draft.storyTitle)}-scaffold.json`,
                  JSON.stringify(draft, null, 2),
                  "application/json",
                )
              }
            >
              Download .json
            </button>
          </div>
          {copyMsg && <p className="ok">{copyMsg}</p>}

          <DraftBlock
            title="Memory"
            text={draft.memory}
            onCopy={() => copyText("memory", draft.memory)}
          />
          <div className="draft-block">
            <div className="entity-head">
              <h3 className="subhead">Lorebook ({draft.lorebook.length})</h3>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  copyText(
                    "lorebook JSON",
                    JSON.stringify(draft.lorebook, null, 2),
                  )
                }
              >
                Copy JSON
              </button>
            </div>
            {draft.lorebook.map((e) => (
              <div key={e.sourceId} className="lorebook-entry">
                <strong>
                  {e.keys}{" "}
                  <span className="meta">
                    ({e.sourceType})
                  </span>
                </strong>
                <pre className="draft-pre">{e.text}</pre>
              </div>
            ))}
          </div>
          <DraftBlock
            title="System prompt"
            text={draft.systemPrompt}
            onCopy={() => copyText("system prompt", draft.systemPrompt)}
          />
        </section>
      )}
    </div>
  );
}

function DraftBlock({
  title,
  text,
  onCopy,
}: {
  title: string;
  text: string;
  onCopy: () => void;
}) {
  return (
    <div className="draft-block">
      <div className="entity-head">
        <h3 className="subhead">{title}</h3>
        <button type="button" className="secondary" onClick={onCopy}>
          Copy
        </button>
      </div>
      <pre className="draft-pre">{text}</pre>
    </div>
  );
}

function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "story"
  );
}

function GalleryPanel() {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");
  const [status, setStatus] = useState("");

  const characters = useQuery({
    queryKey: ["characters", ""],
    queryFn: () => listCharacters(),
    retry: false,
  });

  const images = useQuery({
    queryKey: ["vault-images"],
    queryFn: listVaultImages,
    retry: false,
  });

  const generate = useMutation({
    mutationFn: generateNaiImage,
    onSuccess: async () => {
      setStatus("Generated and saved to vault.");
      await qc.invalidateQueries({ queryKey: ["vault-images"] });
    },
    onError: (err) => {
      setStatus((err as Error).message);
    },
  });

  const importMut = useMutation({
    mutationFn: importVaultPng,
    onSuccess: async () => {
      setStatus("Imported PNG into vault.");
      await qc.invalidateQueries({ queryKey: ["vault-images"] });
    },
    onError: (err) => {
      setStatus((err as Error).message);
    },
  });

  function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus("Generating (human-initiated)…");
    const seedNum = seed.trim() ? Number(seed) : undefined;
    generate.mutate({
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim(),
      seed: Number.isFinite(seedNum) ? seedNum : undefined,
      n: 1,
    });
  }

  function prefillFromCharacter(id: string) {
    const c = (characters.data ?? []).find((x) => x.id === id);
    if (!c) return;
    if (c.tags) setPrompt(c.tags);
    if (c.ucNegatives) setNegativePrompt(c.ucNegatives);
  }

  function onImportFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
      setStatus("Importing…");
      importMut.mutate({
        pngBase64: b64,
        prompt: prompt.trim() || undefined,
        negativePrompt: negativePrompt.trim() || undefined,
        seed: seed.trim() || undefined,
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="stack-gap">
      <section className="card">
        <h2>Human generate (NovelAI)</h2>
        <p className="hint">
          One image per click. Server auto-saves into the vault. Requires{" "}
          <code>AIGEN_NOVELAI_API_KEY</code>. Or import a PNG downloaded from NovelAI.
        </p>
        <form onSubmit={onGenerate} className="stack">
          <label>
            Prefill tags from character
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) prefillFromCharacter(e.target.value);
              }}
            >
              <option value="">—</option>
              {(characters.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prompt
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </label>
          <label>
            UC / negative
            <textarea
              rows={2}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
            />
          </label>
          <label>
            Seed (optional)
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="random if empty"
            />
          </label>
          <div className="row wrap">
            <button type="submit" disabled={generate.isPending}>
              Generate (1 image)
            </button>
            <label className="file-btn">
              Import PNG
              <input
                type="file"
                accept="image/png"
                hidden
                onChange={(e) =>
                  onImportFile(e.target.files?.[0] ?? null)
                }
              />
            </label>
          </div>
        </form>
        {status && <p className="hint">{status}</p>}
      </section>

      <section className="card">
        <h2>Vault gallery</h2>
        {images.isLoading && <p>Loading…</p>}
        {images.isError && (
          <p className="error">{(images.error as Error).message}</p>
        )}
        <div className="gallery-grid">
          {(images.data ?? []).map((img) => (
            <VaultThumb key={img.id} image={img} />
          ))}
        </div>
        {images.data?.length === 0 && (
          <p className="hint">No vault images yet.</p>
        )}
      </section>
    </div>
  );
}

function VaultThumb({ image }: { image: VaultImage }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchVaultImageObjectUrl(image.id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch((e) => setErr((e as Error).message));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  return (
    <figure className="vault-card">
      {url ? (
        <img src={url} alt={image.prompt || image.id} />
      ) : (
        <div className="vault-placeholder">{err || "…"}</div>
      )}
      <figcaption>
        <span className="meta">{image.source}</span>
        <p className="snippet">{image.prompt || "(no prompt)"}</p>
        {image.seed ? <p className="meta">seed {image.seed}</p> : null}
      </figcaption>
    </figure>
  );
}
