import React, { useMemo, useState } from "react";
import logo from "./assets/logo.jpg";

const STORAGE_KEY = "cdl_schedule_v1";

const defaultState = {
  courts: [
    { id: "court1", name: "Court 1", nowMatchId: null, queueMatchIds: [] },
    { id: "court2", name: "Court 2", nowMatchId: null, queueMatchIds: [] },
  ],
  matches: {},
  settings: {
    autoStartNextOnFinish: true
  }
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
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

export default function App() {
  const [mode, setMode] = useState(() => (window.location.hash.includes("/admin") ? "admin" : "display"));
  const [state, setState] = useState(() => loadState());

  React.useEffect(() => {
    const onHash = () => setMode(window.location.hash.includes("/admin") ? "admin" : "display");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setAndSave = (updater) => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveState(next);
      return next;
    });
  };

  const actions = {
    addMatchToCourt: ({ courtId, roundLabel, groupLabel, teamA, teamB }) => {
      const id = uid();
      const match = { id, roundLabel, groupLabel, teamA, teamB, status: "queued" };
      setAndSave(prev => {
        const courts = prev.courts.map(c => {
          if (c.id !== courtId) return c;
          return { ...c, queueMatchIds: [...c.queueMatchIds, id] };
        });
        return { ...prev, courts, matches: { ...prev.matches, [id]: match } };
      });
    },

    startMatch: (courtId) => {
      setAndSave(prev => {
        const courts = prev.courts.map(c => {
          if (c.id !== courtId) return c;
          if (c.nowMatchId) return c;
          const [nextId, ...rest] = c.queueMatchIds;
          if (!nextId) return c;
          return { ...c, nowMatchId: nextId, queueMatchIds: rest };
        });

        const updatedCourt = courts.find(c => c.id === courtId);
        const startedId = updatedCourt?.nowMatchId;

        const matches = { ...prev.matches };
        if (startedId && matches[startedId]) {
          matches[startedId] = { ...matches[startedId], status: "live" };
        }

        return { ...prev, courts, matches };
      });
    },

    finishMatch: (courtId) => {
      setAndSave(prev => {
        const courtBefore = prev.courts.find(c => c.id === courtId);
        const finishedId = courtBefore?.nowMatchId;

        let courts = prev.courts.map(c => (c.id === courtId ? { ...c, nowMatchId: null } : c));
        let matches = { ...prev.matches };

        if (finishedId && matches[finishedId]) {
          matches[finishedId] = { ...matches[finishedId], status: "done" };
        }

        // Auto-start next (your preference)
        const courtAfter = courts.find(c => c.id === courtId);
        if (prev.settings?.autoStartNextOnFinish && courtAfter && courtAfter.queueMatchIds.length > 0) {
          const [nextId, ...rest] = courtAfter.queueMatchIds;
          courts = courts.map(c => (c.id === courtId ? { ...c, nowMatchId: nextId, queueMatchIds: rest } : c));
          matches[nextId] = { ...matches[nextId], status: "live" };
        }

        return { ...prev, courts, matches };
      });
    },

    removeQueuedMatch: (courtId, matchId) => {
      setAndSave(prev => {
        const courts = prev.courts.map(c => {
          if (c.id !== courtId) return c;
          return { ...c, queueMatchIds: c.queueMatchIds.filter(id => id !== matchId) };
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
      <div className="header">
        <div className="brand">
          <img className="logo" src={logo} alt="CDL Panthers logo" />
          <div className="welcome">Welcome to CDL. Home of the Panthers!</div>
        </div>
        <div className="nav">
          <a className="btn" href="#/display" aria-current={mode === "display" ? "page" : undefined}>Display</a>
          <a className="btn" href="#/admin" aria-current={mode === "admin" ? "page" : undefined}>Admin</a>
        </div>
      </div>

      {mode === "display" ? (
        <Display state={state} />
      ) : (
        <Admin state={state} actions={actions} />
      )}
    </div>
  );
}

function Display({ state }) {
  return (
    <div className="grid">
      {state.courts.map(court => {
        const now = court.nowMatchId ? state.matches[court.nowMatchId] : null;
        const up1 = court.queueMatchIds[0] ? state.matches[court.queueMatchIds[0]] : null;
        const up2 = court.queueMatchIds[1] ? state.matches[court.queueMatchIds[1]] : null;

        const nowF = formatMatch(now);
        const up1F = formatMatch(up1);
        const up2F = formatMatch(up2);

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
                <div className="teams">{up1F ? up1F.teams : "—"}</div>
                <div className="meta">{up1F ? up1F.meta : "No match queued"}</div>
              </div>

              {up2F && (
                <div className="matchSmall" style={{ margi
