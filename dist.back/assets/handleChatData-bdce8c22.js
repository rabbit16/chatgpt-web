function c(a){const r=a.split(`

`),e=[],i=[],o=t=>typeof t=="object"&&t!==null&&typeof t.dateTime=="string"&&t.dateTime.trim()!=="";for(let t=0;t<r.length;t++){const s=r[t].trim();if(s!=="")try{const n=JSON.parse(s);if(o(n)){const{dateTime:l,...p}=n;e.push({dateTime:l,...p})}else i.push(s)}catch{i.push(s)}}return e}function h(a){return a==null?void 0:a.split("$_$").slice(0,-1).map(e=>JSON.parse(e))}export{h as a,c as h};
