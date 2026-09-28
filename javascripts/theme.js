/* Jiggl theme for Redmine 6: what CSS alone cannot do.
 * https://github.com/zara-tec/redmine-jiggl-theme
 * Presentation only: adds logo, avatars and lozenges and resizes the Gantt
 * chart; it never changes data or forms. Redmine loads this file in <head>. */
(function () {
  "use strict";

  var COLORS = ["#0c66e4", "#6e5dc6", "#1f845a", "#e56910", "#c9372c", "#1d7f8c", "#ae4787", "#943d73"];

  // Redmine status id -> lozenge colour. The ids are those of Redmine's default
  // data: 1 New, 2 In Progress, 3 Resolved, 4 Feedback, 5 Closed, 6 Rejected.
  // Statuses not listed are grey, or green when closed.
  var STATUS = { 2: "inprogress", 3: "success", 4: "moved", 5: "success", 6: "removed" };

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function initials(name) {
    var words = name.trim().split(/\s+/);
    var s = words.length > 1 ? words[0].charAt(0) + words[1].charAt(0) : name.trim().slice(0, 2);
    return s.toUpperCase();
  }

  function projectAvatar(name) {
    var el = document.createElement("span");
    el.className = "jr-project-avatar";
    el.setAttribute("aria-hidden", "true");
    el.style.backgroundColor = COLORS[hash(name) % COLORS.length];
    el.textContent = initials(name);
    return el;
  }

  function addBrand() {
    var top = document.getElementById("top-menu");
    if (!top || top.querySelector(".jr-brand")) return;
    var home = top.querySelector("a.home");
    var parts = document.title.split(" - ");
    var a = document.createElement("a");
    a.className = "jr-brand";
    a.href = home ? home.getAttribute("href") : "/";
    var logo = document.createElement("span");
    logo.className = "jr-logo";
    a.appendChild(logo);
    a.appendChild(document.createTextNode(parts[parts.length - 1] || "Redmine"));
    top.insertBefore(a, top.firstChild);
  }

  function addUserAvatar() {
    var link = document.querySelector("#loggedas a.user");
    var avatar = document.querySelector(".flyout-menu__avatar .avatar");
    if (!link || !avatar || link.querySelector(".avatar")) return;
    var copy = avatar.cloneNode(true);
    copy.className = copy.className.replace(/\bs\d+\b/, "s24");
    link.insertBefore(copy, link.firstChild);
  }

  function addProjectAvatar() {
    var current = document.querySelector("#header h1 .current-project");
    if (!current) document.body.classList.add("jr-no-project");
    if (!current || current.previousElementSibling && current.previousElementSibling.classList.contains("jr-project-avatar")) return;
    current.parentNode.insertBefore(projectAvatar(current.textContent), current);
  }

  function searchPlaceholder() {
    var q = document.getElementById("q");
    var label = document.querySelector('#quick-search label[for="q"]');
    if (q && !q.placeholder) q.placeholder = label ? label.textContent.replace(":", "").trim() : "";
  }

  function lozengeFor(holder) {
    var cls = holder.className || "";
    var m = cls.match(/\bstatus-(\d+)\b/);
    var kind = m && STATUS[m[1]];
    if (!kind && /\bclosed\b/.test(cls)) kind = "success";
    return "jr-lz" + (kind ? " jr-lz--" + kind : "");
  }

  function wrap(cell, holder) {
    if (!cell || !holder || cell.querySelector(".jr-lz") || !cell.textContent.trim()) return;
    var span = document.createElement("span");
    span.className = lozengeFor(holder);
    while (cell.firstChild) span.appendChild(cell.firstChild);
    span.title = span.textContent.trim();
    cell.appendChild(span);
  }

  function addLozenges() {
    var cells = document.querySelectorAll("table.list tr.issue td.status");
    for (var i = 0; i < cells.length; i++) wrap(cells[i], cells[i].parentNode);
    var issue = document.querySelector("div.issue.details");
    if (issue) wrap(issue.querySelector(".status.attribute .value"), issue);
  }


  /* ---------------- Gantt ----------------
   * Redmine draws the Gantt chart with inline pixel positions: 20px rows and a
   * fixed width (days x zoom). Here rows become 32px and the chart stretches to
   * fill its column (never narrower than the original); then Redmine redraws
   * relation arrows and progress lines. Collapse/expand keeps working: it moves
   * rows by "top_increment", which is rescaled the same way. */
  var ROW = 32, BAR = 12, OFF = (ROW - BAR) / 2;

  function px(v) { return v === "" ? null : parseFloat(v); }

  function ganttRows(table) {
    var subjects = table.querySelectorAll(".gantt_subjects div[data-collapse-expand][style]");
    if (!subjects.length) return false;
    var h0 = Infinity;
    for (var i = 0; i < subjects.length; i++) h0 = Math.min(h0, px(subjects[i].style.top));
    var first = window.jQuery && window.jQuery(subjects[0]).data("collapse-expand");
    var step = first && first.top_increment ? parseFloat(first.top_increment) : 20;
    var fy = ROW / step;

    var maxTop = h0;
    var all = table.querySelectorAll("[style*='top']");
    for (var j = 0; j < all.length; j++) {
      var t = px(all[j].style.top);
      if (t === null || t < h0) continue;
      var nt = h0 + (t - h0) * fy + OFF;
      all[j].style.top = nt + "px";
      maxTop = Math.max(maxTop, nt);
    }
    if (window.jQuery) {
      window.jQuery(table).find("div[data-collapse-expand]").each(function () {
        var d = window.jQuery(this).data("collapse-expand");
        if (d && d.top_increment) d.top_increment = ROW;
      });
    }

    // height: up to the last row plus a margin, instead of Redmine's ~270px of blank space
    var area = document.getElementById("gantt_area");
    var oldArea = px(area.style.height);
    var newArea = Math.max(maxTop - OFF + ROW + 16 + 24, h0 + ROW * 3 + 24);
    var delta = newArea - oldArea;
    var tall = table.querySelectorAll("[style*='height']");
    for (var k = 0; k < tall.length; k++) {
      var h = px(tall[k].style.height);
      if (h !== null && h >= 150) tall[k].style.height = (h + delta) + "px";
    }
    return true;
  }

  function ganttWidth() {
    var area = document.getElementById("gantt_area");
    if (!area) return;
    var els = area.querySelectorAll("[style*='left'], [style*='width']");
    var strip = area.querySelector(".gantt_hdr");
    if (!strip) return;
    if (!strip.dataset.jrW) strip.dataset.jrW = px(strip.style.width);
    var g = parseFloat(strip.dataset.jrW) + 1;
    var fx = Math.max(1, (area.clientWidth - 1) / g);
    for (var i = 0; i < els.length; i++) {
      var el = els[i], st = el.style;
      if (el.dataset.jrL === undefined) { el.dataset.jrL = st.left; el.dataset.jrW = st.width; }
      var l = px(el.dataset.jrL), w = px(el.dataset.jrW);
      var fixedWidth = el.id === "today_line" || /\b(label|marker)\b/.test(el.className);
      if (l !== null) st.left = (l * fx) + "px";
      if (w !== null && !fixedWidth) {
        st.width = (/\bgantt_hdr\b/.test(el.className) ? (w + 1) * fx - 1 : w * fx) + "px";
      }
    }
  }

  function redrawGantt() {
    if (typeof window.drawGanttHandler === "function") { try { window.drawGanttHandler(); } catch (e) {} }
  }

  function setupGantt() {
    var table = document.querySelector("table.gantt-table");
    if (!table || !document.getElementById("gantt_area")) return;
    if (!ganttRows(table)) return;
    ganttWidth();
    table.classList.add("jr-gantt");
    redrawGantt();
    // the chart column only gets its final width once the page has loaded, and
    // changes when the sidebar is toggled or the window is resized
    var area = document.getElementById("gantt_area"), last = area.clientWidth, timer;
    function refit() {
      if (area.clientWidth === last) return;
      last = area.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(function () { ganttWidth(); redrawGantt(); }, 30);
    }
    if (window.ResizeObserver) new ResizeObserver(refit).observe(area.parentNode);
    window.addEventListener("resize", refit);
    window.addEventListener("load", function () { last = -1; refit(); });
  }

  function run() {
    try { addBrand(); addUserAvatar(); addProjectAvatar(); searchPlaceholder(); addLozenges(); } catch (e) { /* presentation only */ }
  }

  document.addEventListener("DOMContentLoaded", function () {
    run();
    try { setupGantt(); } catch (e) { /* on error, Redmine's own Gantt stays */ }
    // lists and relations reloaded via Ajax
    if (window.jQuery) window.jQuery(document).ajaxComplete(function () { try { addLozenges(); } catch (e) {} });
  });
})();
