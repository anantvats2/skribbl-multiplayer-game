import { GameEvent, Player } from "../../types";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useRoom } from "../../context/RoomContext";
import { CrownIcon, VolumeXIcon } from "lucide-react";
import { socket } from "../../socketHandler";
import Dialog from "../ui/Dialog";
import { useState } from "react";
import Button from "../ui/Button";
import RoomLink from "../RoomLink";

export default function PlayerCard({
  player,
  index,
}: {
  player: Player;
  index: number;
}) {
  const { creator, mutePlayer, mutedPlayers, removeMute } =
    useRoom();
  const [isOpen, setIsOpen] = useState(false);
  const isPlayerSelf = player.playerId === socket.id;
  const isMuted = mutedPlayers.includes(player.playerId);

  const handleVoteKick = () => {
    socket.emit(GameEvent.VOTE_KICK, player.playerId);
    setIsOpen(false);
  };

  const onClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <motion.div
        className={clsx(
          "relative w-full rounded-3xl border p-4 shadow-lg transition-transform duration-200 hover:-translate-y-1",
          {
            "border-amber-300/30 bg-amber-500/10": index === 0,
            "border-white/10 bg-slate-900/90": index !== 0,
          }
        )}
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-base font-semibold text-amber-300 shadow-inner shadow-black/20">
              #{index + 1}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm sm:text-base font-semibold text-white">
                {player.name} {player.playerId === socket.id && "(You)"}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                {player.playerId === creator && (
                  <CrownIcon className="text-amber-300" size={16} />
                )}
                {isMuted && (
                  <VolumeXIcon className="text-slate-400" size={16} />
                )}
                <span>{player.score} points</span>
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-inner shadow-black/20">
            {player.score}
          </div>
        </div>
      </motion.div>
      <Dialog title={player.name} isOpen={isOpen} onClose={onClose}>
        {/* Avatar & Buttons */}
        <div className="flex items-center justify-between gap-4">
          {/* Avatar */}
          <img
            src={"/logo.png"}
            alt="Player Avatar"
            className="w-32 h-32 rounded-full border border-neutral-300 dark:border-neutral-600"
          />

          {/* Buttons */}
          <div className="flex flex-col gap-3 w-1/2">
            <>
              <RoomLink className="w-full" />
            </>
            {!isPlayerSelf && (
              <>
                <Button
                  size="md"
                  className="font-bold"
                  onClick={handleVoteKick}
                >
                  Vote Kick
                </Button>
                <Button
                  size="md"
                  onClick={() => {
                    if (isMuted) removeMute(player.playerId);
                    else mutePlayer(player.playerId);
                    onClose();
                  }}
                >
                  Mute
                </Button>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
