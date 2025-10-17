export type ScoreboardLabels = {
  time: string;
  home: string;
  away: string;
  firstHalf: string;
  secondHalf: string;
};

// Allow overriding via Vite env variables
const env = import.meta.env as any;

export const labels: ScoreboardLabels = {
  time: env.VITE_SCOREBOARD_LABEL_TIME ?? 'Time',
  home: env.VITE_SCOREBOARD_LABEL_HOME ?? 'Home',
  away: env.VITE_SCOREBOARD_LABEL_AWAY ?? 'Away',
  firstHalf: env.VITE_SCOREBOARD_LABEL_FIRST_HALF ?? '1st half',
  secondHalf: env.VITE_SCOREBOARD_LABEL_SECOND_HALF ?? '2nd half',
};
