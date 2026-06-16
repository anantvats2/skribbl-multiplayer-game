import React, { useEffect, useState } from "react";
import { GameEvent, Languages, Settings, SettingValue } from "../types";
import { socket } from "../socketHandler";
import { useRoom } from "../context/RoomContext";
import RoomLink from "./RoomLink";
import Button from "./ui/Button";
import {
  Clock,
  Gamepad2,
  Globe,
  Lightbulb,
  RotateCw,
  Users,
} from "lucide-react";

const GameSettings: React.FC = () => {
  const { settings, creator, changeSetting, isPrivateRoom, players } = useRoom();

  // State for settings
  const [gameSettings, setGameSettings] = useState<Settings>(settings);
  const [customWords, setCustomWords] = useState<string>(
    settings.customWords.join(",")
  );

  function normalizeSettingValue(setting: SettingValue, value: unknown) {
    switch (setting) {
      case SettingValue.players:
      case SettingValue.drawTime:
      case SettingValue.rounds:
      case SettingValue.wordCount:
      case SettingValue.hints:
        return Number(value);
      case SettingValue.language:
        if (typeof value === "string" && value in Languages) {
          return Languages[value as keyof typeof Languages];
        }
        return value;
      case SettingValue.onlyCustomWords:
        return Boolean(value);
      default:
        return value;
    }
  }

  function getLanguageSelectValue(language: Languages | string) {
    if (typeof language === "string" && language in Languages) {
      return Languages[language as keyof typeof Languages];
    }
    return language;
  }

  function handleSettingChange(
    setting: SettingValue,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    emitEvent: boolean = false
  ) {
    const normalizedValue = normalizeSettingValue(setting, value) as any;
    console.log("[VALIDATION]", setting, normalizedValue);
    if (setting === SettingValue.language) {
      console.log("[LANGUAGE_DROPDOWN] value:", value, "normalized:", normalizedValue);
    }

    changeSetting(setting, normalizedValue.toString());
    switch (setting) {
      case SettingValue.players:
        setGameSettings({ ...gameSettings, players: Number(normalizedValue) });
        break;
      case SettingValue.drawTime:
        setGameSettings({ ...gameSettings, drawTime: Number(normalizedValue) });
        break;
      case SettingValue.rounds:
        setGameSettings({ ...gameSettings, rounds: Number(normalizedValue) });
        break;
      case SettingValue.wordCount:
        setGameSettings({
          ...gameSettings,
          wordCount: Number(normalizedValue),
        });
        break;
      case SettingValue.hints:
        setGameSettings({ ...gameSettings, hints: Number(normalizedValue) });
        break;
      case SettingValue.language:
        setGameSettings({
          ...gameSettings,
          language: normalizedValue as Languages,
        });
        break;
      case SettingValue.onlyCustomWords:
        setGameSettings({
          ...gameSettings,
          onlyCustomWords: Boolean(normalizedValue),
        });
        break;

      default:
        break;
    }

    if (emitEvent && isOwner) {
      socket.emit(GameEvent.CHANGE_SETTIING, setting, normalizedValue);
    }
  }

  useEffect(() => {
    socket.on(GameEvent.SETTINGS_CHANGED, handleSettingChange);

    return () => {
      socket.off(GameEvent.SETTINGS_CHANGED, handleSettingChange);
    };
  });

  useEffect(() => {
    setGameSettings(settings);
    setCustomWords(settings.customWords.join(","));
  }, [settings]);

  const isOwner =
    Boolean(creator && socket.id && creator === socket.id) ||
    (isPrivateRoom && players[0]?.playerId === socket.id);

  const handleStart = () => {
    console.log("[OWNER] handleStart", {
      socketId: socket.id,
      creator,
      firstPlayerId: players[0]?.playerId,
      isOwner,
    });
    if (!isOwner) {
      console.log("[START_GAME] stopped: not owner");
      return;
    }
    console.log("[START_GAME] emitting startGame event");
    socket.emit(GameEvent.START_GAME, {
      words: customWords.split(",").map((w) => w.trim()).filter(Boolean),
    });
  };

  const settingsOptions = [
    {
      label: "Players",
      value: gameSettings.players,
      type: SettingValue.players,
      icon: <Users size={18} />,
      options: [...Array(7)].map((_, i) => {
        return { value: i + 2, label: i + 2 };
      }),
    },
    {
      label: "Language",
      value: getLanguageSelectValue(gameSettings.language),
      type: SettingValue.language,
      icon: <Globe size={18} />,
      options: Object.entries(Languages).map(([, val]) => ({
        value: val,
        label: val,
      })),
    },
    {
      label: "Drawtime",
      value: gameSettings.drawTime,
      type: SettingValue.drawTime,
      icon: <Clock size={18} />,
      options: [...Array(23)].map((_, i) => {
        return { value: i * 10 + 20, label: i * 10 + 20 };
      }),
    },
    {
      label: "Rounds",
      value: gameSettings.rounds,
      type: SettingValue.rounds,
      icon: <RotateCw size={18} />,
      options: [...Array(8)].map((_, i) => {
        return { value: i + 1, label: i + 1 };
      }),
    },
    // { label: "Game Mode", value: gameMode, setter: setGameMode, icon: <Gamepad2 size={18} />, options: ["Normal", "Hard"] },
    {
      label: "Word Count",
      value: gameSettings.wordCount,
      type: SettingValue.wordCount,
      icon: <Gamepad2 size={18} />,
      options: [...Array(5)].map((_, i) => {
        return { value: i + 1, label: i + 1 };
      }),
    },
    {
      label: "Hints",
      value: gameSettings.hints,
      type: SettingValue.hints,
      icon: <Lightbulb size={18} />,
      options: [...Array(3)].map((_, i) => {
        return { value: i + 1, label: i + 1 };
      }),
    },
  ];

  if (!isPrivateRoom)
    return (
      <div className="w-full h-full p-4 sm:p-6 flex items-center justify-center min-h-0">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/95 p-8 shadow-2xl shadow-black/20 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300 font-semibold">
            Waiting Room
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-white">
            Waiting for players
          </h2>
          <p className="mt-3 text-base text-slate-400">
            The game will start as soon as a player joins.
          </p>
        </div>
      </div>
    );

  return (
    <div className="w-full h-full p-4 sm:p-6 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="p-6 sm:p-8 flex flex-col h-full">
          <div className="mb-6 sm:mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Game Lobby
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-white">
              Configure your match
            </h2>
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-400">
              Choose your settings, invite friends, and start the game when everyone is ready.
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              {settingsOptions.map((item, index) => {
                return (
                  <div
                    key={index}
                    className="rounded-3xl border border-white/10 bg-slate-900/90 p-4 shadow-sm shadow-black/10"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                          {item.icon}
                          {item.label}
                        </p>
                      </div>
                      <select
                        id={item.label}
                        value={item.value}
                        onChange={(event) =>
                          handleSettingChange(item.type, event.target.value, true)
                        }
                        disabled={!isOwner}
                        className="w-full sm:w-40 px-4 py-3 border border-white/10 bg-slate-950 text-white rounded-2xl shadow-sm outline-none transition duration-200 hover:border-cyan-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {item.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-900/90 p-5 shadow-sm shadow-black/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Custom words
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Add your own words to the round. Leave blank to use default word lists.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="custom-words-only"
                    className="text-sm font-medium text-slate-200"
                  >
                    Only custom words
                  </label>
                  <input
                    type="checkbox"
                    id="custom-words-only"
                    className="h-5 w-5 rounded border border-white/10 bg-slate-800 text-cyan-400 shadow-inner shadow-black/20"
                    disabled={!isOwner}
                    checked={gameSettings.onlyCustomWords}
                    onChange={() =>
                      handleSettingChange(
                        SettingValue.onlyCustomWords,
                        !gameSettings.onlyCustomWords,
                        true
                      )
                    }
                  />
                </div>
              </div>
              <textarea
                name="words-input"
                className="mt-4 w-full min-h-[140px] rounded-3xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-black/20 outline-none transition duration-200 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Type words separated by commas, maximum 2000 characters"
                value={customWords}
                onChange={(e) => setCustomWords(e.target.value)}
                disabled={!isOwner}
                maxLength={2000}
                rows={5}
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-end flex-shrink-0">
        <Button
          onClick={handleStart}
          className="w-full sm:w-3/5 rounded-3xl py-4 text-lg font-semibold shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40"
          disabled={!isOwner}
          variant="success"
        >
          Start game
        </Button>
        <RoomLink className="w-full sm:w-2/5 rounded-3xl py-4" />
      </div>
    </div>
  );
};

export default GameSettings;
