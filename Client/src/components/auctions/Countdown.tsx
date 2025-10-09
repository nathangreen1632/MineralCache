// Client/src/components/auctions/Countdown.tsx
import React, { useEffect, useMemo, useState } from 'react';

function fmt(n: number) {
  if (n < 10) {
    return `0${n}`;
  }
  return String(n);
}

export default function Countdown(
  props: Readonly<{ endAt: Date | string | null }>
): React.ReactElement | null {
  const end = useMemo(() => {
    if (!props.endAt) {
      return null;
    }
    return new Date(props.endAt);
  }, [props.endAt]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  if (!end) {
    return null;
  }

  const ms = end.getTime() - now;
  const ended = ms <= 0;
  const s = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  let label:string;
  if (ended) {
    label = 'Ended';
  } else if (days > 0) {
    label = `${days}d ${hours}h`;
  } else {
    label = `${fmt(hours)}:${fmt(mins)}:${fmt(secs)}`;
  }

  let className:string;
  if (ended) {
    className = 'text-red-500 font-semibold';
  } else {
    className = 'text-[var(--theme-link)] font-semibold';
  }

  return (
    <span className={className} aria-live="polite">
      {label}
    </span>
  );
}
