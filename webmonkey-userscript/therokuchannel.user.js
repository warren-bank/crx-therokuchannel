// ==UserScript==
// @name         The Roku Channel
// @description  Improve site usability. Watch videos in external player.
// @version      1.1.0
// @match        *://*.therokuchannel.roku.com/details/*
// @match        *://*.therokuchannel.roku.com/watch/*
// @icon         https://therokuchannel.roku.com/favicon.ico
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-therokuchannel/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-therokuchannel/issues
// @downloadURL  https://github.com/warren-bank/crx-therokuchannel/raw/webmonkey-userscript/es5/webmonkey-userscript/therokuchannel.user.js
// @updateURL    https://github.com/warren-bank/crx-therokuchannel/raw/webmonkey-userscript/es5/webmonkey-userscript/therokuchannel.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- user options

var user_options = {
  "common": {
    "debug_verbosity":              0,  // 0 = silent. 1 = console log. 2 = window alert. 3 = window alert + conditional breakpoint.
    "init_delay_ms":                2500,
    "sort_newest_first":            false,
    "filter_subscription_content":  true
  },
  "webmonkey": {
    "post_intent_redirect_to_url":  null  // "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

// ----------------------------------------------------------------------------- constants

var constants = {
  "button_attributes": {
    "roku_id":                      "x-roku-id",
    "play_id":                      "x-play-id",

    "video_url":                    "x-video-url",
    "video_type":                   "x-video-type",
    "caption_url":                  "x-caption-url",
    "referer_url":                  "x-referer-url",
    "drm_scheme":                   "x-drm-scheme",
    "drm_server":                   "x-drm-server"
  },
  "img_urls": {
    "base_webcast_reloaded_icons":  "https://github.com/warren-bank/crx-webcast-reloaded/raw/gh-pages/chrome_extension/2-release/popup/img/"
  }
}

var strings = {
  "button_download_video":          "Get Video URL",
  "button_start_video":             "Start Video",
  "episode_labels": {
    "season_number":                "Season #:",
    "episode_number":               "Episode #:",
    "title":                        "Title:",
    "summary":                      "Summary:",
    "duration":                     "Duration:",
    "date_aired":                   "Release Date:",
    "date_expiration":              "Available Until:",
    "license":                      "Content License:",
    "video": {
      "format":                     "Format:",
      "drm":                        "DRM:"
    }
  }
}

// ----------------------------------------------------------------------------- state

var state = {
  csrf_token: null,
  series:     {}, // {roku_id, title, summary}
  episodes:   []  // [{roku_id, play_id, season_number, episode_number, title, summary, duration, date_aired, date_expiration, license}]
}

// ----------------------------------------------------------------------------- CSP

// add support for CSP 'Trusted Type' assignment
var add_default_trusted_type_policy = function() {
  if (typeof unsafeWindow.trustedTypes !== 'undefined') {
    try {
      var passthrough_policy = function(string) {return string}

      unsafeWindow.trustedTypes.createPolicy('default', {
          createHTML:      passthrough_policy,
          createScript:    passthrough_policy,
          createScriptURL: passthrough_policy
      })
    }
    catch(e) {}
  }
}

// ----------------------------------------------------------------------------- debug logger

var debug = function(msg, breakpoint) {
  if (!user_options.common.debug_verbosity) return

  if (msg) {
    if (typeof msg !== 'string')
      msg = JSON.stringify(msg, null, 2)

    switch(user_options.common.debug_verbosity) {
      case 1:
        console.log(msg)
        break
      case 2:
      case 3:
        unsafeWindow.alert(msg)
        break
    }
  }

  if (breakpoint && (user_options.common.debug_verbosity > 2))
    debugger;
}

// ----------------------------------------------------------------------------- helpers (xhr)

var serialize_xhr_body_object = function(data) {
  if (typeof data === 'string')
    return data

  if (!(data instanceof Object))
    return null

  var body = []
  var keys = Object.keys(data)
  var key, val
  for (var i=0; i < keys.length; i++) {
    key = keys[i]
    val = data[key]
    val = unsafeWindow.encodeURIComponent(val)

    body.push(key + '=' + val)
  }
  body = body.join('&')
  return body
}

var download_text = function(url, headers, data, withCredentials, callback) {
  if (data) {
    if (!headers)
      headers = {}
    if (!headers['content-type'])
      headers['content-type'] = 'application/x-www-form-urlencoded'

    switch(headers['content-type'].toLowerCase()) {
      case 'application/json':
        data = JSON.stringify(data)
        break

      case 'application/x-www-form-urlencoded':
      default:
        data = serialize_xhr_body_object(data)
        break
    }
  }

  var xhr    = new unsafeWindow.XMLHttpRequest()
  var method = data ? 'POST' : 'GET'

  xhr.open(method, url, true, null, null)
  xhr.withCredentials = !!withCredentials

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if ((xhr.status >= 200) && (xhr.status < 300)) {
        callback(null, xhr.responseText)
        return
      }
    }
    callback(new Error())
  }

  xhr.onerror = function(e) {
    callback(new Error())
  }

  if (data)
    xhr.send(data)
  else
    xhr.send()
}

