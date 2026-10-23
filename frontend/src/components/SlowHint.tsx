import { useEffect, useState } from "react";

export default function SlowHint({ afterMs = 4000 }: { afterMs?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), afterMs);
    return () => clearTimeout(timer);
  }, [afterMs]);

  if (!show) return null;
  return (
    <p className="mt-3 text-center text-xs text-slate-500">
      The demo runs on free hosting and can take up to a minute to wake up. Thanks for your patience!
    </p>
  );
}