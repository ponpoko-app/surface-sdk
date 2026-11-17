import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { runInNewContext } from "node:vm";

const {protectBundle} = createRequire(import.meta.url)("../release/protection.cjs");
async function fixture(run) {
  const base=await mkdtemp(join(tmpdir(),"ponpoko-protection-proof-"));
  try {
    const input=join(base,"input");await mkdir(input);
    await writeFile(join(input,"surface.json"),JSON.stringify({id:"proof",name:"Proof",version:"1.0.0",entry:"index.html",contributes:[{slot:"nav",title:"Proof",icon:"generic"}]}));
    await writeFile(join(input,"index.html"),'<script type="module" src="main.mjs"></script>');
    await run({base,input});
  } finally { await rm(base,{recursive:true,force:true}); }
}

test("protected modules and real worker messages preserve exports, imports and protocol properties", {timeout:30000}, async()=>fixture(async({base,input})=>{
  const program='export function total(rows){return rows.reduce((sum,row)=>sum+row.amount,0)}';
  await writeFile(join(input,"math.mjs"),program);
  await writeFile(join(input,"main.mjs"),'import {total} from "./math.mjs"; export const result={method:"ledger.total",value:total([{amount:2},{amount:3}])}; export const workerUrl=new URL("./worker.mjs",import.meta.url);');
  await writeFile(join(input,"worker.mjs"),'import {parentPort} from "node:worker_threads"; parentPort.on("message",request=>parentPort.postMessage({request_id:request.request_id,method:request.method,value:request.value+1}));');
  await writeFile(join(input,"main.mjs.map"),'source-map-private-marker');
  const output=join(base,"protected");const receipt=await protectBundle(input,output);
  const module=await import(pathToFileURL(join(output,"main.mjs")));
  assert.deepEqual(module.result,{method:"ledger.total",value:5});
  const worker=new Worker(module.workerUrl);
  try {
    const response=new Promise((resolve,reject)=>{worker.once("message",resolve);worker.once("error",reject);});
    worker.postMessage({request_id:"request-1",method:"ledger.total",value:5});
    assert.deepEqual(await response,{request_id:"request-1",method:"ledger.total",value:6});
  } finally { await worker.terminate(); }
  assert.equal(await readFile(join(input,"math.mjs"),"utf8"),program);
  assert.equal((await readdir(output)).includes("main.mjs.map"),false);
  assert.deepEqual(receipt.removed,["main.mjs.map"]);
  assert.equal(receipt.policy,"ponpoko-moderate-v1");
  assert.equal(receipt.signing,false);assert.equal(receipt.encryption,false);
  assert.notEqual(await readFile(join(output,"math.mjs"),"utf8"),program);
  const again=await protectBundle(input,join(base,"again"));
  assert.deepEqual(again,receipt);
}));

test("classic scripts keep shared globals and inline HTML scripts are transformed",async()=>fixture(async({base,input})=>{
  await writeFile(join(input,"one.js"),'globalThis.answer=function calculate(value){return {host_field:value+2}};');
  await writeFile(join(input,"two.js"),'globalThis.result=answer(5);');
  await writeFile(join(input,"index.html"),'<h1>Proof</h1><script>globalThis.inlineValue={method:"keep.this",value:8};</script>');
  const output=join(base,"protected");const receipt=await protectBundle(input,output);
  const context={};runInNewContext((await readFile(join(output,"one.js"),"utf8"))+"\n"+(await readFile(join(output,"two.js"),"utf8")),context);
  assert.equal(context.result.host_field,7);
  const html=await readFile(join(output,"index.html"),"utf8");
  assert.notEqual(html,await readFile(join(input,"index.html"),"utf8"));
  const inline=/<script>([\s\S]*?)<\/script>/.exec(html)[1];
  runInNewContext(inline,context);assert.equal(context.inlineValue.method,"keep.this");assert.equal(context.inlineValue.value,8);
  assert.equal(receipt.scripts,3);
}));

test("source copies, inline event handlers and overlapping destinations are refused",async()=>fixture(async({base,input})=>{
  await assert.rejects(protectBundle(input,join(input,"nested")),/output_invalid/);
  await writeFile(join(input,"index.html"),'<button onclick="alert(1)">Run</button>');
  await assert.rejects(protectBundle(input,join(base,"events")),/inline_handler/);
  await writeFile(join(input,"original.ts"),'const privateImplementation=1;');
  await assert.rejects(protectBundle(input,join(base,"source")),/source_copy/);
}));

test("inline strings cannot terminate their script element",async()=>fixture(async({base,input})=>{
  await writeFile(join(input,"index.html"),String.raw`<script>globalThis.literal="<\/script>";</script><h1>After</h1>`);
  const output=join(base,"protected");await protectBundle(input,output);
  const html=await readFile(join(output,"index.html"),"utf8");
  const inline=/<script>([\s\S]*?)<\/script>/.exec(html)[1];const context={};runInNewContext(inline,context);
  assert.equal(context.literal,"</script>");assert.ok(html.includes("<h1>After</h1>"));
}));