var download_json = function(url, headers, data, withCredentials, callback) {
  if (!headers)
    headers = {}
  if (!headers.accept)
    headers.accept = 'application/json'

  download_text(url, headers, data, withCredentials, function(error, text){
    try {
      if (error)
        callback(error)
      else
        callback(null, JSON.parse(text))
    }
    catch(e) {}
  })
}

// ----------------------------------------------------------------------------- helpers

var make_element = function(elementName, html, text) {
  var el = unsafeWindow.document.createElement(elementName)

  if (html)
    el.innerHTML = html

  if (text)
    el.textContent = text

  return el
}

var make_span = function(text) {return make_element('span', null, text)}
var make_h4   = function(text) {return make_element('h4',   null, text)}

var add_style_element = function(css) {
  if (!css) return

  var head = unsafeWindow.document.getElementsByTagName('head')[0]
  if (!head) return

  if ('function' === (typeof css))
    css = css()
  if (Array.isArray(css))
    css = css.join("\n")

  head.appendChild(
    make_element('style', null, css)
  )
}

var empty_element = function(el, html, text) {
  while (el.childNodes.length)
    el.removeChild(el.childNodes[0])

  if (html)
    el.innerHTML = html

  if (text)
    el.textContent = text

  return el
}

var append_tr = function(tr, td, colspan) {
  if (Array.isArray(td))
    tr.push('<tr><td>' + td.join('</td><td>') + '</td></tr>')
  else if ((typeof colspan === 'number') && (colspan > 1))
    tr.push('<tr><td colspan="' + colspan + '">' + td + '</td></tr>')
  else
    tr.push('<tr><td>' + td + '</td></tr>')
}

var cancel_event = function(event) {
  event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=false;
}

// https://stackoverflow.com/a/66696162
var convertSecondsToReadableString = function(seconds) {
  seconds = seconds || 0
  seconds = Number(seconds)
  seconds = Math.abs(seconds)

  var seconds_per_minute = 60
  var seconds_per_hour   = seconds_per_minute * 60
  var seconds_per_day    = seconds_per_hour * 24
  var seconds_per_year   = seconds_per_day * 365

  var y = Math.floor(seconds / seconds_per_year)
  var d = Math.floor((seconds % seconds_per_year) / seconds_per_day)
  var h = Math.floor((seconds % seconds_per_day)  / seconds_per_hour)
  var m = Math.floor((seconds % seconds_per_hour) / seconds_per_minute)
  var s = Math.floor( seconds % seconds_per_minute)

  var parts = []

  if (y > 0) {
    parts.push(y + ' year' + (y > 1 ? 's' : ''))
  }
  if (d > 0) {
    parts.push(d + ' day' + (d > 1 ? 's' : ''))
  }
  if (h > 0) {
    parts.push(h + ' hour' + (h > 1 ? 's' : ''))
  }
  if (m > 0) {
    parts.push(m + ' minute' + (m > 1 ? 's' : ''))
  }
  if (s > 0) {
    parts.push(s + ' second' + (s > 1 ? 's' : ''))
  }
  return parts.join(', ')
}

var find_needle = function(data) {
  var index_start, index_stop

  index_start = data.haystack.indexOf(data.needle)
  if (index_start >= 0) {
    index_start += data.needle.length
    index_stop = data.haystack.indexOf(data.tail, index_start)
    if ((index_stop === -1) && !data.strict) {
      index_stop = data.haystack.length
    }
    if (index_stop >= index_start) {
      return data.haystack.substring(index_start, index_stop)
    }
  }
  return null
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_data, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_caption_url, encoded_referer_url, encoded_drm_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url      = encodeURIComponent(encodeURIComponent(btoa(video_data.video_url)))
  encoded_caption_url    = video_data.caption_url ? encodeURIComponent(encodeURIComponent(btoa(video_data.caption_url))) : null
  video_data.referer_url = video_data.referer_url ? video_data.referer_url : unsafeWindow.location.href
  encoded_referer_url    = encodeURIComponent(encodeURIComponent(btoa(video_data.referer_url)))
  encoded_drm_url        = (video_data.drm.scheme && video_data.drm.server) ? encodeURIComponent(encodeURIComponent(btoa(video_data.drm.scheme + '|' + video_data.drm.server))) : null

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.frii.site/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_data.video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base    + '#/watch/'    + encoded_video_url
                            + (encoded_caption_url ? ('/subtitle/' + encoded_caption_url) : '')
                            + (encoded_referer_url ? ('/referer/'  + encoded_referer_url) : '')
                            + (encoded_drm_url     ? ('/drm/'      + encoded_drm_url) : '')

  return webcast_reloaded_url
}

