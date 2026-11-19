// SafePay Circle interface
document.addEventListener("DOMContentLoaded",()=>{
const root=document.getElementById("exclusion-root");
if(!root)return;
const heading=document.createElement("h2");
heading.textContent="My SafePay Circle";
root.appendChild(heading);
const settings=document.createElement('div');
settings.className='notice';
const settingsTitle=document.createElement('h3');
settingsTitle.textContent='Verification Settings';
settings.appendChild(settingsTitle);
const settingsText=document.createElement('p');
const method=ExclusionLog.getVerificationMethod();
settingsText.textContent='Current default: '+(method==='trusted_person' ? 'Trusted Person Approval' : 'Bank-Verified Self-Approval');
settings.appendChild(settingsText);
const methodLabel=document.createElement('label');
methodLabel.textContent='Verification method:';
settings.appendChild(methodLabel);
const methodSelect=document.createElement('select');
methodSelect.className='form-control';
const bankOption=document.createElement('option');
bankOption.value='bank';
bankOption.textContent='Bank-Verified Self-Approval';
methodSelect.appendChild(bankOption);
const personOption=document.createElement('option');
personOption.value='trusted_person';
personOption.textContent='Trusted Person Approval';
methodSelect.appendChild(personOption);
methodSelect.value=method;
settings.appendChild(methodSelect);
const changeBtn=document.createElement('button');
changeBtn.className='btn btn-secondary';
changeBtn.textContent='Save Verification Method';
changeBtn.style.marginTop='12px';
settings.appendChild(changeBtn);
const changeMessage=document.createElement('p');
settings.appendChild(changeMessage);
function syncPendingMethod(next){
  const entries=ExclusionLog.list();
  entries.forEach(function(entry){
    if(entry.status!=='pending_approval' || (entry.verificationMethod||'bank')===next)return;
    entry.verificationMethod=next;
    entry.addedAt=Date.now();
    entry.activeAt=null;
    delete entry.approvedAt;
  });
  Store.set('exclusionLog',entries);
}
changeBtn.onclick=function(){
  const selected=methodSelect.value;
  const current=ExclusionLog.getVerificationMethod();
  if(selected===current){changeMessage.textContent='This is already your current method.';return;}
  if(selected==='trusted_person'){
    const person=Store.get('trustedPerson',null);
    if(!person || !person.name || !person.contact){
      changeMessage.textContent='Please register a Trusted Person before choosing this method.';
      return;
    }
    ExclusionLog.setVerificationMethod('trusted_person');
    syncPendingMethod('trusted_person');
    Store.remove('safePayPendingMethod');
    location.reload();
    return;
  }
  const confirmed=window.confirm('DEMO ONLY: Simulate successful bank-app authentication to switch back to Bank-Verified Self-Approval? No real authentication will occur.');
  if(!confirmed)return;
  ExclusionLog.setVerificationMethod('bank');
  syncPendingMethod('bank');
  Store.remove('safePayPendingMethod');
  location.reload();
};
root.appendChild(settings);
function updateCircleStatus(entry,element){
  if(ExclusionLog.isTrusted(entry)){
    element.textContent='Active - Fast lane enabled';
  }else if(entry.status==='cooling_off' && Number.isFinite(entry.activeAt)){
    const remaining=Math.max(0,entry.activeAt-Date.now());
    const totalMinutes=Math.ceil(remaining/60000);
    const hours=Math.floor(totalMinutes/60);
    const minutes=totalMinutes%60;
    element.textContent='Cooling-off: '+hours+'h '+minutes+'m remaining - Fast lane locked';
  }else if(entry.status==='pending_approval'){
    element.textContent=entry.verificationMethod==='trusted_person' ? 'Pending Trusted Person Approval' : 'Pending Bank Verification';
  }else{
    element.textContent='Inactive - approval required';
  }
}
const items=ExclusionLog.list();
if(items.length===0){const empty=document.createElement("p");empty.textContent="No trusted recipients yet.";root.appendChild(empty);}
items.forEach(p=>{const card=document.createElement("div");card.className="card";const info=document.createElement("p");info.textContent=p.name+" - "+p.bank+" - "+p.number;card.appendChild(info);const status=document.createElement("p");status.textContent=ExclusionLog.isTrusted(p) ? "Active - Fast lane enabled" : p.status === "pending_approval" ? (p.verificationMethod==='trusted_person' ? 'Pending Trusted Person approval' : 'Pending Bank Verification') : p.status === "cooling_off" ? "Approved - 24-hour cooling-off" : "Inactive - approval required";updateCircleStatus(p,status);setInterval(function(){updateCircleStatus(p,status);},60000);card.appendChild(status);
if(p.status==='pending_approval' && (p.verificationMethod || 'bank')==='bank'){
  const demoBtn=document.createElement('button');
  demoBtn.className='btn btn-secondary';
  demoBtn.textContent='Demo: Simulate Bank Approval';
  demoBtn.style.marginLeft='8px';
  demoBtn.onclick=function(){
    if(!window.confirm('DEMO ONLY: Simulate successful bank authentication for '+p.name+'? No real identity verification will occur.'))return;
    const ok=ExclusionLog.approve(p.number,{approved:true,method:'bank'});
    if(ok){location.reload();}else{window.alert('Demo approval could not be applied.');}
  };
  card.appendChild(demoBtn);
}
if(p.status==='pending_approval' && p.verificationMethod==='trusted_person'){
  const demoPersonBtn=document.createElement('button');
  demoPersonBtn.className='btn btn-secondary';
  demoPersonBtn.textContent='Demo: Simulate Trusted Person Approval';
  demoPersonBtn.onclick=function(){
    if(!window.confirm('DEMO ONLY: Simulate approval by the registered Trusted Person for '+p.name+'? No real approval request will be sent.'))return;
    const person=Store.get('trustedPerson',null);
    if(!person || !person.name || !person.contact){window.alert('Register a Trusted Person first.');return;}
    const ok=ExclusionLog.approve(p.number,{approved:true,method:'trusted_person'});
    if(ok){location.reload();}else{window.alert('Demo approval could not be applied.');}
  };
  card.appendChild(demoPersonBtn);
}
if(p.status==='cooling_off'){
  const advanceBtn=document.createElement('button');
  advanceBtn.className='btn btn-secondary';
  advanceBtn.textContent='Demo: Advance 24 Hours';
  advanceBtn.onclick=function(){
    if(!window.confirm('DEMO ONLY: Simulate the 24-hour cooling-off period ending for '+p.name+'?'))return;
    const entries=ExclusionLog.list();
    const entry=entries.find(function(item){return item.number===p.number && item.bank===p.bank && item.status==='cooling_off';});
    if(!entry || !Number.isFinite(entry.activeAt))return;
    entry.activeAt=Date.now()-1000;
    Store.set('exclusionLog',entries);
    location.reload();
  };
  card.appendChild(advanceBtn);
}
const btn=document.createElement("button");btn.className="btn btn-danger";btn.textContent="Remove";btn.onclick=()=>{if(confirm("Remove "+p.name+" from SafePay Circle?")){ExclusionLog.remove(p.number);location.reload();}};card.appendChild(btn);
root.appendChild(card);});
const heading2=document.createElement("h2");heading2.textContent="Suggested Recipients";root.appendChild(heading2);
ExclusionLog.suggestions().forEach(p=>{const card=document.createElement("div");card.className="card";const info=document.createElement("p");info.textContent=p.name+" - "+p.bank+" - "+p.number;card.appendChild(info);const history=document.createElement("p");history.textContent="Previous transfers: "+p.pastTransfers;card.appendChild(history);const btn=document.createElement("button");btn.className="btn btn-primary";btn.textContent="Review and Add";btn.onclick=()=>{const message="Add "+p.name+" to SafePay Circle?\nBank: "+p.bank+"\nAccount: "+p.number+"\nConfirm only after checking the recipient details. A 24-hour cooling-off period applies.";if(window.confirm(message)){ExclusionLog.add(p);location.reload();}};card.appendChild(btn);
root.appendChild(card);});
});
