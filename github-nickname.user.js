// ==UserScript==
// @name         github-nickname
// @version      1.0
// @author       fantasticmao
// @description  Add nicknames to GitHub feed and profile pages, configured from a remote JSON file
// @match        *://github.com/*
// @icon         https://avatars.githubusercontent.com/u/20675747?s=80
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @namespace    https://github.com/fantasticmao/user-script
// @updateURL    https://raw.githubusercontent.com/fantasticmao/user-script/refs/heads/main/github-nickname.user.js
// @downloadURL  https://raw.githubusercontent.com/fantasticmao/user-script/refs/heads/main/github-nickname.user.js
// @supportURL   https://github.com/fantasticmao/user-script
// @homepageURL  https://github.com/fantasticmao/user-script
// ==/UserScript==

(function () {
  "use strict";

  var NICKNAME_URL = "https://example.com/nicknames.json";
  var NICKNAME_ATTR = "data-nickname-added";

  var nicknameMap = {};

  function fetchNicknames() {
    GM_xmlhttpRequest({
      method: "GET",
      url: NICKNAME_URL,
      responseType: "json",
      onload: function (response) {
        if (response.status === 200 && response.response) {
          nicknameMap = response.response;
          console.debug(
            "[github-nickname] nicknames loaded, count:",
            Object.keys(nicknameMap).length,
          );
          processPage();
        } else {
          console.warn("[github-nickname] unexpected response status:", response.status);
        }
      },
      onerror: function (err) {
        console.error("[github-nickname] failed to fetch nicknames:", err);
      },
    });
  }

  function getUsernameFromLink(el) {
    if (!el.textContent.trim()) return null;
    var href = el.getAttribute("href");
    if (!href) return null;
    var match = href.match(/^\/([a-zA-Z0-9-]+)\/?$/);
    return match ? match[1] : null;
  }

  function addNickname(el, username) {
    var nickname = nicknameMap[username.toLowerCase()];
    if (!nickname || el.hasAttribute(NICKNAME_ATTR)) return;
    el.setAttribute(NICKNAME_ATTR, "true");
    el.textContent = el.textContent.trim() + " (" + nickname + ")";
    console.debug("[github-nickname] added nickname:", username, "->", nickname);
  }

  function processFeedPage() {
    var links = document.querySelectorAll(
      'a[data-hovercard-type="user"]:not([' + NICKNAME_ATTR + "])",
    );
    links.forEach(function (link) {
      var username = getUsernameFromLink(link);
      if (username) addNickname(link, username);
    });
  }

  function processProfilePage() {
    var path = location.pathname;
    var match = path.match(/^\/([a-zA-Z0-9-]+)\/?$/);
    if (!match) return;
    var username = match[1];
    var nameEl = document.querySelector(".vcard-fullname");
    if (nameEl) addNickname(nameEl, username);
  }

  function processPage() {
    if (location.pathname === "/" || location.pathname === "/dashboard") {
      console.debug("[github-nickname] processing feed page");
      processFeedPage();
    } else if (/^\/[a-zA-Z0-9-]+\/?$/.test(location.pathname)) {
      console.debug("[github-nickname] processing profile page");
      processProfilePage();
    }
  }

  var debounceTimer = null;
  var observer = new MutationObserver(function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processPage, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  var origPushState = history.pushState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    console.debug("[github-nickname] pushState detected, path:", location.pathname);
    processPage();
  };
  var origReplaceState = history.replaceState;
  history.replaceState = function () {
    origReplaceState.apply(this, arguments);
    console.debug("[github-nickname] replaceState detected, path:", location.pathname);
    processPage();
  };
  window.addEventListener("popstate", function () {
    console.debug("[github-nickname] popstate detected, path:", location.pathname);
    processPage();
  });

  fetchNicknames();
})();
