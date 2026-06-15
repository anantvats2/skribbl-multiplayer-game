import { Server, Socket } from "socket.io";
import {
  deleteRoom,
  setRoom,
  getRoom as gR,
} from "../utils/roomManager";
import { getRoomFromSocket } from "../game/gameController";
import {
  GameEvent,
  Languages,
  Player,
  PlayerData,
  Settings,
  SettingValue,
} from "../types";
import {
  endGame,
  endRound,
  guessWord,
  handleDrawAction,
  handleNewPlayerJoin,
  handleNewRoom,
  handlePlayerLeft,
  handleSettingsChange,
  handleVoteKick,
  startGame,
  wordSelected,
} from "../game/roomController";

export function setupSocket(io: Server) {
  io.on(GameEvent.CONNECT, (socket: Socket) => {
    console.log("A user connected:", socket.id);
    socket.on(
      GameEvent.JOIN_ROOM,
      async (
        playerData: PlayerData,
        language: Languages = Languages.en,
        roomId?: string,
        isPrivate?: boolean
      ) => {
        if (!playerData) {
          socket.emit("error", "playerData is required");
          return socket.disconnect();
        }

        console.log("[JOIN_ROOM] Received:", { roomId, language, isPrivate, playerDataName: playerData.name });

        if (!roomId) {
          return await handleNewRoom(
            io,
            socket,
            playerData,
            language,
            isPrivate
          );
        }

        await handleNewPlayerJoin(roomId, socket, io, playerData, language);
      }
    );

    socket.on(GameEvent.START_GAME, async ({ words }: { words: string[] }) => {
      console.log("[START_GAME] event received", {
        socketId: socket.id,
        words,
        socketRooms: Array.from(socket.rooms),
      });

      const room = await getRoomFromSocket(socket);
      if (!room) {
        console.log("[START_GAME] stopped: room not found for socket", socket.id);
        return socket.emit(
          "error",
          "Could not find your room. Try rejoining."
        );
      }

      console.log("[START_GAME] room found:", room.roomId, {
        creator: room.creator,
        players: room.players.length,
        currentRound: room.gameState.currentRound,
        language: room.settings.language,
      });

      if (room.isPrivate && room.players.length > 0) {
        room.creator = room.players[0].playerId;
        await setRoom(room.roomId, room);
      }

      console.log("[OWNER] START_GAME check", {
        creator: room.creator,
        socketId: socket.id,
        firstPlayerId: room.players[0]?.playerId,
      });

      if (room.creator != socket.id) {
        console.log("[VALIDATION FAILED]", "You are not the host", {
          creator: room.creator,
          socketId: socket.id,
        });
        return socket.emit("error", "You are not the host");
      } else if (room.gameState.currentRound != 0) {
        console.log("[VALIDATION FAILED]", "Game already started", {
          currentRound: room.gameState.currentRound,
        });
        return socket.emit("error", "Game already started");
      } else if (room.players.length < 2) {
        console.log("[VALIDATION FAILED]", "Not enough players", {
          playerCount: room.players.length,
        });
        return socket.emit("error", "At least 2 players requred to join game");
      }
      if (words) {
        room.settings.customWords = words;
        await setRoom(room.roomId, room);
      }
      await startGame(room, io);
    });

    socket.on(GameEvent.DRAW, async (drawData: any) =>
      handleDrawAction(socket, "DRAW", drawData)
    );

    socket.on(GameEvent.DRAW_CLEAR, async () =>
      handleDrawAction(socket, "CLEAR")
    );
    socket.on(GameEvent.DRAW_UNDO, async () =>
      handleDrawAction(socket, "UNDO")
    );

    socket.on(GameEvent.GUESS, async (data: any) => {
      const { guess }: { guess: string } = data;
      const room = await getRoomFromSocket(socket);
      if (!room) return;
      await guessWord(room.roomId, guess, socket, io);
    });

    socket.on(GameEvent.WORD_SELECT, async (word: string) => {
      const room = await getRoomFromSocket(socket);
      if (!room) return;
      await wordSelected(room.roomId, word, io);
    });

    socket.on(
      GameEvent.CHANGE_SETTIING,
      async (setting: keyof Settings, value: any) => {
        await handleSettingsChange(socket, io, setting, value);
      }
    );

    socket.on(GameEvent.DISCONNECT, async () => {
      console.log("User disconnected:", socket.id);
      handlePlayerLeft(socket, io);
    });

    socket.on(GameEvent.VOTE_KICK, (playerId: string) => {
      handleVoteKick(socket, io, playerId);
    });
  });
}
