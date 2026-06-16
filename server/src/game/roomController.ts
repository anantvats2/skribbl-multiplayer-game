import { Server, Socket } from "socket.io";
import {
  Languages,
  Player,
  PlayerData,
  Room,
  RoomState,
  Settings,
} from "../types";
import {
  deleteRoom,
  getPublicRoom,
  getRoom,
  setRoom,
} from "../utils/roomManager";
import { GameEvent, RounEndReason, SettingValue } from "../types";
import { convertToUnderscores, getRandomWords } from "../utils/word";
import { generateEmptyRoom } from "./gameController";
import { getRoomFromSocket } from "./gameController";
import {
  BONUS_PER_GUESS,
  DRAWER_POINTS,
  END_ROUND_TIME,
  HINTS_TIME,
  WINNER_SHOW_TIME,
  WORDCHOOSE_TIME,
} from "../constants";

const timers = new Map();
const hintTimers = new Map();

// This is for new game on public rooms
const startGameTimers = new Map();

function clearTimers(roomId: string) {
  const timer = timers.get(roomId);
  const hintTimer = hintTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(roomId);
  }
  if (hintTimer) {
    clearTimeout(hintTimer);
    hintTimers.delete(roomId);
  }
}

export async function startGame(room: Room, io: Server) {
  console.log("[START_GAME] startGame called for room:", room.roomId, "language:", room.settings.language);
  clearTimers(room.roomId);
  room.gameState.currentRound = 1;
  room.gameState.currentPlayer = 0;
  room.gameState.guessedWords = [];
  room.gameState.drawingData = [];
  room.gameState.hintLetters = [];
  (room.gameState.roomState = RoomState.CHOOSING_WORD),
    await setRoom(room.roomId, room);
  console.log("[START_GAME] Room saved with language:", room.settings.language);
  console.log("[START_GAME] emitting GAME_STARTED to room:", room.roomId);
  io.to(room.roomId).emit(GameEvent.GAME_STARTED, room);
  await nextRound(room.roomId, io);
  console.log("[START_GAME] first round initialized for room:", room.roomId);
  return room;
}

export async function endRound(
  roomId: string,
  io: Server,
  reason: RounEndReason = RounEndReason.TIMEUP
) {
  let room = await getRoom(roomId);
  if (!room) return;

  console.log(`[ROUND_END] Ending round in room ${roomId}. Reason: ${reason}. Current round: ${room.gameState.currentRound}`);
  clearTimers(room.roomId);
  if (reason === RounEndReason.LEFT && room.players.length < 2) {
    console.log(`[ROUND_END] Exiting round end early since less than 2 players remain.`);
    return;
  }

  room.gameState.currentPlayer += 1;

  // Check if playerCounter needs to be incremented
  if (room.gameState.currentPlayer >= room.players.length) {
    // Round end
    room.gameState.currentRound += 1;
    room.gameState.currentPlayer = 0;
  }
  await setRoom(roomId, room);

  await givePoints(roomId);
  room = await getRoom(roomId);
  if (!room) return;
  room.gameState.drawingData = [];
  room.players = room.players.map((e) => {
    return { ...e, guessed: false, guessedAt: null };
  });
  await setRoom(roomId, room);

  io.to(room.roomId).emit(GameEvent.TURN_END, room, {
    word: room.gameState.word,
    reason,
    time: END_ROUND_TIME,
  });
  room.gameState.word = "";
  room.gameState.roomState = RoomState.CHOOSING_WORD;
  await setRoom(roomId, room);

  setTimeout(async () => {
    if (room.gameState.currentRound > room.settings.rounds) {
      return await endGame(roomId, io);
    }
    await nextRound(roomId, io);
  }, END_ROUND_TIME * 1000);
}

export async function guessWord(
  roomId: string,
  guess: string,
  socket: Socket,
  io: Server
) {
  const room = await getRoom(roomId);
  if (!room) return;

  const player = room.players.find((e) => e.playerId === socket.id);
  if (!player) return;

  const currentPlayer = room.players[room.gameState.currentPlayer];

  if (
    player.playerId !== currentPlayer.playerId &&
    room.gameState.word === guess.toLowerCase() &&
    !player.guessed
  ) {
    // Mark player as guessed
    player.guessed = true;
    player.guessedAt = new Date();

    await setRoom(room.roomId, room);
    io.to(room.roomId).emit(GameEvent.GUESSED, player);

    // Check if all players (except the current one) have guessed
    if (
      room.players.every(
        (p) => p.guessed || p.playerId === currentPlayer.playerId
      )
    ) {
      await endRound(room.roomId, io, RounEndReason.ALL_GUESSED);
    }
  } else {
    io.to(room.roomId).emit(GameEvent.GUESS, guess, player);
  }
}

