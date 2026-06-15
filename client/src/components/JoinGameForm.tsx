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
    name: localStorage.getItem("name") as string | "",
    appearance: [0, 0, 0],
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <span className="p-5 text-red-500">{error}</span>
      <div className="bg-primary-500 p-6 rounded-2xl shadow-lg text-center">
        {/* Name Input & Language Selector */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            name="name"
            value={playerData.name}
            onChange={(e) =>
              setPlayerData({ ...playerData, name: e.target.value })
            }
            placeholder="Enter your name"
            className="flex-1 p-2 text-lg border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <select
            className="p-2 text-lg border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Languages)}
          >
            {Object.entries(Languages).map(([key, value]) => {
              return (
                <option key={key} value={key}>
                  {value}
                </option>
              );
            })}
          </select>
        </div>

        <PlayerSelector />

        {/* Play Button */}
        <Button
          variant="success"
          size="lg"
          fullWidth
          onClick={() => handleJoin(false)}
        >
          Play!
        </Button>

        {/* Create Private Room Button */}
        <Button
          variant="info"
          size="lg"
          fullWidth
          className="mt-3"
          onClick={() => handleJoin(true)}
        >
          Create Private Room
        </Button>
      </div>
    </div>
  );
}