var get_webcast_reloaded_url_chromecast_sender = function(video_data) {
  return get_webcast_reloaded_url(video_data, /* force_http= */ null, /* force_https= */ null).replace('/index.html', '/chromecast_sender.html')
}

var get_webcast_reloaded_url_airplay_sender = function(video_data) {
  return get_webcast_reloaded_url(video_data, /* force_http= */ true, /* force_https= */ false).replace('/index.html', '/airplay_sender.es5.html')
}

var get_webcast_reloaded_url_proxy = function(video_data) {
  return get_webcast_reloaded_url(video_data, /* force_http= */ true, /* force_https= */ false).replace('/index.html', '/proxy.html')
}

var get_webcast_reloaded_urls = function(video_data) {
  return {
    "index":             get_webcast_reloaded_url(                  video_data),
    "chromecast_sender": get_webcast_reloaded_url_chromecast_sender(video_data),
    "airplay_sender":    get_webcast_reloaded_url_airplay_sender(   video_data),
    "proxy":             get_webcast_reloaded_url_proxy(            video_data)
  }
}

// ----------------------------------------------------------------------------- URL handlers

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

// -----------------------------------------------------------------------------

var process_video_data = function(data) {
  if (!data.video_url) return

  if (!data.referer_url)
    data.referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    if (!data.video_type)
      data.video_type = ''

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ data.video_url,
      /* type   = */ data.video_type
    ]

    // extras:
    if (data.caption_url) {
      args.push('textUrl')
      args.push(data.caption_url)
    }
    if (data.referer_url) {
      args.push('referUrl')
      args.push(data.referer_url)
    }
    if (data.drm.scheme) {
      args.push('drmScheme')
      args.push(data.drm.scheme)
    }
    if (data.drm.server) {
      args.push('drmUrl')
      args.push(data.drm.server)
    }
    if (data.drm.headers && (typeof data.drm.headers === 'object')) {
      var drm_header_keys, drm_header_key, drm_header_val

      drm_header_keys = Object.keys(data.drm.headers)
      for (var i=0; i < drm_header_keys.length; i++) {
        drm_header_key = drm_header_keys[i]
        drm_header_val = data.drm.headers[drm_header_key]

        args.push('drmHeader')
        args.push(drm_header_key + ': ' + drm_header_val)
      }
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(
      get_webcast_reloaded_url(data)
    )
    return true
  }
  else {
    return false
  }
}

var process_hls_data = function(data) {
  data.video_type = 'application/x-mpegurl'
  process_video_data(data)
}

var process_dash_data = function(data) {
  data.video_type = 'application/dash+xml'
  process_video_data(data)
}

// -----------------------------------------------------------------------------

var process_video_url = function(video_url, video_type, caption_url, referer_url, drm_scheme, drm_server) {
  var data = {
    video_url:   video_url   || null,
    video_type:  video_type  || null,
    caption_url: caption_url || null,
    referer_url: referer_url || null,
    drm: {
      scheme:    drm_scheme,
      server:    drm_server,
      headers:   null
    }
  }

  process_video_data(data)
}

var process_hls_url = function(hls_url, caption_url, referer_url, drm_scheme, drm_server) {
  process_video_url(/* video_url= */ hls_url, /* video_type= */ 'application/x-mpegurl', caption_url, referer_url, drm_scheme, drm_server)
}

var process_dash_url = function(dash_url, caption_url, referer_url, drm_scheme, drm_server) {
  process_video_url(/* video_url= */ dash_url, /* video_type= */ 'application/dash+xml', caption_url, referer_url, drm_scheme, drm_server)
}

// ----------------------------------------------------------------------------- API: download roku content

