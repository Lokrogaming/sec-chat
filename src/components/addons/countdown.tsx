

import { useEffect, useState } from "react";

type CountdownProps = {
  targetDate: string | Date; // z.B. "2026-01-01T00:00:00"
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function calculateTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - new Date().getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function Countdown({ targetDate }: CountdownProps) {
  const target =
    typeof targetDate === "string" ? new Date(targetDate) : targetDate;

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calculateTimeLeft(target)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft(target));
    }, 1000);

    return () => clearInterval(interval);
  }, [target]);

  useEffect(() => {
  const interval = setInterval(() => {
    setTimeLeft((prev) => {
      if (
        prev.days === 0 &&
        prev.hours === 0 &&
        prev.minutes === 0 &&
        prev.seconds === 0
      ) {
        clearInterval(interval);
        return prev;
      }
      return calculateTimeLeft(target);
    });
  }, 1000);

  return () => clearInterval(interval);
}, [target]);

  return (
  <div className="flex gap-4 text-xl text-muted-foreground">
    <TimeBox label="days" value={timeLeft.days} />
    <TimeBox label="hours" value={timeLeft.hours} />
    <TimeBox label="min" value={timeLeft.minutes} />
    <TimeBox label="sec" value={timeLeft.seconds} />
  </div>
);

}

function TimeBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}
