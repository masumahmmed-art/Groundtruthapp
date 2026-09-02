"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Projects" },
  { href: "/dashboard/rates", label: "Rate Library" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/help", label: "Help" },
  { href: "/dashboard/feedback", label: "Feedback" },
];

export default function RailNav() {
  const pathname = usePathname();

  return (
    <div className="rail-nav">
      {ITEMS.map((item, idx) => {
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : ""}>
            <span className="num">0{idx + 1}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