export async function nextRound(roomId: string, io: Server) {
  const room = await getRoom(roomId);
  if (!room) return;

  console.log("[HINT] round start - round:", room.gameState.currentRound, "hintLetters reset");

  // Set the current player
  const currentPlayer = room.players[room.gameState.currentPlayer];
  if (!currentPlayer) return;

  // Log language for debugging
  console.log("[LANGUAGE]", room.settings.language);

  const language = (() => {
    const value = room.settings.language;

    if (typeof value === "string") {
      const key = Object.keys(Languages).find((k) => k === value);
      if (key) {
        return Languages[key as keyof typeof Languages];
      }
    }

    if (Object.values(Languages).includes(value as Languages)) {
      return value as Languages;
    }

    console.log("[LANGUAGE] invalid or missing, defaulting to English", value);
    return Languages.en;
  })();

  console.log("[LANGUAGE] normalized:", language);

  // Get random words
  const words = await getRandomWords(
    room.settings.wordCount,
    language,
    room.settings.onlyCustomWords,
    room.settings.customWords
  );

  // Send words to current player
  io.to(currentPlayer.playerId).emit(GameEvent.CHOOSE_WORD, {
    words,
    time: WORDCHOOSE_TIME,
  });

  // Send choosing word event to other players in the room
  io.to(room.roomId)
    .except(currentPlayer.playerId)
    .emit(GameEvent.CHOOSING_WORD, { currentPlayer, time: WORDCHOOSE_TIME });

  room.gameState.timerStartedAt = new Date();
  await setRoom(room.roomId, room);

  const timeOut = setTimeout(async () => {
    const room = await getRoom(roomId);
    if (!room) return;
    if (room.gameState.word != "") return;
    // Not selected a word;
    const randomWord = words[Math.floor(Math.random() * words.length)];
    await wordSelected(roomId, randomWord, io);
  }, WORDCHOOSE_TIME * 1000);
  timers.set(roomId, timeOut);
}

export async function wordSelected(roomId: string, word: string, io: Server) {
  const room = await getRoom(roomId);
  if (!room) return;
  clearTimers(room.roomId);

  console.log("[DRAW_CLEAR] drawingData length before reset:", room.gameState.drawingData.length);
  room.gameState.drawingData = [];
  console.log("[DRAW_CLEAR] drawingData length after reset:", room.gameState.drawingData.length);
  
  // Reset hints for new word
  room.gameState.hintLetters = [];
  console.log("[HINT] word selected - hintLetters cleared for new word");

  room.gameState.word = word;
  room.gameState.roomState = RoomState.DRAWING;
  room.gameState.timerStartedAt = new Date();
  await setRoom(room.roomId, room);

  await setRoom(roomId, room);

  const player = room.players[room.gameState.currentPlayer];
  if (!player) return;

  // Clear canvas for all players at start of new turn
  console.log("[DRAW_CLEAR] clearing canvas");
  io.to(room.roomId).emit(GameEvent.CLEAR_DRAW);

  // Send the selected word to the drawer
  io.to(player.playerId).emit(GameEvent.WORD_CHOSEN, {
    word,
    time: room.settings.drawTime,
  });

  // convert the word into array of letter lengths
  const words_lens = convertToUnderscores(word);
  io.to(room.roomId).except(player.playerId).emit(GameEvent.GUESS_WORD_CHOSEN, {
    word: words_lens,
    time: room.settings.drawTime,
  });

  const timeOut = setTimeout(async () => {
    await endRound(roomId, io, RounEndReason.TIMEUP);
  }, room.settings.drawTime * 1000);
  timers.set(roomId, timeOut);

  if (room.settings.hints > 0) {
    console.log("[HINT] timer created for room:", roomId, "hints available:", room.settings.hints);
    const hintsTimeout = setTimeout(async () => {
      await sendHint(io, roomId);
    }, room.settings.drawTime * 0.5 * 1000);
    hintTimers.set(roomId, hintsTimeout);
  }
}