var download_roku_content = function(roku_id, callback) {
  if (!callback)
    return

  var fields = 'episodes&include=type,title,description,runTimeSeconds,seasonNumber,episodeNumber,releaseDate,viewOptions,viewOptions.playId,viewOptions.hasMedia,viewOptions.validityStartTime,viewOptions.validityEndTime,viewOptions.license,episodes.title,episodes.description,episodes.runTimeSeconds,episodes.seasonNumber,episodes.episodeNumber,episodes.releaseDate,episodes.viewOptions,episodes.viewOptions.playId,episodes.viewOptions.hasMedia,episodes.viewOptions.validityStartTime,episodes.viewOptions.validityEndTime,episodes.viewOptions.license'

  var url = 'https://therokuchannel.roku.com/api/v2/homescreen/content/' + encodeURIComponent(
    'https://content.sr.roku.com/content/v1/roku-trc/' + roku_id + '?expand=' + encodeURIComponent(fields)
  )

  download_json(
    url,
    /* headers= */ null,
    /* data= */ null,
    /* withCredentials= */ false,
    function(error, roku_content) {
      if (error) return
      pre_process_roku_content(roku_content)
      if (!state.episodes.length) return
      callback()
    }
  )
}

// ----------------------------------------------------------------------------- API: pre-process roku content

var pre_process_roku_content = function(roku_content) {
  try {
    switch(roku_content.type) {
      case 'series':
        return pre_process_roku_content_series(roku_content)
      case 'episode':
        return pre_process_roku_content_episode(roku_content)
      case 'livefeed':
        return pre_process_roku_content_livefeed(roku_content)
      case 'movie':
        return pre_process_roku_content_movie(roku_content)
    }
  }
  catch(e) {
    debug(e.message, true)
  }
}

var pre_process_roku_content_series = function(roku_content) {
  state.series = {
    roku_id: roku_content.meta.id,
    title:   roku_content.title,
    summary: roku_content.description
  }

  state.episodes = roku_content.episodes
    .filter(function(ep) {
      if (!validate_roku_content(ep))
        return false

      normalize_roku_content(ep)
      return true
    })
    .map(function(ep) {
      return {
        roku_id:         ep.meta.id,
        play_id:         ep.viewOptions.playId,
        season_number:   ep.seasonNumber,
        episode_number:  ep.episodeNumber,
        title:           ep.title,
        summary:         ep.description,
        duration:        ep.runTimeSeconds,
        date_aired:      ep.releaseDate,
        date_expiration: ep.viewOptions.validityEndTime,
        license:         ep.viewOptions.license
      }
    })
    .sort(function(a, b) {
      var a_season = parseInt(a.season_number, 10)
      var b_season = parseInt(b.season_number, 10)

      if (isNaN(a_season)) a_season = 0
      if (isNaN(b_season)) b_season = 0

      if (a_season !== b_season) {
        // sort by season
        return (user_options.common.sort_newest_first)
          ? ((a_season > b_season) ? -1 : 1)
          : ((a_season < b_season) ? -1 : 1)
      }

      var a_episode = parseInt(a.episode_number, 10)
      var b_episode = parseInt(b.episode_number, 10)

      if (isNaN(a_episode)) a_episode = 0
      if (isNaN(b_episode)) b_episode = 0

      return (a_episode === b_episode)
        ? 0
        : (
            (user_options.common.sort_newest_first)
              ? ((a_episode > b_episode) ? -1 : 1)
              : ((a_episode < b_episode) ? -1 : 1)
          )
    })
}

var pre_process_roku_content_episode = function(ep) {
  if (!validate_roku_content(ep))
    return

  normalize_roku_content(ep)

  state.episodes.push({
    roku_id:         ep.meta.id,
    play_id:         ep.viewOptions.playId,
    season_number:   ep.seasonNumber,
    episode_number:  ep.episodeNumber,
    title:           ep.title,
    summary:         ep.description,
    duration:        ep.runTimeSeconds,
    date_aired:      ep.releaseDate,
    date_expiration: ep.viewOptions.validityEndTime,
    license:         ep.viewOptions.license
  })
}

var pre_process_roku_content_livefeed = pre_process_roku_content_episode

var pre_process_roku_content_movie = pre_process_roku_content_episode

var validate_roku_content = function(ep) {
  var valid_types = ['episode', 'livefeed', 'movie']

  return !!(
       (ep)
    && (typeof ep === 'object')
    && (ep.meta)
    && (typeof ep.meta === 'object')
    && (ep.meta.id)
    && (valid_types.indexOf(ep.meta.mediaType) >= 0)
    && validate_roku_content_viewoptions(ep)
  )
}

var validate_roku_content_viewoptions = function(ep) {
  // if successful, array is reduced to a single valid object
  var vo

  if (Array.isArray(ep.viewOptions)) {
    for (var i=0; i < ep.viewOptions.length; i++) {
      vo = ep.viewOptions[i]

      if (
           (vo)
        && (typeof vo === 'object')
        && (vo.playId)
        && (vo.hasMedia)
        && validate_roku_content_viewoption_availability(vo)
        && validate_roku_content_viewoption_license(vo)
      ) {
        ep.viewOptions = vo
        return true
      }
    }
  }

  ep.viewOptions = {}
  return false
}

