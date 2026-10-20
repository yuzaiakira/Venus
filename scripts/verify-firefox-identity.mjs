import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
// Executed only inside Selenium's freshly created disposable browser profile.
export async function verifyFirefoxIdentity(driver, p00URL, scratch) {
  const marker = "venus.identity.synthetic";
  const payload =
    '<img id="venus-injected" src="https://example.invalid/" onerror="globalThis.venusInjected=true"><svg onload="globalThis.venusInjected=true"></svg>';
  const id = "e9f99b68-6d4b-4c63-bd93-aecf536b71aa";
  async function storage(action) {
    return driver.executeAsyncScript(
      `
      const [action,key,id,payload,done]=arguments;
      (async()=>{
        const request=indexedDB.open("Venus-p00");
        const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
        const tx=db.transaction("probes",action==="write"?"readwrite":"readonly");
        const store=tx.objectStore("probes");
        const req=action==="write"?store.put({id,dueAt:0,state:"missed",native:payload}):store.get(id);
        const row=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error);});
        await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
        if(action==="write") await browser.storage.local.set({[key]:payload});
        return {row,local:(await browser.storage.local.get(key))[key]??null,id:browser.runtime.id};
      })().then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));
    `,
      action,
      marker,
      id,
      payload,
    );
  }
  const written = await storage("write");
  assert.equal(written.ok, true);
  assert.equal(written.value.id, "p00@Venus.invalid");
  const archive = join(scratch, "beta.xpi");
  execFileSync("python3", [
    "-c",
    'import zipfile,pathlib,sys; root=pathlib.Path(".output-beta/firefox-mv3"); z=zipfile.ZipFile(sys.argv[1],"w"); [z.write(p,p.relative_to(root)) for p in root.rglob("*") if p.is_file()]; z.close()',
    archive,
  ]);
  await driver.installAddon(archive, true);
  await driver.setContext("chrome");
  const betaURL = await driver.executeScript(
    'const {AboutNewTab}=ChromeUtils.importESModule("resource:///modules/AboutNewTab.sys.mjs"); return AboutNewTab.newTabURL;',
  );
  assert.notEqual(betaURL, p00URL);
  await driver.setContext("content");
  await driver.get(betaURL);
  await driver.wait(
    () => driver.executeScript('return !!document.querySelector("h1")'),
    15000,
  );
  const isolated = await storage("read");
  assert.equal(isolated.ok, true);
  assert.equal(isolated.value.id, "{935006c2-63b4-4e03-b842-11b88571da3b}");
  assert.equal(isolated.value.row, null);
  assert.equal(isolated.value.local, null);
  await storage("write");
  const optionsURL = new URL("options.html", betaURL).href;
  await driver.get(optionsURL);
  await driver.wait(
    () =>
      driver.executeScript(
        'return Array.from(document.querySelectorAll("button")).some((button) => button.textContent.includes("Read durable probe results"))',
      ),
    15000,
  );
  await driver.executeScript(
    'Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Read durable probe results")).click();',
  );
  await driver.wait(
    () =>
      driver.executeScript(
        'return document.querySelector("pre").textContent.includes("venus-injected")',
      ),
    15000,
  );
  const rendered = await driver.executeScript(
    'return {text:document.querySelector("pre").textContent,injected:!!document.querySelector("#venus-injected"),executed:globalThis.venusInjected===true};',
  );
  assert.equal(
    JSON.parse(rendered.text).find((row) => row.id === id).native,
    payload,
  );
  assert.equal(rendered.injected, false);
  assert.equal(rendered.executed, false);
  await driver.get(p00URL);
  await driver.wait(
    () => driver.executeScript('return !!document.querySelector("h1")'),
    15000,
  );
  const retained = await storage("read");
  assert.equal(retained.ok, true);
  assert.equal(retained.value.local, payload);
  assert.equal(retained.value.row.native, payload);
  return {
    p00Id: written.value.id,
    betaId: isolated.value.id,
    p00URL,
    betaURL,
    storageLocalIsolation: "PASS",
    indexedDBIsolation: "PASS",
    p00Retained: "PASS",
    unsafeHTMLTextRendering: "PASS",
    install: "temporary developer add-ons; NOT F01",
    profile: "disposable Selenium profile",
    syntheticOnly: true,
  };
}
