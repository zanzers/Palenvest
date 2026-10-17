"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function PlusIcon({ open }: { open: boolean }) {
  return (
    <svg
      {...iconProps}
      strokeWidth={2.5}
      style={{
        transform: open ? "rotate(45deg)" : "none",
        transition: "transform 0.15s",
      }}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const links = [
  { href: "/agent", label: "Home", Icon: HomeIcon, exact: true },
  { href: "/agent/listings", label: "Listings", Icon: ListIcon, exact: false },
];

function CreateMenu({ direction }: { direction: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const placement =
    direction === "up"
      ? { bottom: "calc(100% + 12px)" }
      : { top: "calc(100% + 12px)" };

  return (
    <div className="position-relative">
      {open && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ zIndex: 1040 }}
          onClick={() => setOpen(false)}
        />
      )}

      <button
        type="button"
        aria-label="Create"
        aria-expanded={open}
        className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center shadow position-relative"
        style={{ width: 56, height: 56, zIndex: 1045 }}
        onClick={() => setOpen(!open)}
      >
        <PlusIcon open={open} />
      </button>

      {open && (
        <div
          className="list-group shadow position-absolute start-50 translate-middle-x"
          style={{ zIndex: 1050, minWidth: 220, ...placement }}
        >
          <Link
            href="/agent/listings/new"
            className="list-group-item list-group-item-action py-3"
            onClick={() => setOpen(false)}
          >
            New listing
          </Link>
          <div className="list-group-item py-3 text-muted d-flex justify-content-between">
            Poster <span className="badge text-bg-secondary">Soon</span>
          </div>
          <div className="list-group-item py-3 text-muted d-flex justify-content-between">
            Video <span className="badge text-bg-secondary">Soon</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Desktop: top header */}
      <header className="d-none d-md-block bg-white border-bottom sticky-top">
        <div className="container d-flex align-items-center py-2">
          <div className="d-flex gap-4" style={{ flex: 1 }}>
            <span className="fw-bold">PALEnvest</span>
            {links.map(({ href, label, exact }) => (
              <Link
                key={href}
                href={href}
                className={`text-decoration-none ${
                  isActive(href, exact) ? "text-primary fw-semibold" : "text-muted"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <CreateMenu direction="down" />
          <div className="text-end" style={{ flex: 1 }}>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Mobile: bottom bar */}
      <nav
        className="d-md-none fixed-bottom bg-white border-top"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="d-flex align-items-center">
          <div style={{ flex: 1 }}>
            <MobileLink {...links[0]} active={isActive(links[0].href, links[0].exact)} />
          </div>
          <div className="d-flex justify-content-center" style={{ flex: 1, marginTop: -28 }}>
            <CreateMenu direction="up" />
          </div>
          <div style={{ flex: 1 }}>
            <MobileLink {...links[1]} active={isActive(links[1].href, links[1].exact)} />
          </div>
        </div>
      </nav>
    </>
  );
}

function MobileLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: () => React.ReactElement;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`d-flex flex-column align-items-center py-2 text-decoration-none small ${
        active ? "text-primary" : "text-muted"
      }`}
    >
      <Icon />
      {label}
    </Link>
  );
}