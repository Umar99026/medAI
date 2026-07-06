"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  role: "GP" | "SPECIALIST";
};

const gpLinks = [
  { href: "/gp", label: "Notes", icon: "📝" },
  { href: "/gp/referrals", label: "Sent referrals", icon: "📤" },
];

const specialistLinks = [
  { href: "/specialist/referrals", label: "Referrals", icon: "📥" },
  { href: "/specialist/filter", label: "Filter", icon: "🎯" },
];

export function Sidebar({ collapsed, onToggle, role }: Props) {
  const pathname = usePathname();
  const links = role === "GP" ? gpLinks : specialistLinks;

  return (
    <aside
      className={`flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        {!collapsed && <span className="text-sm font-semibold text-slate-800">medAI</span>}
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Toggle sidebar"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== "/gp" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-sky-50 font-medium text-sky-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{link.icon}</span>
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
