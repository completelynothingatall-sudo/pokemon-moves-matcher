import React, { useState, useEffect, useMemo } from "react";

const NON_LETHAL_MOVES = new Set(["False Swipe", "Pain Split"]);

async function loadText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const txt = await res.text();
  return txt.split("\n").map(x => x.trim()).filter(Boolean);
}

async function loadDatasets() {
  const datasets = {
    Gen1: {
      pokemon: "/data/gen1_pokemon.txt",
      moves: "/data/gen1_moves.txt",
    },
    Gen2: {
      pokemon: "/data/gen2_pokemon.txt",
      moves: "/data/gen2_moves.txt",
    },
  };

  const loaded = {};
  for (const [name, { pokemon, moves }] of Object.entries(datasets)) {
    const [pList, mList] = await Promise.all([loadText(pokemon), loadText(moves)]);
    loaded[name] = { pokemon: pList, moves: mList };
  }
  return loaded;
}

function longestPrefixAnywhere(move, pkmn) {
  let bestPos = null, bestLen = 0;
  const moveL = move.toLowerCase(), pkmnL = pkmn.toLowerCase();
  for (let start = 0; start < moveL.length; start++) {
    let length = 0;
    for (let i = 0; i < pkmnL.length; i++) {
      if (start + i < moveL.length && moveL[start + i] === pkmnL[i]) length++;
      else break;
    }
    if (length > bestLen || (length === bestLen && (bestPos === null || start < bestPos))) {
      bestLen = length;
      bestPos = start;
    }
  }
  return [bestLen, bestPos];
}

function bestMovesMapping(pokemon, moves) {
  const mapping = {};
  pokemon.forEach(pkmn => {
    let bestLen = 0, bestMoves = [];
    moves.forEach(mv => {
      const [lp, pos] = longestPrefixAnywhere(mv, pkmn);
      if (lp === 0) return;
      if (lp > bestLen) {
        bestLen = lp;
        bestMoves = [[mv, lp, pos, false]];
      } else if (lp === bestLen) {
        bestMoves.push([mv, lp, pos, false]);
      }
    });
    if (!bestMoves.length) {
      mapping[pkmn] = [];
      return;
    }
    const prefixMoves = bestMoves.filter(([_, __, pos]) => pos === 0);
    if (prefixMoves.length) bestMoves = prefixMoves;
    const allNonLethal = bestMoves.every(([mv]) => NON_LETHAL_MOVES.has(mv));
    if (allNonLethal) {
      const candidates = moves
        .filter(mv => !NON_LETHAL_MOVES.has(mv) && !bestMoves.some(([b]) => b === mv))
        .map(mv => {
          const [lp, pos] = longestPrefixAnywhere(mv, pkmn);
          return [mv, lp, pos, true];
        })
        .filter(([_, lp]) => lp > 0);
      if (candidates.length) {
        const maxLen = Math.max(...candidates.map(c => c[1]));
        const earliestPos = Math.min(...candidates.filter(c => c[1] === maxLen).map(c => c[2]));
        const secondaryMoves = candidates.filter(c => c[1] === maxLen && c[2] === earliestPos);
        bestMoves = bestMoves.concat(secondaryMoves);
      }
    }
    mapping[pkmn] = bestMoves;
  });
  return mapping;
}

function highlightMove(mv, len, pos, sec) {
  const prefix = mv.slice(pos, pos + len);
  return (
    <>
      {mv.slice(0, pos)}
      <span style={{ color: "limegreen" }}>{prefix}</span>
      <span style={{ color: sec ? "orange" : "inherit" }}>
        {mv.slice(pos + len)}
        {sec ? "*" : pos ? ` (pos ${pos})` : ""}
      </span>
    </>
  );
}

export default function App() {
  const [datasets, setDatasets] = useState({});
  const [selected, setSelected] = useState("");
  const [mapping, setMapping] = useState({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadDatasets().then(setDatasets).catch(console.error);
  }, []);

  useEffect(() => {
    if (selected && datasets[selected]) {
      const { pokemon, moves } = datasets[selected];
      setMapping(bestMovesMapping(pokemon, moves));
    }
  }, [selected, datasets]);

  const filtered = useMemo(() => {
    if (!search) return mapping;
    const s = search.toLowerCase();
    const res = {};
    for (const [pkmn, moves] of Object.entries(mapping)) {
      if (pkmn.toLowerCase().includes(s) || moves.some(([m]) => m.toLowerCase().includes(s))) {
        res[pkmn] = moves.filter(([m]) => m.toLowerCase().includes(s) || pkmn.toLowerCase().includes(s));
      }
    }
    return res;
  }, [search, mapping]);

  return (
    <div style={{ maxWidth: "700px", margin: "auto", padding: "1rem", color: "white", background: "#1e1e1e" }}>
      <h1 style={{ color: "#38bdf8" }}>Pokémon → Best Moves</h1>

      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
      >
        <option value="">Select Dataset...</option>
        {Object.keys(datasets).map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search Pokémon or Move..."
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
      />

      <div style={{ background: "#2a2a2a", padding: "1rem", borderRadius: "8px", maxHeight: "500px", overflowY: "auto" }}>
        {Object.entries(filtered).length === 0 && <p style={{ color: "gray", fontStyle: "italic" }}>No data yet</p>}
        {Object.entries(filtered).map(([pkmn, moves]) => (
          <div key={pkmn} style={{ marginBottom: "0.5rem" }}>
            <div style={{ color: "#38bdf8", fontWeight: "bold" }}>{pkmn}</div>
            {moves.length ? moves.map(([mv, len, pos, sec]) => (
              <div key={mv} style={{ marginLeft: "1rem" }}>
                • {highlightMove(mv, len, pos, sec)}
              </div>
            )) : <div style={{ marginLeft: "1rem", color: "gray", fontStyle: "italic" }}>(no matching moves)</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
