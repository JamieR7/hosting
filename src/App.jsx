import React, { useEffect, useState } from "react";
import logo from "./assets/logo.png";

const STORAGE_KEY = "cdl_schedule_v1";

const defaultState = {
  header: {
    tournamentName: "",
  },
  courts: [
    { id: "court1", name: "Court 1", nowMatchId: null, queueMatchIds: [] },
    { id: "court2", name: "Court 2", nowMatchId: null, queueMatchIds: [] },
  ],
  matches: {},
  settings: {
    autoStartNextOnFinish: true,
  },
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      header: { ...defaultState.header, ...(parsed.header ?? {}) },
      settings: { ...defaultState.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultState;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMatch(m) {
  if (!m) return null;
  const teams = `${m.teamA} vs ${m.teamB}`;
  const meta = [m.roundLabel, m.groupLabel].filter(Boolean).join(" • ");
  return { teams, meta };
}

function useMode() {
  const [hash, setHash] = useState(window.location.hash || "#/display");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/display");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash.includes("/admin") ? "admin" : "display";
}

export default function App() {
  const mode = useMode();
  const [state, setState] = useState(() => loadState());

  const setAndSave = (updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveState(next);
      return next;
    });
  };

  const actions = {
    setTournamentName: (value) => {
      setAndSave((prev) => ({
        ...prev,
        header: { ...(prev.header ?? {}), tournamentName: value },
      }));
    },

    addMatchToCourt: ({ courtId, roundLabel, groupLabel, teamA, teamB }) => {
      const id = uid();
      const match = { id, roundLabel, groupLabel, teamA, teamB, status: "queued" };

      setAndSave((prev) => {
        const courts = prev.courts.map((c) => {
          if (c.id !== courtId) return c;
          return { ...c, queueMatchIds: [...c.queueMatchIds, id] };
        });

        return {
          ...prev,
          courts,
          matches: { ...prev.matches, [id]: match },
        };
      });
    },

    startMatch: (courtId) => {
      setAndSave((prev) => {
        const court = prev.courts.find((c) => c.id === courtId);
        if (!court) return prev;
        if (court.nowMatchId) return prev;

        const [nextId, ...rest] = court.queueMatchIds;
        if (!nextId) return prev;

        const courts = prev.courts.map((c) =>
          c.id === courtId ? { ...c, nowMatchId: nextId, queueMatchIds: rest } : c
        );

        const matches = { ...prev.matches };
        matches[nextId] = { ...matches[nextId], status: "live" };

        return { ...prev, courts, matches };
      });
    },

    // Next match:
    // - Finish current (if any)
    // - Start next queued match (if any)
    nextMatch: (courtId) => {
      setAndSave((prev) => {
        const courtBefore = prev.courts.find((c) => c.id === courtId);
        if (!courtBefore) return prev;

        const finishedId = courtBefore.nowMatchId || null;
        const queue = [...courtBefore.queueMatchIds];
        const matches = { ...prev.matches };

        if (finishedId && matches[finishedId]) {
          matches[finishedId] = { ...matches[finishedId], status: "done" };
        }

        let nextId = null;
        if (queue.length > 0) {
          nextId = queue.shift();
          if (matches[nextId]) {
            matches[nextId] = { ...matches[nextId], status: "live" };
          }
        }

        const courts = prev.courts.map((c) => {
          if (c.id !== courtId) return c;
          return { ...c, nowMatchId: nextId, queueMatchIds: queue };
        });

        return { ...prev, courts, matches };
      });
    },

    removeQueuedMatch: (courtId, matchId) => {
      setAndSave((prev) => {
        const courts = prev.courts.map((c) => {
          if (c.id !== courtId) return c;
          return { ...c, queueMatchIds: c.queueMatchIds.filter((id) => id !== matchId) };
        });

        const matches = { ...prev.matches };
        delete matches[matchId];

        return { ...prev, courts, matches };
      });
    },

    resetAll: () => setAndSave(defaultState),
  };

  return (
    <div className="container">
      <Header mode={mode} tournamentName={state.header?.tournamentName ?? ""} actions={actions} />
      {mode === "display" ? <Display state={state} /> : <Admin state={state} actions={actions} />}
    </div>
  );
}

