/** Datas civis no fuso de São Paulo. */
const TZ="America/Sao_Paulo";
export function localISODate(date:Date=new Date()):string {
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value??"";
 return part("year")+"-"+part("month")+"-"+part("day");
}
export function isValidISODate(value:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [y,m,d]=value.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
export function formatDateBR(value:string):string {if(!isValidISODate(value))return value;const [y,m,d]=value.split("-");return d+"/"+m+"/"+y;}
export function addDaysISO(value:string,days:number):string {
 if(!isValidISODate(value)||!Number.isInteger(days))throw new Error("Data ou dias inválidos.");
 const [y,m,d]=value.split("-").map(Number);return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
}
export function isOverdue(value:string,today=localISODate()):boolean{return isValidISODate(value)&&value<today;}