var validate_roku_content_viewoption_availability = function(vo) {
  var now = Date.now()
  var validity

  if (vo.validityStartTime) {
    // start
    validity = (new Date(vo.validityStartTime)).getTime()
    if (validity > now) return false // not yet available
  }

  if (vo.validityEndTime) {
    // expiry
    validity = (new Date(vo.validityEndTime)).getTime()
    if (validity <= now) return false // no-longer available
  }

  return true
}

var validate_roku_content_viewoption_license = function(vo) {
  return !(user_options.common.filter_subscription_content && (vo.license === 'Subscription'))
}

var normalize_roku_content = function(ep) {
  if (ep.runTimeSeconds)
    ep.runTimeSeconds = convertSecondsToReadableString(ep.runTimeSeconds)

  if (ep.releaseDate)
    ep.releaseDate = (new Date(ep.releaseDate)).toLocaleString()

  if (ep.viewOptions.validityEndTime)
    ep.viewOptions.validityEndTime = (new Date(ep.viewOptions.validityEndTime)).toLocaleString()
}

// ----------------------------------------------------------------------------- API: download video content

var download_video_content = function(roku_id, play_id, callback) {
  if (!callback)
    return

  var url = 'https://therokuchannel.roku.com/api/v3/playback'
  var headers = {
    "content-type": "application/json",
    "csrf-token":   state.csrf_token
  }
  var data = {"rokuId":roku_id,"playId":play_id,"mediaFormat":"mpeg-dash","drmType":"widevine","quality":"fhd","bifUrl":null,"adPolicyId":"","providerId":"rokuavod"}

  download_json(
    url,
    headers,
    data,
    /* withCredentials= */ true,
    function(error, video_content) {
      if (error) return
      video_content = pre_process_video_content(video_content)
      if (!Array.isArray(video_content) || !video_content.length) return
      callback(video_content)
    }
  )
}

// ----------------------------------------------------------------------------- API: pre-process video content

var pre_process_video_content = function(video_content) {
  var video_sources = []
  var video_type, caption_url
  var i, txt, vid, video_data
  try {
    if (Array.isArray(video_content.playbackMedia.videos)) {
      caption_url = null
      if (Array.isArray(video_content.playbackMedia.captions)) {
        for (i=0; i < video_content.playbackMedia.captions.length; i++) {
          txt = video_content.playbackMedia.captions[i]
          if (txt && (typeof txt === 'object') && txt.url) {
            caption_url = txt.url
            break
          }
        }
      }

      for (i=0; i < video_content.playbackMedia.videos.length; i++) {
        vid = video_content.playbackMedia.videos[i]

        if (!vid || (typeof vid !== 'object') || !vid.url)
          continue

        vid.streamFormat = (vid.streamFormat)
          ? vid.streamFormat.toLowerCase()
          : ''

        switch(vid.streamFormat) {
          case 'hls':
            video_type = 'application/x-mpegurl'
            break
          case 'dash':
          default:
            video_type = 'application/dash+xml'
        }

        video_data = {
          video_url:   vid.url,
          video_type:  video_type,
          caption_url: caption_url,
          referer_url: null,
          drm: {
            scheme:    null,
            server:    null,
            headers:   null
          }
        }

        if (vid.drmParams && (typeof vid.drmParams === 'object') && vid.drmParams.licenseServerURL) {
          video_data.drm.server = vid.drmParams.licenseServerURL

          vid.drmParams.keySystem = (vid.drmParams.keySystem)
            ? vid.drmParams.keySystem.toLowerCase()
            : ''

          switch(vid.drmParams.keySystem) {
            case 'widevine':
            case 'clearkey':
            case 'playready':
              video_data.drm.scheme = vid.drmParams.keySystem
              break
            default:
              video_data.drm.scheme = 'widevine'
          }
        }

        video_sources.push(video_data)
      }
    }
  }
  catch(e) {
    debug(e.message, true)
  }
  return video_sources
}

// ----------------------------------------------------------------------------- DOM: static skeleton