export async function givePoints(roomId: string) {
  const room = await getRoom(roomId);
  if (!room) return;
  const now = new Date();
  const playersWhoGuessed = room.players.filter((player) => player.guessed);
  if (playersWhoGuessed.length === 0) {
    room.players.forEach((player) => {
      player.score += 0;
    });
    await setRoom(room.roomId, room);
    return;
  }

  playersWhoGuessed.forEach((player, index) => {
    const points = 200;
    const guessTime = Math.abs(
      (now.getTime() - new Date(player.guessedAt ?? now).getTime()) / 1000
    );
    player.score += Math.round(Math.max(points - guessTime, 0));
  });

  const currentPlayer = room.players[room.gameState.currentPlayer];
  if (!currentPlayer) return;
  currentPlayer.score +=
    DRAWER_POINTS + playersWhoGuessed.length * BONUS_PER_GUESS;
  await setRoom(room.roomId, room);
}

export async function endGame(roomId: string, io: Server) {
  const room = await getRoom(roomId);
  if (!room) return;

  console.log(`[GAME_END] Ending game in room ${roomId}. Clearing all timers.`);
  clearTimers(room.roomId);

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  console.log(`[WINNER_CALCULATION] Leaderboard for room ${roomId}:`, sortedPlayers.map(p => `${p.name}: ${p.score} pts`));

  room.gameState.currentRound = 0;
  room.gameState.word = "";
  room.gameState.guessedWords = [];
  room.gameState.roomState = RoomState.NOT_STARTED;
  room.vote_kickers = [];
  await setRoom(roomId, room);
  io.to(roomId).emit(GameEvent.GAME_ENDED, { room, time: WINNER_SHOW_TIME });

  if (room.players.length === 0) {
    console.log(`[GAME_END] No players left in room ${roomId}. Deleting room.`);
    await deleteRoom(roomId);
    if (startGameTimers.has(roomId)) {
      clearTimeout(startGameTimers.get(roomId));
      startGameTimers.delete(roomId);
    }
  } else if (!room.isPrivate && room.players.length >= 2) {
    const timeOut = setTimeout(async () => {
      await startGame(room, io);
    }, WINNER_SHOW_TIME * 1000);
    startGameTimers.set(roomId, timeOut);
  }
}

export const handleNewRoom = async (
  io: Server,
  socket: Socket,
  playerData: PlayerData,
  language: Languages,
  isPrivate?: boolean
) => {
  console.log("[HANDLE_NEW_ROOM] Language received:", language);
  let roomId;
  if (isPrivate) {
    roomId = await generateEmptyRoom(socket, isPrivate, language);
  } else {
    console.log("[MATCHMAKING] searching public rooms");
    const room = await getPublicRoom(language);
    if (!room) {
      console.log("[MATCHMAKING] creating new public room");
      roomId = await generateEmptyRoom(socket, false, language);
    } else {
      console.log(`[MATCHMAKING] found room: ${room.roomId}`);
      console.log("[MATCHMAKING] joining existing room");
      roomId = room.roomId;
    }
  }

  console.log("[HANDLE_NEW_ROOM] Calling handleNewPlayerJoin with roomId:", roomId, "language:", language);
  handleNewPlayerJoin(roomId, socket, io, playerData, language);
};

export async function handleDrawAction(
  socket: Socket,
  action: "DRAW" | "CLEAR" | "UNDO",
  drawData?: any
) {
  const room = await getRoomFromSocket(socket);
  if (!room || room.gameState.currentRound === 0) return;

  const currentPlayer = room.players[room.gameState.currentPlayer];
  if (!currentPlayer || currentPlayer.playerId !== socket.id) return;

  switch (action) {
    case "DRAW":
      if (!drawData) return;
      room.gameState.drawingData.push(drawData);
      socket.to(room.roomId).emit(GameEvent.DRAW_DATA, drawData);
      break;

    case "CLEAR":
      room.gameState.drawingData = [];
      socket.to(room.roomId).emit(GameEvent.CLEAR_DRAW);
      break;

    case "UNDO":
      room.gameState.drawingData.pop();
      socket.to(room.roomId).emit(GameEvent.UNDO_DRAW);
      break;
  }

  await setRoom(room.roomId, room);
}

