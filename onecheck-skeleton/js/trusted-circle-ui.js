// SafePay Circle interface
document.addEventListener("DOMContentLoaded",()=>{
const root=document.getElementById("exclusion-root");
if(!root)return;
const heading=document.createElement("h2");
heading.textContent="My SafePay Circle";
root.appendChild(heading);
const items=ExclusionLog.list();
if(items.length===0){const empty=document.createElement("p");empty.textContent="No trusted recipients yet.";root.appendChild(empty);}
items.forEach(p=>{const card=document.createElement("div");card.className="card";const info=document.createElement("p");info.textContent=p.name+" - "+p.bank+" - "+p.number;card.appendChild(info);const status=document.createElement("p");status.textContent=ExclusionLog.isTrusted(p)?"Active":"Pending - 24-hour cooling-off";card.appendChild(status);const btn=document.createElement("button");btn.className="btn btn-danger";btn.textContent="Remove";btn.onclick=()=>{if(confirm("Remove "+p.name+" from SafePay Circle?")){ExclusionLog.remove(p.number);location.reload();}};card.appendChild(btn);
root.appendChild(card);});
const heading2=document.createElement("h2");heading2.textContent="Suggested Recipients";root.appendChild(heading2);
ExclusionLog.suggestions().forEach(p=>{const card=document.createElement("div");card.className="card";const info=document.createElement("p");info.textContent=p.name+" - "+p.bank+" - "+p.number;card.appendChild(info);const history=document.createElement("p");history.textContent="Previous transfers: "+p.pastTransfers;card.appendChild(history);const btn=document.createElement("button");btn.className="btn btn-primary";btn.textContent="Review and Add";btn.onclick=()=>{const message="Add "+p.name+" to SafePay Circle?\nBank: "+p.bank+"\nAccount: "+p.number+"\nConfirm only after checking the recipient details. A 24-hour cooling-off period applies.";if(window.confirm(message)){ExclusionLog.add(p);location.reload();}};card.appendChild(btn);
root.appendChild(card);});
});
