/* 英語版（/en/）で /events.js の開催予定を表示するための道具。
   予定そのものは /events.js だけに書く（ここには書かない）。
   ここは日付の英語表記・会場名の英語表記・申込先の英語ページへの読み替えだけを受け持つ。 */
(function(){
  var WD = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var WD_LONG = ["Sundays","Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays"];
  var MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function parts(iso){ var p = iso.split("-"); return new Date(+p[0], +p[1]-1, +p[2]); }
  /* "2026-11-16" → "Mon, 16 November 2026" */
  window.nakatokoFmtDateEn = function(iso){
    var dt = parts(iso);
    return WD[dt.getDay()] + ", " + dt.getDate() + " " + MO[dt.getMonth()] + " " + dt.getFullYear();
  };
  window.nakatokoWeekdayPluralEn = function(iso){ return WD_LONG[parts(iso).getDay()]; };
  /* 会場名（events.js の v）。二の丸能楽堂の回は v が無い */
  window.nakatokoVenueEn = function(e){
    if(!e || !e.v) return "";
    if(e.v.indexOf("世木") > -1) return "Seki Shrine, Ise";
    return e.v; /* 英語名の無い会場は、日本語のまま出す */
  };
  /* 申込先。伊勢 世木神社の回は日本語ページの #apply を指しているので、英語ページの #apply に読み替える */
  window.nakatokoUrlEn = function(e){
    if(e && e.url && e.url.indexOf("/taiken/seki/") > -1) return "/en/taiken/seki/#apply";
    return e ? e.url : "";
  };
})();