export async function removePlayerFromRoom(
  roomId: string,
  playerId: string,
  io: Server
) {
  const room = await getRoom(roomId);
  if (!room) return;

  const playerIndex = room.players.findIndex((p) => p.playerId === playerId);
  if (playerIndex === -1) return;

  const player = room.players[playerIndex];
  
  console.log(`[PLAYER_REMOVAL] Removing player ${player.name} (${playerId}) from room ${roomId}. Current Round: ${room.gameState.currentRound}`);

  const isCurrentDrawer = room.gameState.currentPlayer === playerIndex;

  // Filter player out
  room.players = room.players.filter((p) => p.playerId !== playerId);
  room.vote_kickers = room.vote_kickers.filter((e) => e[0] !== playerId);

  // If host left, assign new host
  if (room.creator === playerId && room.players.length > 0 && room.isPrivate) {
    room.creator = room.players[0].playerId;
    console.log(`[PLAYER_REMOVAL] Host left. New host assigned: ${room.creator}`);
  }

  // Save the state first
  await setRoom(roomId, room);

  // Emit left event to remaining players
  io.to(roomId).emit(GameEvent.PLAYER_LEFT, player);

  if (room.gameState.currentRound >= 1) {
    console.log(`[PLAYER_REMOVAL] Active game. Remaining players count: ${room.players.length}`);
    
    // Check if player count dropped below 2
    if (room.players.length < 2) {
      console.log(`[PLAYER_REMOVAL] Player count dropped below 2. Ending game.`);
      await endGame(roomId, io);
      return;
    }

    // Adjust currentPlayer index
    if (playerIndex < room.gameState.currentPlayer) {
      room.gameState.currentPlayer -= 1;
      console.log(`[PLAYER_REMOVAL] Decrementing currentPlayer index to ${room.gameState.currentPlayer} (removed player was before drawer)`);
      await setRoom(roomId, room);
    } else if (isCurrentDrawer) {
      room.gameState.currentPlayer -= 1;
      console.log(`[PLAYER_REMOVAL] Drawer removed. Decremented currentPlayer to ${room.gameState.currentPlayer} and ending round`);
      await setRoom(roomId, room);
      await endRound(roomId, io, RounEndReason.LEFT);
    }
  } else {
    // If lobby not started and players length is 0, delete room
    if (room.players.length === 0) {
      console.log(`[PLAYER_REMOVAL] No players left in lobby. Deleting room ${roomId}`);
      await deleteRoom(roomId);
      clearTimers(roomId);
      if (startGameTimers.has(roomId)) {
        clearTimeout(startGameTimers.get(roomId));
        startGameTimers.delete(roomId);
      }
    } else if (room.players.length < 2) {
      if (startGameTimers.has(roomId)) {
        console.log(`[PLAYER_REMOVAL] Player count dropped below 2 in lobby. Cancelling auto-start timer.`);
        clearTimeout(startGameTimers.get(roomId));
        startGameTimers.delete(roomId);
      }
    }
  }
}

export const handlePlayerLeft = async (socket: Socket, io: Server) => {
  const room = await getRoomFromSocket(socket);
  if (!room) return;

  const player = room.players.find((e) => e.playerId === socket.id);
  if (!player) return;

  await removePlayerFromRoom(room.roomId, socket.id, io);
};

export const handleSettingsChange = async (
  socket: Socket,
  io: Server,
  setting: keyof Settings,
  value: any
) => {
  if (typeof setting !== "string") return;

  const room = await getRoomFromSocket(socket);
  if (!room) return;

  if (!(setting in room.settings)) {
    console.log("[VALIDATION FAILED]", "Invalid setting value", setting);
    return socket.emit("error", "Invalid setting value");
  }

  console.log("[SETTINGS_CHANGE] Updating setting:", setting, "value:", value, "current language:", room.settings.language);
  let parsedValue = value;
  const expectedType = typeof room.settings[setting];

  if (expectedType === "number" && typeof value === "string") {
    parsedValue = Number(value);
    if (Number.isNaN(parsedValue)) {
      console.log("[VALIDATION FAILED]", `Invalid number for ${setting}`, value);
      return socket.emit("error", `Invalid value type for ${setting}`);
    }
  } else if (expectedType === "boolean" && typeof value !== "boolean") {
    parsedValue =
      value === true || value === "true" || value === 1 || value === "1";
  } else if (setting === "language" && typeof value === "string") {
    console.log("[LANG_INPUT]", value);
    console.log("[LANG_BEFORE]", room.settings.language);
    
    const langKey = value as keyof typeof Languages;
    if (langKey in Languages) {
      parsedValue = Languages[langKey];
    }
    
    console.log("[LANG_AFTER]", parsedValue);
    console.log("[SETTINGS_CHANGE] Language key lookup - input:", value, "found in enum:", langKey in Languages, "parsed value:", parsedValue);
  } else if (typeof value !== expectedType) {
    console.log(
      "[VALIDATION FAILED]",
      `Invalid value type for ${setting}`,
      value
    );
    return socket.emit("error", `Invalid value type for ${setting}`);
  }

  console.log("[SETTINGS_CHANGE] Final parsed value:", setting, "=", parsedValue, "type:", typeof parsedValue);

  if (setting === "language") {
    const normalizedLanguage =
      typeof parsedValue === "string" && parsedValue in Languages
        ? Languages[parsedValue as keyof typeof Languages]
        : Object.values(Languages).includes(parsedValue as Languages)
        ? (parsedValue as Languages)
        : Languages.en;

    if (normalizedLanguage !== parsedValue) {
      console.log("[SETTINGS_CHANGE] Normalized language from:", parsedValue, "to:", normalizedLanguage);
    }
    parsedValue = normalizedLanguage;
  }

  // @ts-ignore
  room.settings[setting] = parsedValue as SettingValue;

  console.log("[ROOM_LANGUAGE_AFTER_SAVE]", room.settings.language);
  await setRoom(room.roomId, room);
  io.to(room.roomId).emit(GameEvent.SETTINGS_CHANGED, setting, parsedValue);
};

