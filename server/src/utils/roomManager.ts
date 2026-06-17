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
      // Complete map of all short codes → enum values
      const languageMap: Record<string, Languages> = {
        en: Languages.en,
        es: Languages.es,
        fr: Languages.fr,
        de: Languages.de,
        it: Languages.it,
        nl: Languages.nl,
        pt: Languages.pt,
        ru: Languages.ru,
        tr: Languages.tr,
        zh: Languages.zh,
      };

      const key = String(language);

      // Case 1: short code sent by client (e.g. "de", "zh")
      if (key in languageMap) {
        return languageMap[key];
      }

      // Case 2: full enum value already stored (e.g. "German", "Chinese")
      if (Object.values(Languages).includes(language as Languages)) {
        return language as Languages;
      }

      // Default fallback
      return Languages.en;
    })();

    console.log(`[PUBLIC_MATCHMAKING] Normalized language for search: ${normalizedLanguage}`);

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