function Header({ mode, tournamentName, actions }) {
  const showName = (tournamentName ?? "").trim();

  return (
    <div className="header">
      <div className="brand">
        <img className="logo" src={logo} alt="CDL Panthers logo" />
        <div>
          <div className="welcome">Welcome to CDL. Home of the Panthers!</div>

          {/* Tournament name line (reserved space) */}
          <div
            style={{
              marginTop: 6,
              fontWeight: 800,
              color: "var(--cdl-yellow)",
              fontSize: 18,
              minHeight: 24,
            }}
          >
            {showName !== "" ? showName : " "}
          </div>

          {/* Editable in Admin */}
          {mode === "admin" && (
            <input
              style={{
                marginTop: 8,
                width: "min(720px, 70vw)",
                border: "1px solid var(--stroke)",
                background: "rgba(0,0,0,0.35)",
                color: "var(--text)",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 16,
                fontFamily: "Gotham, Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
              }}
              value={tournamentName}
              placeholder="Tournament name (editable)"
              onChange={(e) => actions.setTournamentName(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="nav">
        <a className="btn" href="#/display" aria-current={mode === "display" ? "page" : undefined}>
          Display
        </a>
        <a className="btn" href="#/admin" aria-current={mode === "admin" ? "page" : undefined}>
          Admin
        </a>
      </div>
    </div>
  );
}

function Display({ state }) {
  return (
    <div className="grid">
      {state.courts.map((court) => {
        const now = court.nowMatchId ? state.matches[court.nowMatchId] : null;

        const upNext1Id = court.queueMatchIds[0];
        const upNext2Id = court.queueMatchIds[1];

        const upNext1 = upNext1Id ? state.matches[upNext1Id] : null;
        const upNext2 = upNext2Id ? state.matches[upNext2Id] : null;

        const nowF = formatMatch(now);
        const next1F = formatMatch(upNext1);
        const next2F = formatMatch(upNext2);

        return (
          <div className="card" key={court.id}>
            <div className="courtTitle">
              <h2>{court.name}</h2>
              <span className="tag">{now ? "LIVE" : "READY"}</span>
            </div>

            <div>
              <div className="sectionLabel">Now playing</div>
              <div className="matchBig">
                <div className="teams">{nowF ? nowF.teams : "—"}</div>
                <div className="meta">{nowF ? nowF.meta : "No match started"}</div>
              </div>
            </div>

            <div>
              <div className="sectionLabel">Up next</div>
              <div className="matchSmall">
                <div className="teams">{next1F ? next1F.teams : "—"}</div>
                <div className="meta">{next1F ? next1F.meta : "No match queued"}</div>
              </div>

              {next2F && (
                <div className="matchSmall" style={{ marginTop: 10 }}>
                  <div className="teams">{next2F.teams}</div>
                  <div className="meta">{next2F.meta}</div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Admin({ state, actions }) {
  const [courtId, setCourtId] = useState(state.courts[0]?.id ?? "court1");
  const [roundLabel, setRoundLabel] = useState("Group Stage");
  const [groupLabel, setGroupLabel] = useState("");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");

  const canAdd = teamA.trim() && teamB.trim() && roundLabel.trim();

  return (
    <div className="adminWrap">
      <div className="panel">
        <div className="field">
          <label>Court</label>
          <select value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            {state.courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Round</label>
          <select value={roundLabel} onChange={(e) => setRoundLabel(e.target.value)}>
            <option value="Group Stage">Group Stage</option>
            <option value="Quarter-final">Quarter-final</option>
            <option value="Semi-final">Semi-final</option>
            <option value="Final">Final</option>
            <option value="Friendly">Friendly</option>
          </select>
        </div>

        <div className="field">
          <label>Group (optional)</label>
          <input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} placeholder="e.g., Group A" />
        </div>

        <div className="row">
          <div className="field">
            <label>Team A</label>
            <input value={teamA} onChange={(e) => setTeamA(e.target.value)} placeholder="CDL" />
          </div>
          <div className="field">
            <label>Team B</label>
            <input value={teamB} onChange={(e) => setTeamB(e.target.value)} placeholder="ISL" />
          </div>
        </div>

        <button
          className="btn"
          disabled={!canAdd}
          onClick={() => {
            actions.addMatchToCourt({
              courtId,
              roundLabel,
              groupLabel: groupLabel.trim() || null,
              teamA: teamA.trim(),
              teamB: teamB.trim(),
            });
            setTeamA("");
            setTeamB("");
          }}
        >
          Add to queue
        </button>

        <div style={{ height: 12 }} />

        <div className="row">
          <button className="btn" onClick={() => actions.startMatch(courtId)}>
            Start (selected court)
          </button>
          <button className="btn" onClick={() => actions.nextMatch(courtId)}>
            Next match (selected court)
          </button>
        </div>

        <div style={{ height: 12 }} />
        <button className="btn" onClick={actions.resetAll}>
          Reset all
        </button>
      </div>

      <div className="panel">
        <div className="sectionLabel">Queues</div>

        {state.courts.map((c) => {
          const now = c.nowMatchId ? state.matches[c.nowMatchId] : null;

          return (
            <div key={c.id} style={{ marginTop: 14 }}>
              <div className="courtTitle">
                <h2 style={{ margin: 0 }}>{c.name}</h2>
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="smallBtn" onClick={() => actions.startMatch(c.id)}>
                    Start
                  </button>
                  <button className="smallBtn" onClick={() => actions.nextMatch(c.id)}>
                    Next match
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="queueItem">
                  <div>
                    <div>
                      <strong>NOW:</strong> {now ? `${now.teamA} vs ${now.teamB}` : "—"}
                    </div>
                    <div style={{ color: "var(--muted)", fontWeight: 700, marginTop: 2 }}>
                      {now ? [now.roundLabel, now.groupLabel].filter(Boolean).join(" • ") : "No live match"}
                    </div>
                  </div>
                </div>

                {c.queueMatchIds.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontWeight: 700 }}>No queued matches.</div>
                ) : (
                  c.queueMatchIds.map((id, idx) => {
                    const m = state.matches[id];
                    return (
                      <div className="queueItem" key={id}>
                        <div>
                          <div>
                            <strong>{idx === 0 ? "NEXT:" : `Q${idx}:`}</strong> {m.teamA} vs {m.teamB}
                          </div>
                          <div style={{ color: "var(--muted)", fontWeight: 700, marginTop: 2 }}>
                            {[m.roundLabel, m.groupLabel].filter(Boolean).join(" • ")}
                          </div>
                        </div>
                        <button className="smallBtn danger" onClick={() => actions.removeQueuedMatch(c.id, id)}>
                          Remove
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
