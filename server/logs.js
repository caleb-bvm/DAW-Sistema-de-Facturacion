import { query } from './db.js';
import { integer, textValue, requireValue, validDate } from './validation.js';
import { localClock } from './access.js';
import { config } from './config.js';

const eventsSql = `WITH eventos AS (
 SELECT a.id,'operacion' categoria,a.fecha,v.usuario,v.nombre,a.accion,a.referencia,
 JSON_VALUE(a.detalles,'$.ip') ip,'completado' estado,a.detalles
 FROM auditoria a JOIN vendedores v ON v.id=a.vendedor_id
 UNION ALL
 SELECT i.id,'acceso',i.fecha,i.usuario,v.nombre,i.motivo,CONVERT(nvarchar(80),i.vendedor_id),i.ip,'rechazado',
 (SELECT i.pais,i.fuente,i.motivo FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)
 FROM intentos_acceso i LEFT JOIN vendedores v ON v.id=i.vendedor_id
 UNION ALL
 SELECT c.id,'correo',c.updated_at,v.usuario,v.nombre,c.tipo,CONVERT(nvarchar(80),c.factura_id),NULL,c.estado,
 (SELECT c.destinatario,c.asunto,c.intentos,c.error,c.created_at,c.proximo_intento,c.intento_id FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)
 FROM correos c LEFT JOIN facturas f ON f.id=c.factura_id LEFT JOIN vendedores v ON v.id=f.vendedor_id
)`;

export function logFilters(params) {
  const category = textValue(params,'categoria',20,false);
  requireValue(['','operacion','acceso','correo'].includes(category),'Categoría inválida.');
  const from = textValue(params,'desde',10,false), to = textValue(params,'hasta',10,false);
  requireValue((!from || validDate(from)) && (!to || validDate(to)) && (!from || !to || from<=to),'Revisa el rango de fechas.');
  const state = textValue(params,'estado',20,false);
  requireValue(['','completado','rechazado','pendiente','procesando','aceptado','fallido'].includes(state),'Estado inválido.');
  return {category,from,to,state,search:textValue(params,'buscar',120,false),page:integer(params.pagina??1,1,1000000),size:integer(params.limite??25,1,100)};
}
export async function listLogs(params) {
  const filter = logFilters(params), clauses=[], values=[];
  if(filter.category){clauses.push('categoria=?');values.push(filter.category);}
  if(filter.state){clauses.push('estado=?');values.push(filter.state);}
  if(filter.from){clauses.push('fecha>=CONVERT(datetime2,?)');values.push(filter.from);}
  if(filter.to){clauses.push('fecha<DATEADD(DAY,1,CONVERT(datetime2,?))');values.push(filter.to);}
  if(filter.search){clauses.push("CHARINDEX(?,CONCAT(usuario,' ',nombre,' ',accion,' ',referencia,' ',ip,' ',detalles))>0");values.push(filter.search);}
  const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
  const [count]=await query(`${eventsSql} SELECT COUNT(*) total FROM eventos${where}`,values);
  const total=Number(count.total),pages=Math.max(1,Math.ceil(total/filter.size)),page=Math.min(filter.page,pages);
  const rows=await query(`${eventsSql} SELECT * FROM eventos${where} ORDER BY fecha DESC,categoria,id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,[...values,(page-1)*filter.size,filter.size]);
  return {total,pagina:page,paginas:pages,zona_horaria:config.timezone,eventos:rows.map(row=>{
    const local=localClock(new Date(row.fecha.replace(' ','T')+'Z'));
    return {...row,fecha_utc:row.fecha+' UTC',fecha_local:`${local.date} ${local.time}`,detalles:row.detalles?JSON.parse(row.detalles):null};
  })};
}
