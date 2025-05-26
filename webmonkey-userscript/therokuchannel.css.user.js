// ==UserScript==
// @name         The Roku Channel .css
// @description  Apply CSS updates: hide modal popup to "create free account".
// @version      1.0.0
// @match        *://*.therokuchannel.roku.com/*
// @icon         https://therokuchannel.roku.com/favicon.ico
// @run-at       document-end
// @unwrap
// @homepage     https://github.com/warren-bank/crx-therokuchannel/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-therokuchannel/issues
// @downloadURL  https://github.com/warren-bank/crx-therokuchannel/raw/webmonkey-userscript/es5/webmonkey-userscript/therokuchannel.css.user.js
// @updateURL    https://github.com/warren-bank/crx-therokuchannel/raw/webmonkey-userscript/es5/webmonkey-userscript/therokuchannel.css.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

(function() {
  var $head  = document.head || document.getElementsByTagName('head')[0]
  var $style = document.createElement('style')

  $style.textContent = [
    // hide modal popup to "create free account"

    'html.modal-default {',
    '  overflow: auto !important;',
    '}',

    'div.roku-modal-overlay,',
    'div.roku-modal[role="dialog"] {',
    '  display: none !important;',
    '}',

    ''
  ].join("\n")

  $head.appendChild($style)
})();
