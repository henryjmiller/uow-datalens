'use client'

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Header.module.css";

const links = [
  { href: '/', label: 'Home' },
  { href: '/datasets', label: 'Datasets' },
  { href: '/analysis', label: 'Analysis' },
  { href: '/predictive-modelling', label: 'Predictive Modelling' },
  { href: '/visualisations', label: 'Visualisations' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" onClick={() => setOpen(false)}>
          <Image src="/logo.png" alt="UoW DataLens" width={0} height={0} sizes="100vw" style={{ width: 'auto', height: '32px' }} />
        </Link>

        <nav className={styles.desktopNav}>
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={styles.navLink}>{label}</Link>
          ))}
        </nav>

        <button className={styles.hamburger} onClick={() => setOpen((o) => !o)} aria-label="Toggle navigation">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className={styles.mobileNav}>
          {links.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={styles.mobileNavLink}>
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
