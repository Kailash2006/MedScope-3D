import { AuthNav } from "./AuthNav";

const ITEMS = [
  { key: "home", label: "Home", href: "/" },
  { key: "triage", label: "Triage", href: "/triage" },
  { key: "admin", label: "Admin", href: "/admin" },
];

export function TopNav({ active }: { active: "home" | "triage" | "admin" }) {
  return (
    <nav className="glass topnav" aria-label="Primary">
      <a href="/" className="topnav-logo">
        <span className="topnav-mark" aria-hidden>✳</span> MedScope
      </a>
      <div className="topnav-links">
        {ITEMS.map((i) => (
          <a key={i.key} href={i.href} className="topnav-pill" data-active={active === i.key}>
            {i.label}
          </a>
        ))}
      </div>
      <AuthNav />
    </nav>
  );
}