export async function sendHint(io: Server, roomId: string) {
  const room = await getRoom(roomId);
  if (!room) return;
  const word = room.gameState.word;
  if (!word) return;
  if (room.gameState.hintLetters.length >= room.settings.hints) {
    console.log("[HINT] max hints reached for room:", roomId, "total hints:", room.gameState.hintLetters.length);
    return;
  }

  if (hintTimers.get(roomId)) clearTimeout(hintTimers.get(roomId));

  // Cannot make the whole word appear randomly
  if (room.gameState.hintLetters.length - 1 >= word.length) {
    console.log("[HINT] cannot reveal more letters for room:", roomId);
    return;
  }

  const revealedIndices = new Set<number>();

  // Reveal some characters based on word length
  while (revealedIndices.size < Math.ceil(word.length / 3)) {
    const index = Math.floor(Math.random() * word.length);
    revealedIndices.add(index);
  }

  // Create an array of revealed letters with indices
  const hintArray = Array.from(revealedIndices).map((index) => ({
    index,
    letter: word[index],
  }));
  // Get a random element from the hint array
  const randomIndex = Math.floor(Math.random() * hintArray.length);
  const hint = hintArray[randomIndex];
  room.gameState.hintLetters.push(hint);

  console.log("[HINT] hint revealed for room:", roomId, "letter:", hint.letter, "at index:", hint.index, "hints count:", room.gameState.hintLetters.length);

  // Emit hint to the room
  io.to(roomId)
    .except(room.players[room.gameState.currentPlayer].playerId)
    .emit(GameEvent.GUESS_HINT, hint);

  if (room.gameState.hintLetters.length !== room.settings.hints) {
    hintTimers.set(roomId, setTimeout(sendHint, HINTS_TIME * 1000, io, roomId));
  }
}

export async function handleNewPlayerJoin(
  roomId: string,
  socket: Socket,
  io: Server,
  playerData: PlayerData,
  language: Languages
) {
  const room = await getRoom(roomId);
  if (!room) {
    console.log("[INVITE] room not found:", roomId);
    socket.emit(
      "error",
      "Room not found. It may have expired or the server was restarted."
    );
    return socket.disconnect();
  }

  console.log("[INVITE] room found:", roomId, "current settings language:", room.settings.language, "received language param:", language);

  if (room.players.length >= room.settings.players) {
    socket.emit("error", "The room you're trying to join is full");
    return socket.disconnect();
  }

  const player: Player = {
    ...playerData,
    score: 0,
    playerId: socket.id,
    guessed: false,
    guessedAt: null,
  };

  room.players.push(player);

  if (room.isPrivate && room.players.length > 0) {
    room.creator = room.players[0].playerId;
  }

  await setRoom(roomId, room);

  console.log("[INVITE] player added to room:", {
    roomId,
    playerId: player.playerId,
    playerName: player.name,
  });

  socket.join(roomId);
  socket.emit(GameEvent.JOINED_ROOM, room);
  io.to(room.roomId).emit(GameEvent.PLAYER_JOINED, player);

  if (
    !room.isPrivate &&
    room.players.length >= 2 &&
    !startGameTimers.has(roomId) &&
    room.gameState.currentRound === 0
  ) {
    console.log(`[MATCHMAKING] Room ${roomId} has >= 2 players. Scheduling auto-start in 10s.`);
    const timeOut = setTimeout(async () => {
      const currentRoom = await getRoom(roomId);
      if (currentRoom && currentRoom.players.length >= 2 && currentRoom.gameState.currentRound === 0) {
        console.log(`[MATCHMAKING] Starting game automatically for room ${roomId}`);
        await startGame(currentRoom, io);
      }
      startGameTimers.delete(roomId);
    }, 10000);
    startGameTimers.set(roomId, timeOut);
  }

  if (room.gameState.roomState != RoomState.NOT_STARTED) {
    handleInBetweenJoin(roomId, socket, io);
  }
}

