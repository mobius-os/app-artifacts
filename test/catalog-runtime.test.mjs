import assert from 'node:assert/strict'
import test from 'node:test'
import {makeStorage} from '../storage.js'
import {folderSignature,readFolder} from '../ui/catalogSnapshot.js'

function runtimeFixture(count,prefix='artifacts/') {
  const cached=new Map(Array.from({length:count},(_,i)=>[`${prefix}p${i}.json`,{id:`p${i}`,project_id:`p${i}`,published:false}]))
  const server=new Map(cached),queued=new Map()
  let online=false,stamp='initial',reads=0
  globalThis.window={mobius:{storage:{
    async list(_prefix,options={}) {return [...cached].map(([path,value])=>({path,name:path.slice(prefix.length),...(server.has(path)?{modified_at:stamp,size:100}:{}),...(options.includeContent?{content:JSON.stringify(queued.get(path)|| (online?server.get(path):value))}:{})}))},
    async set(path,value){queued.set(path,value);cached.set(path,value);return {queued:true}},
    async get(path){return queued.get(path)||cached.get(path)||null},
  }}}
  globalThis.fetch=async url=>{
    reads++
    if(!online)throw Error('Offline')
    const path=String(url).split('/80/')[1]
    return {ok:true,status:200,json:async()=>server.get(path)}
  }
  return {storage:makeStorage(80,'fixture'),queued,server,cached,reads:()=>reads,online(){online=true},bump(){stamp="changed"},drain(){for(const [p,v] of queued)server.set(p,v);queued.clear();stamp='drained'}}
}
for(let count=1;count<=4;count++)test(`fresh mount retains a complete offline catalog of ${count} cached bodies`,async()=>{
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch
  try {const f=runtimeFixture(count);assert.equal((await readFolder(f.storage,'artifacts/')).length,count)}
  finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
})
test('unchanged share stamps preserve queued publish and stop values through reconnect/drain and fresh mount',async()=>{
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch
  try {
    const f=runtimeFixture(1,'shares/');f.online()
    assert.equal((await readFolder(f.storage,'shares/'))[0].published,false)
    const before=folderSignature(f.storage,'shares/')
    await f.storage.setJSON('shares/p0.json',{project_id:'p0',published:true})
    assert.equal((await readFolder(f.storage,'shares/'))[0].published,true)
    assert.notEqual(folderSignature(f.storage,'shares/'),before)
    const mounted=makeStorage(80,'fixture')
    assert.equal((await readFolder(mounted,'shares/'))[0].published,true,'raw server false must not overwrite queued true')
    f.drain()
    assert.equal((await readFolder(f.storage,'shares/'))[0].published,true)
    await f.storage.setJSON('shares/p0.json',{project_id:'p0',published:false})
    assert.equal((await readFolder(f.storage,'shares/'))[0].published,false)
    f.drain()
    assert.equal((await readFolder(f.storage,'shares/'))[0].published,false)
  }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
})

test('online artifact polls remain incremental and read agent changes authoritatively',async()=>{
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch
  try {
    const f=runtimeFixture(1);f.online()
    await readFolder(f.storage,'artifacts/')
    await readFolder(f.storage,'artifacts/')
    assert.equal(f.reads(),0,'unchanged polls only list metadata')
    f.server.set('artifacts/p0.json',{id:'p0',current_version:2});f.bump()
    assert.equal((await readFolder(f.storage,'artifacts/'))[0].current_version,2)
    assert.equal(f.reads(),1)
    await readFolder(f.storage,'artifacts/')
    assert.equal(f.reads(),1,'unchanged fresh revision is not fetched again')
  }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
})
test('known members without readable bodies reject instead of reporting an empty catalog',async()=>{
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch
  try {
    globalThis.window={mobius:{storage:{list:async()=>[{path:'artifacts/p0.json',modified_at:'initial'}],get:async()=>null}}}
    globalThis.fetch=async()=>{throw Error('Offline')}
    await assert.rejects(readFolder(makeStorage(80,'fixture'),'artifacts/'),/known catalog records/)
  }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
})

test('a newly queued share without a server stamp is never replaced by server absence',async()=>{
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch
  try {
    const f=runtimeFixture(0,'shares/');f.online()
    assert.deepEqual(await readFolder(f.storage,'shares/'),[])
    await f.storage.setJSON('shares/p0.json',{project_id:'p0',published:true})
    assert.equal((await readFolder(f.storage,'shares/'))[0].published,true)
    assert.equal(f.reads(),0,'effective inline body owns the unstamped queued row')
    f.drain()
    assert.equal((await readFolder(f.storage,'shares/'))[0].published,true)
  }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
})
