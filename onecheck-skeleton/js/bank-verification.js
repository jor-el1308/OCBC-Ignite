document.addEventListener('DOMContentLoaded',function(){
  const number=new URLSearchParams(location.search).get('number');
  const entry=ExclusionLog.list().find(function(p){return p.number===number;});
  const el=document.getElementById('recipient-details');
  if(!entry || entry.status!=='pending_approval' || (entry.verificationMethod || 'bank')!=='bank'){
    el.textContent='No pending bank-verification request found.';
    return;
  }
  el.textContent='Recipient: '+entry.name+' | Bank: '+entry.bank+' | Account: '+entry.number;
});