export async function handleInBetweenJoin(
  roomId: string,
  socket: Socket,
  io: Server
) {
  const room = await getRoom(roomId);
  if (!room) return;
  socket.join(roomId);

  // subtract now from timerStartedAt
  const now = new Date();
  const timeElapsed =
    now.getTime() - new Date(room.gameState.timerStartedAt).getTime();
  const timeLeft =
    (room.gameState.roomState === RoomState.CHOOSING_WORD
      ? WORDCHOOSE_TIME
      : room.settings.drawTime) *
      1000 -
    timeElapsed;
  if (timeLeft < 0) return;
  const time = Math.round(timeLeft / 1000);

  const gameStateWithoutWord = {
    ...room.gameState,
    word: convertToUnderscores(room.gameState.word),
    time,
  };
  socket.emit(GameEvent.GAME_STATE, { gameState: gameStateWithoutWord });
}

export async function handleVoteKick(
  socket: Socket,
  io: Server,
  playerId: string
) {
  const room = await getRoomFromSocket(socket);
  if (!room) return;

  const voteKickers = room.vote_kickers;
  const player = room.players.find((e) => e.playerId === playerId);
  if (!player) return;

  const voter = room.players.find((e) => e.playerId === socket.id);
  if (!voter) return;

  // Prevent self-voting
  if (voter.playerId === player.playerId) return;

  // Prevent voting to kick the host
  if (player.playerId === room.creator) return;

  const voteKicker = voteKickers.find((e) => e[0] === playerId);
  if (!voteKicker) {
    voteKickers.push([playerId, [voter.playerId]]);
  } else {
    if (voteKicker[1].includes(voter.playerId)) return;
    voteKicker[1].push(voter.playerId);
  }

  const votesNeeded = Math.ceil(room.players.length / 2);
  const votes = voteKickers.find((e) => e[0] === playerId)?.[1].length ?? 0;

  io.to(room.roomId).emit(GameEvent.KICKING_VOTE, {
    voter: voter.avatar ? `${voter.avatar} ${voter.name}` : voter.name,
    player: player.avatar ? `${player.avatar} ${player.name}` : player.name,
    votes,
    votesNeeded,
  });

  if (votes >= votesNeeded) {
    console.log(`[VOTE_KICK_COMPLETE] Kick threshold reached for player ${player.name} (${playerId}) in room ${room.roomId} (${votes}/${votesNeeded} votes)`);
    io.to(playerId).emit(GameEvent.KICKED);
    io.sockets.sockets.get(playerId)?.leave(room.roomId);
    await removePlayerFromRoom(room.roomId, playerId, io);
  } else {
    await setRoom(room.roomId, room);
  }
}

export async function handleHostKick(
  socket: Socket,
  io: Server,
  playerId: string
) {
  const room = await getRoomFromSocket(socket);
  if (!room) return;

  const host = room.players.find((e) => e.playerId === socket.id);
  if (!host || room.creator !== socket.id) {
    console.log(`[HOST_KICK_REJECTED] Socket ${socket.id} is not the host of room ${room.roomId}`);
    return socket.emit("error", "Only the host can kick players directly");
  }

  const player = room.players.find((e) => e.playerId === playerId);
  if (!player) {
    console.log(`[HOST_KICK_REJECTED] Player ${playerId} not found in room ${room.roomId}`);
    return;
  }

  console.log(`[HOST_KICK_COMPLETE] Host ${host.name} kicked player ${player.name} (${playerId}) directly from room ${room.roomId}`);

  // Emit kicked event directly to the kicked client
  io.to(playerId).emit(GameEvent.KICKED);
  
  // Kick the socket from the socket.io room group
  io.sockets.sockets.get(playerId)?.leave(room.roomId);

  // Emit host kick event to remaining players for chat display
  io.to(room.roomId).emit(GameEvent.HOST_KICK, player);

  // Remove the player from the room state
  await removePlayerFromRoom(room.roomId, playerId, io);
}