var reinitialize_dom = function() {
  add_default_trusted_type_policy()

  unsafeWindow.document.close()
  unsafeWindow.document.open()
  unsafeWindow.document.write('')
  unsafeWindow.document.close()

  empty_element(unsafeWindow.document.getElementsByTagName('head')[0])
  empty_element(unsafeWindow.document.body)

  add_style_element(function(){
    return [
      // --------------------------------------------------- reset

      'body {',
      '  margin: 0;',
      '  padding: 0;',
      '  font-family: serif;',
      '  font-size: 16px;',
      '  background-color: #fff !important;',
      '  overflow: auto !important;',
      '}',

      // --------------------------------------------------- series title

      'body > div > h2 {',
      '  display: block;',
      '  margin: 0;',
      '  padding: 0.5em;',
      '  font-size: 22px;',
      '  text-align: center;',
      '  background-color: #ccc;',
      '}',

      // --------------------------------------------------- series description

      'body > div > div {',
      '  padding: 0.5em;',
      '  font-size: 18px;',
      '}',

      // --------------------------------------------------- list of videos: all episodes in series, or individual: episode in series, live tv channel, or feature film

      'body > div > ul {',
      '  list-style: none;',
      '  margin: 0;',
      '  padding: 0;',
      '  padding-left: 1em;',
      '  padding-bottom: 1em;',
      '}',

      'body > div > ul > li {',
      '  list-style: none;',
      '  margin-top: 0.5em;',
      '  border-top: 1px solid #999;',
      '  padding-top: 0.5em;',
      '}',

      'body > div > ul > li > table td:first-child {',
      '  font-style: italic;',
      '  padding-right: 1em;',
      '}',

      'body > div > ul > li > blockquote {',
      '  display: block;',
      '  background-color: #eee;',
      '  padding: 0.5em 1em;',
      '  margin: 0;',
      '}',

      'body > div > ul > li > div {',
      '  margin: 0.75em 0;',
      '}',

      // --------------------------------------------------- drm

      'body > div > ul > li > div > table {',
      '  width: 100%;',
      '  border-collapse: collapse;',
      '}',

      'body > div > ul > li > div > table tr > td:first-child + td {',
      '  width: 100%;',
      '}',

      'body > div > ul > li > div > table tr > td {',
      '  border-top: 1px solid #999;',
      '  padding: 0.5em 0;',
      '}',

      'body > div > ul > li > div > table tr:first-child > td {',
      '  border-top-style: none;',
      '}',

      'body > div > ul > li > div > table button {',
      '  white-space: nowrap;',
      '}',

      'body > div > ul > li > div > table tr > td:last-child > div.icons-container {',
      '}',

      // --------------------------------------------------- links to tools on Webcast Reloaded website

      'body > div > ul > li div.icons-container {',
      '  display: block;',
      '  position: relative;',
      '  z-index: 1;',
      '  float: right;',
      '  margin: 0.5em;',
      '  width: 60px;',
      '  height: 60px;',
      '  max-height: 60px;',
      '  vertical-align: top;',
      '  background-color: #d7ecf5;',
      '  border: 1px solid #000;',
      '  border-radius: 14px;',
      '}',

      'body > div > ul > li div.icons-container > a.chromecast,',
      'body > div > ul > li div.icons-container > a.chromecast > img,',
      'body > div > ul > li div.icons-container > a.airplay,',
      'body > div > ul > li div.icons-container > a.airplay > img,',
      'body > div > ul > li div.icons-container > a.proxy,',
      'body > div > ul > li div.icons-container > a.proxy > img,',
      'body > div > ul > li div.icons-container > a.video-link,',
      'body > div > ul > li div.icons-container > a.video-link > img {',
      '  display: block;',
      '  width: 25px;',
      '  height: 25px;',
      '}',

      'body > div > ul > li div.icons-container > a.chromecast,',
      'body > div > ul > li div.icons-container > a.airplay,',
      'body > div > ul > li div.icons-container > a.proxy,',
      'body > div > ul > li div.icons-container > a.video-link {',
      '  position: absolute;',
      '  z-index: 1;',
      '  text-decoration: none;',
      '}',

      'body > div > ul > li div.icons-container > a.chromecast,',
      'body > div > ul > li div.icons-container > a.airplay {',
      '  top: 0;',
      '}',
      'body > div > ul > li div.icons-container > a.proxy,',
      'body > div > ul > li div.icons-container > a.video-link {',
      '  bottom: 0;',
      '}',

      'body > div > ul > li div.icons-container > a.chromecast,',
      'body > div > ul > li div.icons-container > a.proxy {',
      '  left: 0;',
      '}',
      'body > div > ul > li div.icons-container > a.airplay,',
      'body > div > ul > li div.icons-container > a.video-link {',
      '  right: 0;',
      '}',
      'body > div > ul > li div.icons-container > a.airplay + a.video-link {',
      '  right: 17px; /* (60 - 25)/2 to center when there is no proxy icon */',
      '}',

      ''
    ]
  })

  var div, ul, li
  var i

  div = make_element('div')
  ul  = make_element('ul')
  div.appendChild(ul)

  if (state.series.title) {
    div.insertBefore(
      make_element('h2', null, state.series.title),
      ul
    )
  }

  if (state.series.summary) {
    div.insertBefore(
      make_element('div', null, state.series.summary),
      ul
    )
  }

  for (i=0; i < state.episodes.length; i++) {
    li = make_episode_listitem_element(
      state.episodes[i]
    )

    if (li) {
      ul.appendChild(li)
    }
  }

  unsafeWindow.document.body.appendChild(div)
}

