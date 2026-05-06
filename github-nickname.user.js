// ==UserScript==
// @name         github-nickname
// @namespace    https://github.com/fantasticmao/user-scripts
// @copyright    MIT License
// @version      1.1
// @description  Add nicknames to GitHub feed and profile pages, configured from a remote JSON file
// @icon         https://avatars.githubusercontent.com/u/20675747?s=80
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @author       fantasticmao
// @homepage     https://github.com/fantasticmao
// @match        https://github.com/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/fantasticmao/user-scripts/refs/heads/main/github-nickname.user.js
// @downloadURL  https://raw.githubusercontent.com/fantasticmao/user-scripts/refs/heads/main/github-nickname.user.js
// ==/UserScript==

(function () {
  "use strict";

  var NICKNAME_ATTR = "data-nickname-added";
  var nicknameMap = {};

  // Configuration

  GM_registerMenuCommand("Config nickname", function () {
    var current = GM_getValue("nicknameUrl", "");
    var url = prompt("Enter config URL:", current);
    if (url !== null) {
      GM_setValue("nicknameUrl", url);
      if (url) {
        fetchNicknames(url);
      }
    }
  });

  var nicknameUrl = GM_getValue("nicknameUrl", "");
  if (!nicknameUrl) {
    console.warn("[github-nickname] nicknameUrl is not configured, exiting.");
    return;
  }
  fetchNicknames(nicknameUrl);

  // Data fetching

  function fetchNicknames(url) {
    GM_xmlhttpRequest({
      method: "GET",
      url: url,
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

  // DOM helpers

  function getUsernameFromLink(el) {
    if (!el.textContent.trim()) return null;
    var href = el.getAttribute("href");
    if (!href) return null;
    var match = href.match(/^\/([a-zA-Z0-9-]+)\/?$/);
    return match ? match[1] : null;
  }

  function addNickname(el, username) {
    var nickname = nicknameMap[username];
    if (!nickname || el.hasAttribute(NICKNAME_ATTR)) return;
    el.setAttribute(NICKNAME_ATTR, "true");
    el.textContent = el.textContent.trim() + " (" + nickname + ")";
    console.debug("[github-nickname] added nickname:", username, "->", nickname);
  }

  // Page processing

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

  // Observers & event listeners

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
})();
