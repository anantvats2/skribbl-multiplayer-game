import React, { useEffect, useState } from "react";
import { GameEvent, Room } from "./types";
import { socket } from "./socketHandler";
import JoinGameForm from "./components/JoinGameForm";
import Game from "./components/Game";
import { RoomProvider } from "./context/RoomContext";

const Home: React.FC = () => {
  const [room, setRoom] = useState<Room | null>(null);

  function handleRoomJoin(room: Room) {
    console.log("Message");
    if (room.roomId) {
      sessionStorage.setItem("sketchbattle_invite_roomId", room.roomId);
    }
    setRoom(room);
  }

  useEffect(() => {
    function handleKicked() {
      setRoom(null);
      socket.disconnect();
    }

    socket.on(GameEvent.JOINED_ROOM, handleRoomJoin);
    socket.on(GameEvent.KICKED, handleKicked);

    return () => {
      socket.off(GameEvent.JOINED_ROOM, handleRoomJoin);
      socket.off(GameEvent.KICKED, handleKicked);
    };
  }, []);

  return (
    <div className="">
      <RoomProvider activeRoom={room}>
        {room ? <Game room={room} /> : <JoinGameForm />}
      </RoomProvider>
    </div>
  );
};

export default Home;
