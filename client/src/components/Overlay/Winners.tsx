import { useRoom } from "../../context/RoomContext";

const rankIcon = (index: number) => {
  switch (index) {
    case 0:
      return "🥇";
    case 1:
      return "🥈";
    case 2:
      return "🥉";
    default:
      return `${index + 1}.`;
  }
};

export default function Winners() {
  const { players } = useRoom();
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const topScore = sortedPlayers[0]?.score ?? 0;
  const topPlayers = sortedPlayers.filter((player) => player.score === topScore);
  const isTie = topPlayers.length > 1;

  return (
    <div className="max-w-3xl w-full px-4 py-6 sm:px-8 sm:py-8 bg-slate-950/95 border border-white/10 rounded-3xl shadow-2xl shadow-black/40 backdrop-blur-md text-white mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center gap-3 px-4 py-2 rounded-full bg-amber-400/20 text-amber-200 text-sm font-semibold tracking-[0.18em] uppercase">
          <span className="text-xl">🏆</span>
          Winner
        </div>
        <h3 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight text-amber-100">
          Final Results
        </h3>
        <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
          The game is over — here is the final leaderboard with the top players and final scores.
        </p>
      </div>

      <div className="grid gap-4">
        {sortedPlayers.slice(0, 1).map((player, index) => {
          const suffix = player.score === topScore ? (isTie ? "(Tie)" : "Champion") : "";
          return (
            <div
              key={player.playerId}
              className="rounded-3xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-slate-900/70 to-slate-950/90 p-6 shadow-xl shadow-amber-500/10"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-amber-200/80">Top Player</p>
                  <h4 className="mt-3 text-4xl font-extrabold text-amber-100">
                    {player.name}
                  </h4>
                  <p className="mt-2 text-sm text-slate-300">
                    {suffix}
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-3xl bg-amber-500/10 px-4 py-3 text-amber-100">
                  <span className="text-3xl">🏅</span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-200/80">Final Score</p>
                    <p className="text-3xl font-bold">{player.score}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="grid gap-3 sm:grid-cols-2">
          {sortedPlayers.map((player, index) => {
            const isFirst = index === 0;
            return (
              <div
                key={player.playerId}
                className={`rounded-3xl border p-4 ${
                  isFirst
                    ? "border-amber-300/40 bg-amber-500/10"
                    : "border-white/10 bg-slate-900/80"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{rankIcon(index)}</span>
                    <div>
                      <p className={`font-semibold ${isFirst ? "text-amber-100 text-xl" : "text-white text-lg"}`}>
                        {player.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {isFirst && (isTie ? "Top tie" : "Winner")}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-semibold text-slate-100">
                    {player.score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
