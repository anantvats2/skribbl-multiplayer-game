import React, { useEffect, useState } from "react";
import { GameEvent, Player, Room } from "../types";
import { socket } from "../socketHandler";
import { useRoom } from "../context/RoomContext";
import { AnimatePresence } from "framer-motion";
import { motion } from "framer-motion";
import PlayerCard from "./Player/PlayerCard";

const PlayerScores: React.FC = () => {
  const { currentRound, settings, players } = useRoom();
  const [displayers, setDisplayers] = useState<Player[]>(players);

  function addPlayer(player: Player) {
    setDisplayers((p) => {
      if (player.playerId === socket.id) {
        return p;
      }
      return [...p, player];
    });
  }
  function removePlayer(player: Player) {
    setDisplayers((p) => {
      return p.filter((e) => e.playerId != player.playerId);
    });
  }

  function roundEnd(room: Room) {
    setDisplayers(room.players);
  }

  useEffect(() => {
    socket.on(GameEvent.PLAYER_JOINED, addPlayer);
    socket.on(GameEvent.PLAYER_LEFT, removePlayer);
    socket.on(GameEvent.TURN_END, roundEnd);

    return () => {
      socket.off(GameEvent.PLAYER_JOINED, addPlayer);
      socket.off(GameEvent.PLAYER_LEFT, removePlayer);
      socket.off(GameEvent.TURN_END, roundEnd);
    };
  });

  return (
    <div className="w-full max-w-[340px] sm:w-[340px] overflow-hidden min-h-[520px] rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/20 p-4">
      <div className="mb-4 rounded-3xl bg-slate-900/90 border border-white/10 p-4">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300 font-semibold">
          Scoreboard
        </p>
        {currentRound > 0 && (
          <p className="mt-3 text-sm text-slate-300">
            Round <span className="font-semibold text-white">{currentRound}</span> of <span className="font-semibold text-white">{settings.rounds}</span>
          </p>
        )}
      </div>
      <motion.ul className="mt-1 space-y-3">
        <AnimatePresence>
          {Array.from(
            new Map(displayers.map((player) => [player.playerId, player])).values()
          )
            .sort((a, b) => b.score - a.score)
            .map((player, index) => (
              <PlayerCard key={player.playerId} player={player} index={index} />
            ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
};
export default PlayerScores;
