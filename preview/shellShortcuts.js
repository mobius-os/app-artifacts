import { injectArtifactScript } from '../domain.js'

/**
 * Keep shell shortcuts working while focus is inside a srcDoc preview.
 *
 * Keys typed in the preview never reach the Pages document, so the app frame
 * cannot see shell chords like Cmd/Ctrl+K there. The app frame advertises the
 * exact chords to each direct child frame; this script listens for that list,
 * captures only matching keydowns, and asks the parent to run the action.
 * Every other key reaches the page untouched. Without an advertisement the
 * script captures nothing.
 */
export function artifactShellShortcutShimSource() {
  return `(()=>{'use strict';
var shortcuts=[];
addEventListener('message',function(e){if(e.source===parent&&e.data&&e.data.type==='moebius:frame-shortcuts')shortcuts=e.data.shortcuts||[]});
document.addEventListener('keydown',function(e){
if(e.isComposing||e.repeat||(e.getModifierState&&e.getModifierState('AltGraph')))return;
var hit=shortcuts.find(function(s){var b=s.binding;return String(e.key).toLowerCase()===String(b.key).toLowerCase()&&(e.metaKey||e.ctrlKey)===!!b.mod&&e.shiftKey===!!b.shift&&e.altKey===!!b.alt});
if(!hit)return;
e.preventDefault();e.stopImmediatePropagation();
parent.postMessage({type:'moebius:shell-shortcut',actionId:hit.actionId},'*');
},true);
parent.postMessage({type:'moebius:frame-shortcuts-request'},'*');
})();`
}

export function injectArtifactShellShortcutShim(html) {
  return injectArtifactScript(html, artifactShellShortcutShimSource())
}
