import clsx from "clsx";

const AVATARS = ["🍎", "🍌", "🍉", "🍇", "🥭", "🍓", "🥝", "🍍", "🥑", "🍒"];

export default function PlayerSelector({
  avatar,
  onChange,
}: {
  avatar: string;
  onChange: (avatar: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-3 justify-center">
      {AVATARS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={clsx(
            "text-3xl p-3 rounded-2xl transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500/50",
            avatar === emoji
              ? "bg-cyan-500/20 border-2 border-cyan-400 shadow-md shadow-cyan-500/10 scale-105"
              : "bg-slate-900/60 border border-white/5 hover:border-white/20"
          )}
          onClick={() => onChange(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
