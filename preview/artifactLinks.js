function injectScriptAfterDoctype(html, source) {
  const script = `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`
  const document = String(html ?? '')
  const doctype = /^((?:\s|<!--[\s\S]*?-->)*<!doctype[^>]*>)/i.exec(document)
  return doctype
    ? `${doctype[1]}${script}${document.slice(doctype[1].length)}`
    : `${script}${document}`
}

/**
 * Keep links inside an opaque srcDoc preview from navigating the nested frame.
 *
 * A srcDoc document inherits the embedding app-frame URL as its base URL.
 * Native `href="#section"` clicks therefore replace the artifact with a
 * nested copy of the Artifacts frame instead of scrolling the artifact. That
 * navigation also adds an invisible entry to the browser's joint session
 * history, which can delay the shell interaction that follows it.
 *
 * Fragment-only links scroll locally without creating history. Other ordinary
 * links open outside the preview so the artifact remains mounted. Explicit
 * downloads and script links keep their authored behavior inside the sandbox.
 */
export function artifactPreviewLinkShimSource() {
  return `(()=>{'use strict';
var w=window,d=w.document;
function tokens(value){return String(value||'').split(/\\s+/).filter(Boolean)}
function linkFrom(target){return target&&typeof target.closest==='function'?target.closest('a[href]'):null}
function localFragment(raw){var value=raw.slice(1);if(!value){w.scrollTo(0,0);return}var id=value;try{id=decodeURIComponent(value)}catch{}var destination=d.getElementById(id);if(destination)destination.scrollIntoView()}
d.addEventListener('click',function(event){
if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
var anchor=linkFrom(event.target);if(!anchor)return;
var href=anchor.getAttribute('href');if(typeof href!=='string')return;
if(href===''||href.charAt(0)==='#'){event.preventDefault();localFragment(href);return}
if(anchor.hasAttribute('download')||/^(?:javascript|data):/i.test(href))return;
anchor.setAttribute('target','_blank');
var rel=tokens(anchor.getAttribute('rel'));if(rel.indexOf('noopener')<0)rel.push('noopener');if(rel.indexOf('noreferrer')<0)rel.push('noreferrer');anchor.setAttribute('rel',rel.join(' '));
});
})();`
}

export function injectArtifactPreviewLinkShim(html) {
  return injectScriptAfterDoctype(html, artifactPreviewLinkShimSource())
}
