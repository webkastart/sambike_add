"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { telHref } from "@/lib/format";

type Props = { ctaText: string; primaryHref: string; phone: string };

export function MobileStickyCta({ ctaText, primaryHref, phone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("[data-campaign-hero]");
    const conversionSections = document.querySelectorAll("[data-lead-form-section], [data-final-cta]");
    let heroVisible = true;
    let conversionVisible = false;
    const update = () => setVisible(!heroVisible && !conversionVisible);

    const heroObserver = new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      update();
    }, { threshold: 0.05 });
    const conversionObserver = new IntersectionObserver((entries) => {
      conversionVisible = entries.some((entry) => entry.isIntersecting);
      update();
    }, { threshold: 0.08 });

    if (hero) heroObserver.observe(hero);
    conversionSections.forEach((section) => conversionObserver.observe(section));
    return () => {
      heroObserver.disconnect();
      conversionObserver.disconnect();
    };
  }, []);

  return (
    <div className={`mobile-sticky-cta md:hidden ${visible ? "is-visible" : ""}`} aria-hidden={!visible}>
      <a href={primaryHref} data-track="cta" tabIndex={visible ? 0 : -1} className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] bg-[var(--accent)] px-4 text-sm font-bold text-white">
        {ctaText}
      </a>
      <a href={telHref(phone)} data-track="phone" tabIndex={visible ? 0 : -1} aria-label={`Zavolať na ${phone}`} className="flex min-h-11 items-center justify-center gap-2 px-2 text-sm font-semibold text-white">
        <Phone size={17} /> Zavolať
      </a>
    </div>
  );
}
