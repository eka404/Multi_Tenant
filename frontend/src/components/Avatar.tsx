const COLORS = ["bg-indigo-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600", "bg-sky-600", "bg-violet-600"];

export default function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${COLORS[hash % COLORS.length]}`}
      style={{ width: size, height: size }}
    >
      {initials || "?"}
    </span>
  );
}