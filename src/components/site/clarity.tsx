/**
 * Microsoft Clarity (session recordings and heatmaps), Microsoft's official snippet in <head>.
 * CLARITY_PROJECT_ID overrides the project ("off" disables it). Never runs on the admin panel.
 */
const PROJECT_ID = (process.env.CLARITY_PROJECT_ID ?? "zjcc1l67lt").trim();

export function ClarityHead() {
  if (!/^[a-z0-9]{6,20}$/i.test(PROJECT_ID)) return null;
  const snippet =
    `if(location.pathname.indexOf('/admin')!==0){(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};` +
    `t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);` +
    `})(window,document,"clarity","script",${JSON.stringify(PROJECT_ID)});}`;
  return <script id="clarity" dangerouslySetInnerHTML={{ __html: snippet }} />;
}
