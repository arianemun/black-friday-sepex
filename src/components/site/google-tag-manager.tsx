"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/** Google Tag Manager container for the SEO team. Not loaded on the admin panel. */
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-TXRGL4QC";

export function GoogleTagManager() {
  const pathname = usePathname();
  if (!GTM_ID || pathname?.startsWith("/admin")) return null;
  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});`}
      </Script>
      <Script id="gtm-script" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
      <noscript>
        <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="gtm" />
      </noscript>
    </>
  );
}
