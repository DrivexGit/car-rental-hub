// Runs in the Drivex page inside the Android app (only on the Drivex origin). WebView cannot save a link with a
// `download` attribute by itself, and cannot save `blob:` files at all, so such links are handed to the app:
//   { type: "dataUrl", data, name }  a file the page made (blob:/data:), read here and sent as a data: URL
//   { type: "url", url, name }       a file on a server, fetched by Android's download manager
(function () {
  if (window.__drivexAndroid || !window.DrivexAndroid) return;
  window.__drivexAndroid = true;
  var post = function (msg) { window.DrivexAndroid.postMessage(JSON.stringify(msg)); };

  var save = function (a) {
    var href = a.href, name = a.getAttribute("download") || "";
    if (/^(blob|data):/i.test(href)) {
      fetch(href).then(function (r) { return r.blob(); }).then(function (blob) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }).then(function (data) { post({ type: "dataUrl", data: data, name: name }); })
        .catch(function () { post({ type: "failed" }); });
    } else {
      post({ type: "url", url: href, name: name });
    }
  };
  var isDownload = function (el) { return el instanceof HTMLAnchorElement && el.hasAttribute("download") && !!el.href; };

  // links in the page
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[download]") : null;
    if (a && a.href) { e.preventDefault(); e.stopImmediatePropagation(); save(a); }
  }, true);
  // links made in code and never added to the page (jsPDF / FileSaver call click() or dispatch a click event)
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { return isDownload(this) ? save(this) : click.call(this); };
  var dispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (e) {
    if (e && e.type === "click" && isDownload(this) && !this.isConnected) { save(this); return false; }
    return dispatch.call(this, e);
  };
})();
