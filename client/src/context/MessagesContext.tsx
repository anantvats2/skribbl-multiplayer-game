import React, { createContext, useEffect, useState } from "react";
import { EndTurnData, GameEvent, Player } from "../types";
import { socket } from "../socketHandler";
import { IMessage, MessageType } from "../components/Chat/Message";
import { useRoom } from "./RoomContext";

interface MessagesContextValue {
  messages: IMessage[];
}

// eslint-disable-next-line react-refresh/only-export-components
export const MessageContext = createContext<MessagesContextValue | undefined>(
  undefined
);

export default function MessagesContext({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const { currentPlayer, me, myTurn, mutedPlayers } = useRoom();

  function addMessageToChat(message: string, player: Player) {
    if (player.guessed && player.playerId != socket.id) return;
    if (mutedPlayers.includes(player.playerId)) return;
    const senderName = player.avatar ? `${player.avatar} ${player.name}` : player.name;
    if (myTurn) {
      setMessages([
        ...messages,
        { sender: senderName, message, type: MessageType.GuessClose },
      ]);
    }
    setMessages([
      ...messages,
      { sender: senderName, message, type: MessageType.Guess },
    ]);
  }

  function addPlayerJoinMessage(player: Player) {
    const senderName = player.avatar ? `${player.avatar} ${player.name}` : player.name;
    setMessages([
      ...messages,
      { sender: senderName, message: "", type: MessageType.PlayerJoin },
    ]);
  }

  function addPlayerLeftMessage(player: Player) {
    const senderName = player.avatar ? `${player.avatar} ${player.name}` : player.name;
    setMessages([
      ...messages,
      { sender: senderName, message: "", type: MessageType.PlayerLeft },
    ]);
  }
  function addErrorMessage(message: string) {
    setMessages([
      ...messages,
      { sender: "", message, type: MessageType.Error },
    ]);
  }

  function addGuessedMessage(player: Player) {
    const senderName = player.avatar ? `${player.avatar} ${player.name}` : player.name;
    setMessages([
      ...messages,
      {
        sender: senderName,
        message: "has guessed the word",
        type: MessageType.WordGuessed,
      },
    ]);
  }
  function addWordChosen() {
    if (!currentPlayer) return;
    const senderName = currentPlayer.avatar ? `${currentPlayer.avatar} ${currentPlayer.name}` : currentPlayer.name;
    setMessages([
      ...messages,
      {
        sender: senderName,
        message: "is now drawing",
        type: MessageType.WordChoosen,
      },
    ]);
  }

  function addWordWas(_: unknown, data: EndTurnData) {
    if (!currentPlayer) return;
    setMessages([
      ...messages,
      {
        sender: "",
        message: data.word,
        type: MessageType.WordWas,
      },
    ]);
  }

  function clearChat() {
    setMessages([]);
  }

  function handleVoteKicking({
    voter,
    player: votee,
    votes,
    votesNeeded,
  }: {
    voter: string;
    player: string;
    votes: number;
    votesNeeded: number;
  }) {
    setMessages([
      ...messages,
      {
        sender: "",
        message: `${voter} is voting to kick ${votee} (${votes}/${votesNeeded})`,
        type: MessageType.VoteKick,
      },
    ]);
  }

  function handleHostKickMessage(player: Player) {
    const targetName = player.avatar ? `${player.avatar} ${player.name}` : player.name;
    setMessages([
      ...messages,
      {
        sender: "",
        message: `${targetName} was kicked by the host`,
        type: MessageType.VoteKick,
      },
    ]);
  }

  useEffect(() => {
    if (me) {
      addPlayerJoinMessage(me);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    socket.on(GameEvent.GAME_STARTED, clearChat);
    socket.on(GameEvent.GUESS, addMessageToChat);
    socket.on(GameEvent.GUESSED, addGuessedMessage);
    socket.on(GameEvent.PLAYER_JOINED, addPlayerJoinMessage);
    socket.on(GameEvent.PLAYER_LEFT, addPlayerLeftMessage);
    socket.on(GameEvent.WORD_CHOSEN, addWordChosen);
    socket.on(GameEvent.TURN_END, addWordWas);
    socket.on(GameEvent.KICKING_VOTE, handleVoteKicking);
    socket.on(GameEvent.HOST_KICK, handleHostKickMessage);
    socket.on("error", addErrorMessage);

    return () => {
      socket.off(GameEvent.GAME_STARTED, clearChat);
      socket.off(GameEvent.GUESS, addMessageToChat);
      socket.off(GameEvent.PLAYER_JOINED, addPlayerJoinMessage);
      socket.off(GameEvent.PLAYER_LEFT, addPlayerLeftMessage);
      socket.off(GameEvent.GUESSED, addGuessedMessage);
      socket.off(GameEvent.WORD_CHOSEN, addWordChosen);
      socket.off(GameEvent.TURN_END, addWordWas);
      socket.off(GameEvent.KICKING_VOTE, handleVoteKicking);
      socket.off(GameEvent.HOST_KICK, handleHostKickMessage);
      socket.off("error", addErrorMessage);
    };
  });

  return (
    <MessageContext.Provider
      value={{
        messages,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
}