// ----------------------------------------------------------------------------- DOM: <li> for episode in show series

var make_episode_listitem_element = function(episode) {
  // const {roku_id, play_id, season_number, episode_number, title, summary, duration, date_aired, date_expiration, license} = episode

  var tr, html, li, div_dynamic

  tr = []
  if (episode.season_number)
    append_tr(tr, [strings.episode_labels.season_number, episode.season_number])
  if (episode.episode_number)
    append_tr(tr, [strings.episode_labels.episode_number, episode.episode_number])
  if (episode.title)
    append_tr(tr, [strings.episode_labels.title, episode.title])
  if (episode.duration)
    append_tr(tr, [strings.episode_labels.duration, episode.duration])
  if (episode.date_aired)
    append_tr(tr, [strings.episode_labels.date_aired, episode.date_aired])
  if (episode.date_expiration)
    append_tr(tr, [strings.episode_labels.date_expiration, episode.date_expiration])
  if (episode.license)
    append_tr(tr, [strings.episode_labels.license, episode.license])
  if (episode.summary)
    append_tr(tr, strings.episode_labels.summary, 2)

  html = [
    '<table>' + tr.join("\n") + '</table>',
    '<blockquote>' + episode.summary + '</blockquote>',
    '<div></div>'
  ]

  li = make_element('li', html.join("\n"))

  div_dynamic = li.querySelector(':scope > div')
  div_dynamic.appendChild(
    make_download_video_content_button(episode.roku_id, episode.play_id)
  )

  return li
}

var make_download_video_content_button = function(roku_id, play_id) {
  var button = make_element('button')

  button.setAttribute(constants.button_attributes.roku_id, roku_id)
  button.setAttribute(constants.button_attributes.play_id, play_id)
  button.textContent = strings.button_download_video
  button.addEventListener("click", onclick_download_video_content_button)

  return button
}

var onclick_download_video_content_button = function(event) {
  cancel_event(event)

  var button, div_dynamic, roku_id, play_id

  button = event.target
  if (!button) return

  div_dynamic = button.parentElement
  if (!div_dynamic) return

  roku_id = button.getAttribute(constants.button_attributes.roku_id)
  play_id = button.getAttribute(constants.button_attributes.play_id)
  if (!roku_id || !play_id) return

  download_video_content(roku_id, play_id, function(video_sources) {
    add_video_sources_to_listitem_element(div_dynamic, video_sources)
  })
}

var add_video_sources_to_listitem_element = function(div_dynamic, video_sources) {
  // video_sources is array of video_data: {video_url, video_type, caption_url, referer_url, drm: {scheme, server, headers}}

  var tr, video_data, video_summary, td_button, td_icons, div_icons, a_icons, a_icon
  var i

  tr = []
  for (i=0; i < video_sources.length; i++) {
    video_data = video_sources[i]

    video_summary  = '<ul>'
    video_summary += '  <li>' + strings.episode_labels.video.format + ' ' + video_data.video_type + '</li>'
    video_summary += '  <li>' + strings.episode_labels.video.drm    + ' ' + (video_data.drm.scheme || 'none') + '</li>'
    video_summary += '</ul>'

    append_tr(tr, ['', video_summary, '']) // col 1: button. col 3: icons.
  }
  empty_element(div_dynamic, '<table>' + tr.join("\n") + '</table>')

  tr = div_dynamic.querySelectorAll(':scope > table tr')

  for (i=0; i < tr.length; i++) {
    video_data = video_sources[i]

    td_button = tr[i].querySelector(':scope > td:first-child')
    td_icons  = tr[i].querySelector(':scope > td:last-child')

    add_start_video_button(/* block_element= */ td_button, video_data)

    if (video_data.drm.scheme) {
      div_icons = make_webcast_reloaded_div(video_data)

      a_icons = {
        real:    {},  // order: chromecast, airplay, [proxy], video-link
        ordered: []
      }

      a_icons.real.airplay    = div_icons.querySelector('a.airplay')
      a_icons.real.direct_hls = div_icons.querySelector('a.video-link')

      a_icon = a_icons.real.direct_hls.cloneNode(/* deep= */ true)
      a_icon.className = 'chromecast'
      a_icons.ordered.push(a_icon)

      a_icon = a_icons.real.direct_hls.cloneNode(/* deep= */ true)
      a_icon.className = 'airplay'
      a_icon.setAttribute('href',  video_data.drm.server)
      a_icon.setAttribute('title', 'direct link to ' + video_data.drm.scheme + ' drm server')
      a_icons.ordered.push(a_icon)

      a_icon = a_icons.real.airplay.cloneNode(/* deep= */ true)
      a_icon.className = 'video-link'
      a_icons.ordered.push(a_icon)

      empty_element(div_icons)

      for (var j=0; j < a_icons.ordered.length; j++) {
        a_icon = a_icons.ordered[j]

        div_icons.appendChild(a_icon)
      }
      a_icons = null

      td_icons.appendChild(div_icons)
    }
    else {
      insert_webcast_reloaded_div(/* block_element= */ td_icons, video_data)
    }
  }
}

