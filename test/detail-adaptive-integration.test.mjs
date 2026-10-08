import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {makeStorage} from '../storage.js'
import {createDetailSync} from '../ui/detailSync.js'
import {startAdaptivePoll} from '../ui/adaptivePoll.js'
const source=readFileSync(new URL('../ui/Detail.jsx',import.meta.url),'utf8')
const callback=source.slice(source.indexOf('    poll = startAdaptivePoll('),source.indexOf('    const onFocus',source.indexOf('    poll = startAdaptivePoll(')))
async function flush(){for(let i=0;i<15;i++)await Promise.resolve()}
for(const hung of ['artifacts/','shares/'])test(`adaptive detail polling progresses independently while ${hung} is pending`,async()=>{
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch
  mock.timers.enable({apis:['setTimeout']})
  let poll,sync,release
  try{
    globalThis.window={mobius:{storage:{subscribe(){return ()=>{}}}}}
    const calls={record:0,share:0},seen={record:[],share:[]}
    globalThis.fetch=async url=>{
      const kind=String(url).includes('/artifacts/')?'record':'share'
      calls[kind]++
      if(String(url).includes(hung))return new Promise(resolve=>{release=resolve})
      return {ok:true,status:200,json:async()=>({id:'p0',published:true,current_version:calls[kind]})}
    }
    let observedChange=false
    const note=kind=>value=>{seen[kind].push(value);observedChange=true}
    sync=createDetailSync({artifactId:'p0',storage:makeStorage(80,'fixture'),onRecord:note('record'),onShare:note('share'),onRecordError(){},onRecoveredShare(){}})
    sync.start();await flush()
    const context={sync,visibility:{isVisible:()=>true},startAdaptivePoll,poll:null}
    Object.defineProperty(context,'observedChange',{get:()=>observedChange,set:v=>{observedChange=v}})
    runInNewContext(callback,context);poll=context.poll
    for(let i=0;i<8;i++){mock.timers.tick(10000);await flush()}
    const blocked=hung==='artifacts/'?'record':'share',peer=blocked==='record'?'share':'record'
    assert.equal(calls[blocked],1,'pending path must remain deduplicated')
    assert.ok(calls[peer]>=5,`peer kept polling: ${calls[peer]}`)
    assert.ok(seen[peer].at(-1).current_version>=5)
    poll.stop();sync.dispose()
    const before=calls[peer]
    release({ok:true,status:200,json:async()=>({id:'p0'})});await flush()
    mock.timers.tick(60000);await flush()
    assert.equal(calls[peer],before,'dispose stops subsequent reads')
    assert.equal(seen[blocked].length,0,'late pending response cannot apply after disposal')
  }finally{poll?.stop();sync?.dispose();mock.timers.reset();globalThis.window=oldWindow;globalThis.fetch=oldFetch}
})
