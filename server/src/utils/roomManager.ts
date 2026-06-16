import { Languages, Room, RoomState } from "../types";

class RoomManager {
  private rooms = new Map<string, Room>();

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  setRoom(roomId: string, roomData: Room): void {
    this.rooms.set(roomId, roomData);
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  getPublicRooms(): string[] {
    return Array.from(this.rooms.values())
      .filter((room) => !room.isPrivate)
      .map((room) => room.roomId);
  }

  getPublicRoom(language: Languages = Languages.en): Room | null {
    const normalizedLanguage = (() => {
      if (typeof language === "string") {
        const key = Object.keys(Languages).find((k) => k === language) as
          | keyof typeof Languages
          | undefined;
        if (key) return Languages[key];
      }

      if (Object.values(Languages).includes(language as Languages)) {
        return language as Languages;
      }

      return Languages.en;
    })();

    for (const roomId of this.getPublicRooms()) {
      const room = this.getRoom(roomId);
      if (!room) continue;
      if (
        room.gameState.roomState === RoomState.NOT_STARTED &&
        room.players.length < room.settings.players &&
        room.settings.language === normalizedLanguage
      ) {
        return room;
      }
    }
    return null;
  }

  deletePublicRooms(): void {
    const publicRoomIds = this.getPublicRooms();
    for (const roomId of publicRoomIds) {
      this.rooms.delete(roomId);
    }
    if (publicRoomIds.length > 0) {
      console.log(`Deleted ${publicRoomIds.length} public rooms`);
    } else {
      console.log("No public rooms to delete");
    }
  }
}

export const roomManager = new RoomManager();

export async function getRoom(roomId: string): Promise<Room | null> {
  return roomManager.getRoom(roomId);
}

export async function setRoom(roomId: string, roomData: Room): Promise<void> {
  roomManager.setRoom(roomId, roomData);
}

export async function deleteRoom(roomId: string): Promise<void> {
  roomManager.deleteRoom(roomId);
}

export async function getPublicRoom(
  language: Languages = Languages.en
): Promise<Room | null> {
  return roomManager.getPublicRoom(language);
}

export async function getPublicRooms(): Promise<string[]> {
  return roomManager.getPublicRooms();
}

export async function deletePublicRooms(): Promise<void> {
  roomManager.deletePublicRooms();
}
