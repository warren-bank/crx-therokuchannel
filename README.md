### [The Roku Channel](https://github.com/warren-bank/crx-therokuchannel/tree/webmonkey-userscript/es5)

[Userscript](https://github.com/warren-bank/crx-therokuchannel/raw/webmonkey-userscript/es5/webmonkey-userscript/therokuchannel.user.js) for [therokuchannel.roku.com](https://therokuchannel.roku.com/) to run in:
* the [WebMonkey](https://github.com/warren-bank/Android-WebMonkey) application
  - for Android
* the [Tampermonkey](https://www.tampermonkey.net/) web browser extension
  - for [Firefox/Fenix](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
  - for [Chrome/Chromium](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
* the [Violentmonkey](https://violentmonkey.github.io/) web browser extension
  - for [Firefox/Fenix](https://addons.mozilla.org/firefox/addon/violentmonkey/)
  - for [Chrome/Chromium](https://chrome.google.com/webstore/detail/violent-monkey/jinjaccalgkegednnccohejagnlnfdag)

Its purpose is to:
* on the page for a TV series
  - replace the page's content with:
    * a list of all available episodes in the series
  - for each available episode, display:
    * season #
    * episode #
    * title
    * summary
    * duration
    * _Get Video URL_ button to obtain the URL for its video
  - after this button is clicked, display:
    * a list of all available video formats
  - for each available video format, display:
    * a brief summary of its attributes
    * _Start Media_ button to transfer the chosen media to an external player
    * a grouping of icons to transfer the chosen media to various pages on the [Webcast-Reloaded](https://github.com/warren-bank/crx-webcast-reloaded) external [website](https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html)
      - each of these pages provide tight integration with tools for media streams:
        * _Google Chromecast_
        * [_ExoAirPlayer_](https://github.com/warren-bank/Android-ExoPlayer-AirPlay-Receiver)
        * [_HLS-Proxy_](https://github.com/warren-bank/HLS-Proxy)
* on the page for either: a specific episode in a series, a live TV channel, or a feature film
  - replace the page's content with:
    * a summary of the video content
    * a list of all available video formats
  - for the summary of video content, display:
    * season #
    * episode #
    * title
    * summary
    * duration
  - for each available video format, display:
    * a brief summary of its attributes
    * _Start Media_ button to transfer the chosen media to an external player
    * a grouping of icons to transfer the chosen media to various pages on the [Webcast-Reloaded](https://github.com/warren-bank/crx-webcast-reloaded) external [website](https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html)
      - each of these pages provide tight integration with tools for media streams:
        * _Google Chromecast_
        * [_ExoAirPlayer_](https://github.com/warren-bank/Android-ExoPlayer-AirPlay-Receiver)
        * [_HLS-Proxy_](https://github.com/warren-bank/HLS-Proxy)

- - - -

#### Notes:

* to access the data API endoint:
  - login is _not_ required
  - website cookies _are_ required

* to access the video stream host:
  - login is _not_ required
  - _Referer_ request header is _not_ required

* the [therokuchannel.roku.com](https://therokuchannel.roku.com/) website doesn't provide an _A to Z_ list of all available TV series or movies
  - the [justwatch.com](https://www.justwatch.com/us/provider/the-roku-channel?sort_by=title&sort_asc=true&monetization_types=ads,free&page=1) website provides a much better interface to browse the content available on _The Roku Channel_

- - - -

#### Bonus:

["The Roku Channel .css" userscript](https://github.com/warren-bank/crx-therokuchannel/raw/webmonkey-userscript/es5/webmonkey-userscript/therokuchannel.css.user.js)

Its purpose is to apply the following CSS updates:
* hide modal popup to "create free account"

- - - -

#### Legal:

* copyright: [Warren Bank](https://github.com/warren-bank)
* license: [GPL-2.0](https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt)
