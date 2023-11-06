function l(i){const s=i.split(`

`),n=[],o=[],a=t=>typeof t=="object"&&t!==null&&typeof t.dateTime=="string"&&t.dateTime.trim()!=="";for(let t=0;t<s.length;t++){const e=s[t].trim();if(e!=="")try{const r=JSON.parse(e);if(a(r)){const{dateTime:c,...p}=r;n.push({dateTime:c,...p})}else o.push(e)}catch{o.push(e)}}return n}export{l as h};
