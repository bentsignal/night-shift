import type { ButtonHTMLAttributes } from "react";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-lg border border-sky-300/30 bg-sky-300 px-4 py-2 font-medium text-slate-950 transition hover:bg-sky-200 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
