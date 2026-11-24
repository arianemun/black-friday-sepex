/**
 * Google Tag Manager container for the SEO team.
 *
 * Rendered as Google's official snippet: the loader is an inline script at the top of
 * <head>, so dataLayer exists and gtm.js starts downloading before anything else runs
 * (no next/script deferral). The admin panel is skipped by checking the path in the
 * snippet itself, which keeps the root layout static.
 */
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-TXRGL4QC";

const snippet = (id: string) =>
  `window.dataLayer=window.dataLayer||[];` +
  `if(location.pathname.indexOf('/admin')!==0){(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':` +
  `new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],` +
  `j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=` +
  `'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);` +
  `})(window,document,'script','dataLayer',${JSON.stringify(id)});}`;

/** Goes first inside <head>. */
export function GoogleTagManagerHead() {
  if (!GTM_ID) return null;
  return <script id="gtm-head" dangerouslySetInnerHTML={{ __html: snippet(GTM_ID) }} />;
}

/** Goes first inside <body>, for visitors without JavaScript. */
export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="gtm"
      />
    </noscript>
  );
}
