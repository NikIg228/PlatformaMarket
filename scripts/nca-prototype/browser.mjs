import http from "node:http";
import { randomBytes, X509Certificate } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Local, manual NCALayer experiment. Does not read private keys or update NCALayer.
const root = fileURLToPath(new URL("../../", import.meta.url));
const evidence = path.join(root, ".tmp/nca-prototype/evidence");
const sdk = process.env.NCA_SDK_ROOT;
if (!sdk) throw new Error("Set NCA_SDK_ROOT");
const original = await readFile(path.join(evidence, "original.txt"));
const certificate = new X509Certificate(await readFile(path.join(evidence, "test-signer.cer")));
const trust = [];
for (const name of ["CA_Test/NCA/nca_gost2022_test.cer", "CA_Test/ROOT/root_test_gost_2022.cer"])
  trust.push(new X509Certificate(await readFile(path.join(sdk, "Keys and Certs", name))).toString());
const token = randomBytes(24).toString("hex");
const origin = "http://127.0.0.1:4079";
const request = { module: "kz.gov.pki.knca.basics", method: "sign", args: {
  allowedStorages: ["PKCS12"], format: "cms", data: original.toString("base64"),
  signingParams: { decode: true, encapsulate: false, digested: false },
  signerParams: { extKeyUsageOids: ["1.3.6.1.5.5.7.3.4"], serialNumber: certificate.serialNumber, chain: trust }, locale: "ru",
} };
await writeFile(path.join(evidence, "browser-request.json"), JSON.stringify(request, null, 2));
const fixtureParents = await readdir(path.join(sdk, "Keys and Certs/Gost2015"), { withFileTypes: true });
const candidates = [];
for (const entry of fixtureParents.filter(entry => entry.isDirectory())) {
  const candidate = path.join(sdk, "Keys and Certs/Gost2015", entry.name, "Юридическое лицо/Первый руководитель");
  const states = await readdir(candidate).catch(() => []);
  // Exact case matches the Java harness; older SDK sets use uppercase Valid.
  if (states.includes("valid")) candidates.push(path.join(candidate, "valid"));
}
if (candidates.length !== 1) throw new Error("Expected one current SDK head/valid fixture");
const fixtureDir = candidates[0];
const fixtureName = (await readdir(fixtureDir)).find(name => name.endsWith(".p12"));
const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Тест NCALayer — Platforma Market</title>
<style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f4f6;padding:16px}button{font:inherit;padding:12px;margin:8px 8px 8px 0}#status{white-space:pre-wrap}</style>
<h1>Тест NCALayer на учебном документе</h1>
<p>Это технический прототип. Коммерческих обязательств нет. Используйте только тестовый ключ SDK, указанный ниже.</p>
<p>Ключ и пароль вводятся только в окне NCALayer. Сайт их не читает. Рабочие настройки NCALayer не меняются: тестовая цепочка передаётся только в этом запросе.</p>
<h2>Подписываемый текст</h2><pre>${escape(original.toString("utf8"))}</pre>
<h2>Тестовый ключ</h2><pre>${escape(path.join(fixtureDir, fixtureName))}</pre>
<p>Пароль указан в README тестовых сертификатов SDK. Проверка штампа времени выполняется отдельно; этот запрос создаёт CMS без TSP.</p>
<button id="sign">Открыть NCALayer и подписать тест</button><button id="cancel">Проверить отмену в NCALayer</button>
<p id="status" role="status">Готово к проверке.</p>
<script>
const request=${JSON.stringify(request)}; const token=${JSON.stringify(token)};
const status=document.getElementById('status'); const buttons=[...document.querySelectorAll('button')];
async function run(kind){
 buttons.forEach(b=>b.disabled=true); status.textContent=kind==='cancel'?'В окне NCALayer нажмите Отмена.':'Выберите указанный тестовый ключ в NCALayer.';
 const socket=new WebSocket('wss://127.0.0.1:13579/'); let settled=false;
 const finish=async (payload)=>{if(settled)return;settled=true;clearTimeout(timer);socket.close();
   try{const response=await fetch('/receipt',{method:'POST',headers:{'Content-Type':'application/json','X-Prototype-Token':token},body:JSON.stringify({kind,payload})});
     if(!response.ok)throw new Error('Сохранение ответа не выполнено');
     const hasCms=payload.status===true&&Array.isArray(payload.body?.result)&&payload.body.result.length>0;
     const outcome=hasCms?(kind==='cancel'?'NCALayer вернул подпись: отмена НЕ подтверждена.':'NCALayer вернул подпись. Криптографическая проверка выполняется отдельно.'):'NCALayer завершил запрос без подписи; ответ сохранён для проверки отмены/ошибки.';
     status.textContent=outcome+'\\n'+JSON.stringify({status:payload.status,code:payload.code,message:payload.message,body:payload.status===false?payload.body:undefined},null,2);
   }catch(e){status.textContent=e.message}finally{buttons.forEach(b=>b.disabled=false)}};
 const timer=setTimeout(()=>finish({status:false,code:'PROTOTYPE_TIMEOUT'}),120000);
 socket.onopen=()=>socket.send(JSON.stringify(request));
 socket.onmessage=e=>{try{const parsed=JSON.parse(e.data);if(typeof parsed.status==='boolean')finish(parsed)}catch{finish({status:false,code:'INVALID_JSON'})}};
 socket.onerror=()=>finish({status:false,code:'NCALAYER_CONNECTION_FAILED'});
 socket.onclose=()=>{if(!settled)finish({status:false,code:'NCALAYER_CONNECTION_CLOSED'})};
}
document.getElementById('sign').onclick=()=>run('sign');document.getElementById('cancel').onclick=()=>run('cancel');
</script></html>`;
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' wss://127.0.0.1:13579; frame-ancestors 'none'");
  if (req.headers.host !== "127.0.0.1:4079") { res.writeHead(403).end(); return; }
  if (req.method === "GET" && req.url === "/") { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html); return; }
  if (req.method !== "POST" || req.url !== "/receipt") { res.writeHead(404).end(); return; }
  if (req.headers.origin !== origin || req.headers["x-prototype-token"] !== token) { res.writeHead(403).end(); return; }
  try {
    let text = "";
    for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 128_000) throw new Error("Response too large"); }
    const body = JSON.parse(text);
    if (!["sign", "cancel"].includes(body.kind) || !body.payload || typeof body.payload !== "object") throw new Error("Invalid receipt");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(path.join(evidence, `ncalayer-${body.kind}-${stamp}.json`), JSON.stringify(body.payload, null, 2));
    res.writeHead(201, { "Content-Type": "application/json" }).end('{"saved":true}');
    console.log(`NCALayer ${body.kind} receipt saved: status=${body.payload.status}, code=${body.payload.code ?? "none"}`);
  } catch { res.writeHead(400).end(); }
});
server.listen(4079, "127.0.0.1", () => console.log(`Synthetic test page: ${origin}`));
server.requestTimeout = 10_000;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
