import { useEffect, useRef, useState } from "react";
import { socket } from "../socketHandler";
import { GameEvent, Languages, PlayerData } from "../types";
import Button from "./ui/Button";
import PlayerSelector from "./Player/PlayerSelector";

let capturedInviteRoomId: string | null = null;

function getRoomIdFromUrl(): string | null {
  const roomIdFromUrl = new URLSearchParams(window.location.search)
    .get("roomId")
    ?.trim();

  console.log(
    "[INVITE] Parsed roomId from URL:",
    roomIdFromUrl ?? "(none)",
    "href:",
    window.location.href
  );

  if (roomIdFromUrl) {
    capturedInviteRoomId = roomIdFromUrl;
    return roomIdFromUrl;
  }

  return capturedInviteRoomId;
}

export default function JoinGameForm() {
  const [playerData, setPlayerData] = useState<PlayerData>({
    name: localStorage.getItem("name") as string || "",
    avatar: localStorage.getItem("avatar") || "🍎",
  });
  const [language, setLanguage] = useState<Languages>(
    localStorage.getItem("language") as Languages | Languages.en
  );
  const inviteRoomIdRef = useRef<string | null>(getRoomIdFromUrl());
  const [roomId, setRoomId] = useState<string | null>(inviteRoomIdRef.current);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const roomIdFromUrl = getRoomIdFromUrl();
    if (roomIdFromUrl) {
      inviteRoomIdRef.current = roomIdFromUrl;
      setRoomId(roomIdFromUrl);
    }
    console.log(
      "[INVITE] roomId state value after useEffect:",
      roomIdFromUrl ?? inviteRoomIdRef.current
    );
    socket.on("error", setError);

    return () => {
      socket.off("error", setError);
    };
  }, []);

  const handleJoin = (isPrivate: boolean = false) => {
    if (playerData.name.trim() === "") {
      alert("Please enter your name");
      return;
    }
    localStorage.setItem("name", playerData.name);
    localStorage.setItem("avatar", playerData.avatar);
    localStorage.setItem("language", language);
    if (!socket.connected) socket.connect();

    const urlRoomId = getRoomIdFromUrl();
    const inviteRoomId =
      roomId || inviteRoomIdRef.current || urlRoomId || capturedInviteRoomId;
    const createPrivate = isPrivate && !inviteRoomId;
    const targetRoomId = createPrivate ? null : inviteRoomId || null;

    console.log("[INVITE] roomId state value before emit:", roomId);
    console.log("[INVITE] roomId ref value before emit:", inviteRoomIdRef.current);
    console.log("[INVITE] roomId from URL before emit:", urlRoomId);
    console.log("[INVITE] roomId captured before emit:", capturedInviteRoomId);
    console.log("[INVITE] window.location.href before emit:", window.location.href);
    console.log("[INVITE] roomId sent in JOIN_ROOM:", targetRoomId);

    socket.emit(
      GameEvent.JOIN_ROOM,
      playerData,
      language,
      targetRoomId,
      createPrivate
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 p-4 relative overflow-hidden">
      {/* Background blur decorative blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md backdrop-blur-md bg-slate-900/60 border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 text-center">
        {/* Logo/Branding */}
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-amber-300 drop-shadow-sm uppercase">
            SketchBattle
          </h1>
          <p className="mt-2 text-amber-200 text-base font-bold tracking-wide">
            Draw, Guess, Compete.
          </p>
          <p className="mt-2 text-slate-300 text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">
            Challenge friends and players worldwide in real-time drawing battles. Sketch, guess words, earn points, and climb the leaderboard.
          </p>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <span className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
            ⚡ Real-Time Multiplayer
          </span>
          <span className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
            🎨 Live Drawing
          </span>
          <span className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/20">
            🔑 Private Rooms
          </span>
          <span className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">
            🤝 Public Matchmaking
          </span>
          <span className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
            🚫 Vote Kick System
          </span>
          <span className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/20">
            🏆 Global Leaderboards
          </span>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 px-4 py-3 text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Name Input & Language Selector */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            name="name"
            value={playerData.name}
            onChange={(e) =>
              setPlayerData({ ...playerData, name: e.target.value })
            }
            placeholder="Enter your name"
            className="flex-1 px-4 py-3 bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 rounded-2xl outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition duration-200 text-base"
          />
          <select
            className="px-4 py-3 bg-slate-950/80 border border-white/10 text-white rounded-2xl outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition duration-200 text-base cursor-pointer"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Languages)}
          >
            {Object.entries(Languages).map(([key, value]) => (
              <option key={key} value={key} className="bg-slate-950 text-white">
                {value}
              </option>
            ))}
          </select>
        </div>

        {/* Avatar Selector */}
        <div className="mb-6 rounded-2xl border border-white/5 bg-slate-950/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-left">
            Select Fruit Avatar
          </p>
          <PlayerSelector
            avatar={playerData.avatar}
            onChange={(emoji) => {
              setPlayerData((prev) => ({ ...prev, avatar: emoji }));
              localStorage.setItem("avatar", emoji);
            }}
          />
        </div>

        {/* Join Game Button */}
        <Button
          variant="success"
          size="lg"
          fullWidth
          className="rounded-2xl py-4 font-bold tracking-wide shadow-lg shadow-emerald-500/20 transition-transform duration-200 hover:scale-[1.02]"
          onClick={() => handleJoin(false)}
        >
          Join Game
        </Button>

        {/* Create Private Room Button */}
        <Button
          variant="info"
          size="lg"
          fullWidth
          className="mt-3 rounded-2xl py-4 font-bold tracking-wide shadow-lg shadow-cyan-500/20 transition-transform duration-200 hover:scale-[1.02]"
          onClick={() => handleJoin(true)}
        >
          Create Private Room
        </Button>
      </div>
    </div>
  );
}
