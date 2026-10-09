#include "http_demo.h"

#include <WebServer.h>

namespace http_demo {

namespace {

WebServer server(80);
JsonProvider dataProvider = nullptr;
JsonProvider statusProvider = nullptr;

void sendJson(JsonProvider provider, const char* unavailable) {
  String json;
  if (provider && provider(json)) {
    server.send(200, "application/json", json);
  } else {
    server.send(503, "application/json", unavailable);
  }
}

// Página autónoma: consulta /data y /status cada segundo. Sin recursos externos.
const char PAGE[] PROGMEM = R"HTML(
<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wearable IoMT - Vitalia</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;background:#0f172a;color:#e2e8f0}
 header{padding:16px 20px;background:#1e293b;font-size:18px;font-weight:600}
 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:16px}
 .card{background:#1e293b;border-radius:10px;padding:16px}
 .k{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px}
 .v{font-size:28px;font-weight:700;margin-top:4px}
 .u{font-size:14px;color:#94a3b8}
 .alert{background:#7f1d1d}
 pre{margin:0 16px 16px;padding:12px;background:#1e293b;border-radius:10px;font-size:12px;white-space:pre-wrap;word-break:break-all}
 footer{padding:12px 20px;font-size:12px;color:#64748b}
 .dot{height:8px;width:8px;border-radius:50%;display:inline-block;margin-right:6px}
 .ok{background:#22c55e}.bad{background:#ef4444}
</style></head><body>
<header>Wearable IoMT &mdash; Vitalia <span id="dev" class="u"></span></header>
<div class="grid">
 <div class="card"><div class="k">Temp. central (est.)</div><div class="v"><span id="temp">--</span><span class="u"> &deg;C</span></div><div class="u" id="skin"></div></div>
 <div class="card"><div class="k">Pico de aceleraci&oacute;n</div><div class="v"><span id="acc">--</span><span class="u"> g</span></div><div class="u">umbral de ca&iacute;da 2.8 g</div></div>
 <div class="card"><div class="k">Evento</div><div class="v" id="evt">--</div></div>
 <div class="card"><div class="k">BPM / SpO2</div><div class="v u" style="font-size:18px">pendiente<br>(Hito 5)</div></div>
 <div class="card"><div class="k">seq</div><div class="v" style="font-size:20px" id="seq">--</div><div class="u" id="ts"></div></div>
 <div class="card"><div class="k">Se&ntilde;al Wi-Fi</div><div class="v"><span id="rssi">--</span><span class="u"> dBm</span></div></div>
</div>
<div class="k" style="padding:0 16px 6px">TelemetryReading (/data)</div>
<pre id="raw">esperando...</pre>
<footer>
 <span class="dot" id="d_mpu"></span>MPU6050
 &nbsp;<span class="dot" id="d_mlx"></span>MLX90614
 &nbsp;<span class="dot" id="d_ntp"></span>NTP
 &nbsp;|&nbsp; IP <span id="ip"></span> &nbsp;|&nbsp; arranque <span id="boot"></span> &nbsp;|&nbsp; uptime <span id="up"></span> s
</footer>
<script>
const $=id=>document.getElementById(id);
async function tick(){
 try{
  const s=await (await fetch('/status')).json();
  $('dev').textContent=s.wearableId; $('rssi').textContent=s.rssi_dbm; $('ip').textContent=s.ip;
  $('boot').textContent=s.boot; $('up').textContent=s.uptime_s;
  $('skin').textContent=s.temp_skin_c!=null?('piel '+s.temp_skin_c+' °C'):'';
  $('d_mpu').className='dot '+(s.sensors.mpu6050?'ok':'bad');
  $('d_mlx').className='dot '+(s.sensors.mlx90614?'ok':'bad');
  $('d_ntp').className='dot '+(s.ntp?'ok':'bad');
  $('evt').textContent=s.impact_recent?'CAÍDA':'normal';
  $('evt').parentElement.className='card'+(s.impact_recent?' alert':'');
  const r=await fetch('/data');
  if(r.status!==200){ $('raw').textContent=(await r.json()).error; return; }
  const d=await r.json();
  $('raw').textContent=JSON.stringify(d);
  $('temp').textContent=d.temp??'--'; $('acc').textContent=d.accPeakG??'--';
  $('seq').textContent=d.seq; $('ts').textContent=new Date(d.ts).toLocaleTimeString();
 }catch(e){}
}
setInterval(tick,1000); tick();
</script>
</body></html>
)HTML";

}  // namespace

void begin(JsonProvider data, JsonProvider status) {
  dataProvider = data;
  statusProvider = status;
  server.on("/", []() { server.send_P(200, "text/html", PAGE); });
  server.on("/data", []() {
    sendJson(dataProvider, "{\"error\":\"Todavía no hay lecturas: esperando la hora por NTP.\"}");
  });
  server.on("/status", []() { sendJson(statusProvider, "{\"error\":\"Sin estado.\"}"); });
  server.onNotFound([]() { server.send(404, "text/plain", "not found"); });
  server.begin();
}

void loop() { server.handleClient(); }

}  // namespace http_demo
