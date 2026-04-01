"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Map, BarChart3, Anchor, Menu, X } from "lucide-react";
import { useState, Suspense } from "react";

const navItems = [
  { href: "/kaart", label: "Kaart", icon: Map },
  { href: "/overzicht", label: "Overzicht", icon: BarChart3 },
];

// Inner component that uses useSearchParams (needs Suspense boundary)
function NavLinks({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterQuery = searchParams.toString();

  return (
    <>
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href);
        // Carry the current filter params to the target page
        const href = filterQuery ? `${item.href}?${filterQuery}` : item.href;

        if (mobile) {
          return (
            <Link
              key={item.href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                active ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={href}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              active
                ? "bg-white/20 text-white"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-[var(--primary)] text-white shadow-lg z-50 relative">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/kaart" className="flex items-center gap-2 font-bold text-lg">
            <Anchor className="w-6 h-6 text-[var(--accent)]" />
            <span>Sluizen Nederland</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <Suspense fallback={
              navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))
            }>
              <NavLinks />
            </Suspense>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden pb-3 space-y-1">
            <Suspense fallback={
              navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))
            }>
              <NavLinks mobile onClose={() => setMobileOpen(false)} />
            </Suspense>
          </div>
        )}
      </div>
    </nav>
  );
}