var add_start_video_button = function(block_element, video_data) {
  var new_button = make_start_video_button(video_data)

  block_element.appendChild(new_button)
}

var make_start_video_button = function(video_data) {
  var button = make_element('button')

  button.setAttribute(constants.button_attributes.video_url,   video_data.video_url   || '')
  button.setAttribute(constants.button_attributes.video_type,  video_data.video_type  || '')
  button.setAttribute(constants.button_attributes.caption_url, video_data.caption_url || '')
  button.setAttribute(constants.button_attributes.referer_url, video_data.referer_url || '')
  button.setAttribute(constants.button_attributes.drm_scheme,  video_data.drm.scheme  || '')
  button.setAttribute(constants.button_attributes.drm_server,  video_data.drm.server  || '')
  button.textContent = strings.button_start_video
  button.addEventListener("click", onclick_start_video_button)

  return button
}

var onclick_start_video_button = function(event) {
  cancel_event(event)

  var button      = event.target
  var video_url   = button.getAttribute(constants.button_attributes.video_url)
  var video_type  = button.getAttribute(constants.button_attributes.video_type)
  var caption_url = button.getAttribute(constants.button_attributes.caption_url)
  var referer_url = button.getAttribute(constants.button_attributes.referer_url)
  var drm_scheme  = button.getAttribute(constants.button_attributes.drm_scheme)
  var drm_server  = button.getAttribute(constants.button_attributes.drm_server)

  if (video_url)
    process_video_url(video_url, video_type, caption_url, referer_url, drm_scheme, drm_server)
}

// -----------------------------------------------------------------------------

var insert_webcast_reloaded_div = function(block_element, video_data) {
  var webcast_reloaded_div = make_webcast_reloaded_div(video_data)

  block_element.appendChild(webcast_reloaded_div)
}

var make_webcast_reloaded_div = function(video_data) {
  var webcast_reloaded_urls = get_webcast_reloaded_urls(video_data)

  var div = make_element('div')

  var html = [
    '<a target="_blank" class="chromecast" href="' + webcast_reloaded_urls.chromecast_sender   + '" title="Chromecast Sender"><img src="'       + constants.img_urls.base_webcast_reloaded_icons + 'chromecast.png"></a>',
    '<a target="_blank" class="airplay" href="'    + webcast_reloaded_urls.airplay_sender      + '" title="ExoAirPlayer Sender"><img src="'     + constants.img_urls.base_webcast_reloaded_icons + 'airplay.png"></a>',
    '<a target="_blank" class="proxy" href="'      + webcast_reloaded_urls.proxy               + '" title="HLS-Proxy Configuration"><img src="' + constants.img_urls.base_webcast_reloaded_icons + 'proxy.png"></a>',
    '<a target="_blank" class="video-link" href="' + video_data.video_url                      + '" title="direct link to video"><img src="'    + constants.img_urls.base_webcast_reloaded_icons + 'video_link.png"></a>'
  ]

  div.setAttribute('class', 'icons-container')
  div.innerHTML = html.join("\n")

  return div
}

// ----------------------------------------------------------------------------- bootstrap

var page_init = function() {
  debug('initializing..', true)

  try {
    state.csrf_token = unsafeWindow.__Roku_App_Initial_Values.resource.csrf
    if (!state.csrf_token) throw new Error('missing: CSRF token')

    var path_regex = new RegExp('^/(?:details|watch)/([^/]+)(?:/.*)?$')
    var match = path_regex.exec(unsafeWindow.location.pathname)
    if (match) {
      var roku_id = match[1]
      download_roku_content(roku_id, reinitialize_dom)
    }
  }
  catch(e) {
    debug(e.message, true)
  }
}

if (user_options.common.init_delay_ms)
  unsafeWindow.setTimeout(page_init, user_options.common.init_delay_ms)
else
  page_init()
