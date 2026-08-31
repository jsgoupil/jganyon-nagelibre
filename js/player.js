/* Custom podcast player, recreating the look/behaviour of the original
   PowerPress player widget without any WordPress backend. */

(function () {
  "use strict";

  var ICONS = {
    play: '<svg viewBox="0 0 24 24"><path d="M6 4l15 8-15 8V4z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 4h2v16H6zM20 5.5v13L9 12l11-6.5z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 4h2v16h-2zM4 5.5v13l11-6.5L4 5.5z"/></svg>',
    back15: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/></svg>',
    fwd15: '<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M18 16.1c-.8 0-1.4.3-2 .8l-7-4.1c.1-.3.1-.5.1-.8s0-.5-.1-.8l6.9-4c.6.5 1.3.9 2.1.9 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .3 0 .5.1.8L8.1 9.9C7.5 9.3 6.8 9 6 9c-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2.1-.9l7 4.1c-.1.3-.1.5-.1.7 0 1.6 1.3 2.9 3 2.9s3-1.3 3-3-1.3-2.7-3-2.7z"/></svg>'
  };

  var RATES = [1, 1.25, 1.5, 1.75, 2, 0.5, 0.75];
  var PAGE_SIZE = 10;

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    var ss = String(s).padStart(2, "0");
    return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }

  function fmtRate(r) {
    return (r % 1 === 0 ? r.toFixed(0) : String(r)) + "x";
  }

  function truncate(str, len) {
    if (!str) return "";
    if (str.length <= len) return str;
    return str.slice(0, len).replace(/\s+\S*$/, "") + "…";
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function PodcastPlayer(container, opts) {
    this.container = container;
    this.episodes = opts.episodes;
    this.showList = !!opts.showList && this.episodes.length > 1;
    this.showName = opts.showName || "Nage-Libre";
    this.coverSrc = opts.coverSrc;
    this.index = opts.initialIndex || 0;
    this.rateIndex = 0;
    this.visibleCount = PAGE_SIZE;
    this.audio = new Audio();
    this.audio.preload = "metadata";
    this._build();
    this._loadEpisode(this.index, false);
  }

  PodcastPlayer.prototype._build = function () {
    var root = el("div", "player" + (this.showList ? "" : " player-embed"));

    var header = el("div", "player-header");
    var cover = el("div", "player-cover", '<img src="' + this.coverSrc + '" alt="' + this.showName + '">');
    var info = el("div", "player-info");
    info.appendChild(el("p", "player-show", this.showName));
    var epTitle = el("p", "player-episode-title", "");
    var epDesc = el("p", "player-episode-desc", "");
    info.appendChild(epTitle);
    info.appendChild(epDesc);
    header.appendChild(cover);
    header.appendChild(info);

    var controls = el("div", "player-controls");
    var rateBtn = el("button", "rate-btn", "1x");
    rateBtn.type = "button";
    rateBtn.setAttribute("aria-label", "Change playback rate");

    var prevBtn = el("button", "step-btn prev-btn", ICONS.prev);
    prevBtn.type = "button";
    prevBtn.setAttribute("aria-label", "Go to previous episode");

    var backBtn = el("button", "skip-btn", ICONS.back15 + "<span>15s</span>");
    backBtn.type = "button";
    backBtn.setAttribute("aria-label", "Skip backward 15 seconds");

    var playBtn = el("button", "play-btn", '<span class="icon-play">' + ICONS.play + '</span><span class="icon-pause">' + ICONS.pause + "</span>");
    playBtn.type = "button";
    playBtn.setAttribute("aria-label", "Play or pause");

    var fwdBtn = el("button", "skip-btn", ICONS.fwd15 + "<span>15s</span>");
    fwdBtn.type = "button";
    fwdBtn.setAttribute("aria-label", "Skip forward 15 seconds");

    var nextBtn = el("button", "step-btn next-btn", ICONS.next);
    nextBtn.type = "button";
    nextBtn.setAttribute("aria-label", "Skip to next episode");

    var shareWrap = el("div", "share-tooltip");
    var shareBtn = el("button", "share-btn", ICONS.share);
    shareBtn.type = "button";
    shareBtn.setAttribute("aria-label", "Share this episode");
    shareWrap.appendChild(shareBtn);
    shareWrap.appendChild(el("span", "tooltip-msg", "Link copied!"));

    controls.appendChild(rateBtn);
    if (this.showList) controls.appendChild(prevBtn);
    controls.appendChild(backBtn);
    controls.appendChild(playBtn);
    controls.appendChild(fwdBtn);
    if (this.showList) controls.appendChild(nextBtn);
    controls.appendChild(shareWrap);

    var seek = el("div", "player-seek");
    var curTime = el("span", "player-time time-start", "00:00");
    var track = el("div", "seek-track");
    var fill = el("div", "seek-fill");
    var handle = el("div", "seek-handle");
    track.appendChild(fill);
    track.appendChild(handle);
    var endTime = el("span", "player-time time-end", "00:00");
    seek.appendChild(curTime);
    seek.appendChild(track);
    seek.appendChild(endTime);

    root.appendChild(header);
    root.appendChild(controls);
    root.appendChild(seek);

    var list, loadMoreBtn;
    if (this.showList) {
      list = el("div", "player-list");
      loadMoreBtn = el("button", "player-load-more", "Load more");
      loadMoreBtn.type = "button";
      root.appendChild(list);
      root.appendChild(loadMoreBtn);
    }

    this.container.appendChild(root);

    this.els = {
      root: root, epTitle: epTitle, epDesc: epDesc,
      rateBtn: rateBtn, prevBtn: prevBtn, backBtn: backBtn, playBtn: playBtn,
      fwdBtn: fwdBtn, nextBtn: nextBtn, shareWrap: shareWrap, shareBtn: shareBtn,
      curTime: curTime, endTime: endTime, track: track, fill: fill, handle: handle,
      list: list, loadMoreBtn: loadMoreBtn
    };

    this._bindEvents();
    if (this.showList) this._renderList();
  };

  PodcastPlayer.prototype._bindEvents = function () {
    var self = this;
    var a = this.audio;
    var e = this.els;

    e.rateBtn.addEventListener("click", function () {
      self.rateIndex = (self.rateIndex + 1) % RATES.length;
      a.playbackRate = RATES[self.rateIndex];
      e.rateBtn.textContent = fmtRate(RATES[self.rateIndex]);
    });

    e.backBtn.addEventListener("click", function () {
      a.currentTime = Math.max(0, a.currentTime - 15);
    });

    e.fwdBtn.addEventListener("click", function () {
      a.currentTime = Math.min(a.duration || a.currentTime + 15, a.currentTime + 15);
    });

    e.playBtn.addEventListener("click", function () {
      if (a.paused) a.play(); else a.pause();
    });

    if (this.showList) {
      e.prevBtn.addEventListener("click", function () { self._step(1); });
      e.nextBtn.addEventListener("click", function () { self._step(-1); });
    }

    e.shareBtn.addEventListener("click", function () {
      self._share();
    });

    a.addEventListener("play", function () { e.playBtn.classList.add("is-playing"); });
    a.addEventListener("pause", function () { e.playBtn.classList.remove("is-playing"); });
    a.addEventListener("timeupdate", function () { self._updateSeek(); });
    a.addEventListener("loadedmetadata", function () { self._updateSeek(); });
    a.addEventListener("ended", function () { e.playBtn.classList.remove("is-playing"); });

    var seeking = false;
    function seekFromEvent(evt) {
      var rect = e.track.getBoundingClientRect();
      var clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      var ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      if (isFinite(a.duration)) a.currentTime = ratio * a.duration;
      self._updateSeek();
    }
    e.track.addEventListener("pointerdown", function (evt) {
      seeking = true;
      seekFromEvent(evt);
    });
    window.addEventListener("pointermove", function (evt) {
      if (seeking) seekFromEvent(evt);
    });
    window.addEventListener("pointerup", function () { seeking = false; });

    if (this.showList) {
      e.loadMoreBtn.addEventListener("click", function () {
        self.visibleCount += PAGE_SIZE;
        self._renderList();
      });
    }
  };

  PodcastPlayer.prototype._updateSeek = function () {
    var a = this.audio;
    var ratio = a.duration ? a.currentTime / a.duration : 0;
    this.els.fill.style.width = (ratio * 100) + "%";
    this.els.handle.style.left = (ratio * 100) + "%";
    this.els.curTime.textContent = fmtTime(a.currentTime);
    this.els.endTime.textContent = fmtTime(a.duration || 0);
  };

  PodcastPlayer.prototype._share = function () {
    var ep = this.episodes[this.index];
    var url = window.location.href.split("#")[0] + "#episode-" + ep.number;
    var self = this;
    if (navigator.share) {
      navigator.share({ title: this.showName + " – Episode " + ep.number, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { self._flashTooltip(); });
    } else {
      window.prompt("Copy this link:", url);
    }
  };

  PodcastPlayer.prototype._flashTooltip = function () {
    var wrap = this.els.shareWrap;
    wrap.classList.add("show-tooltip");
    setTimeout(function () { wrap.classList.remove("show-tooltip"); }, 1500);
  };

  PodcastPlayer.prototype._step = function (dir) {
    var next = this.index + dir;
    if (next < 0 || next >= this.episodes.length) return;
    if (next >= this.visibleCount) this.visibleCount = next + 1;
    this._loadEpisode(next, true);
    if (this.showList) this._renderList();
  };

  PodcastPlayer.prototype._loadEpisode = function (index, autoplay) {
    this.index = index;
    var ep = this.episodes[index];
    var e = this.els;
    e.epTitle.textContent = "Episode " + ep.number + ": " + ep.title;
    e.epDesc.textContent = truncate(ep.description, 160);
    this.audio.pause();
    this.audio.src = ep.audioUrl;
    this.audio.currentTime = 0;
    e.curTime.textContent = "00:00";
    e.endTime.textContent = "00:00";
    e.fill.style.width = "0%";
    e.handle.style.left = "0%";
    e.playBtn.classList.remove("is-playing");
    if (this.showList) {
      e.prevBtn.disabled = index >= this.episodes.length - 1;
      e.nextBtn.disabled = index <= 0;
    }
    if (autoplay) this.audio.play().catch(function () {});
  };

  PodcastPlayer.prototype._renderList = function () {
    var self = this;
    var list = this.els.list;
    list.innerHTML = "";
    var count = Math.min(this.visibleCount, this.episodes.length);
    for (var i = 0; i < count; i++) {
      (function (i) {
        var ep = self.episodes[i];
        var item = el("div", "player-list-item" + (i === self.index ? " is-active" : ""));
        item.appendChild(el("span", "item-title", "Episode " + ep.number + ": " + ep.title));
        item.appendChild(el("span", "item-date", ep.pubDateDisplay.toUpperCase()));
        item.addEventListener("click", function () {
          self._loadEpisode(i, true);
          self._renderList();
        });
        list.appendChild(item);
      })(i);
    }
    this.els.loadMoreBtn.hidden = count >= this.episodes.length;
  };

  window.PodcastPlayer = PodcastPlayer;
})();
