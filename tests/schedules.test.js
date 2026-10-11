import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSummary, scheduleView } from '../assets/js/horarios.js';
import { validateSchedules } from '../server/admin.js';

test('horario partido suma tiempo efectivo, excluyendo el almuerzo', () => {
  const rows = Array.from({length:5},(_,i) => [{dia:i+1,inicio:'08:00',fin:'12:00'}, {dia:i+1,inicio:'13:00',fin:'17:00'}]).flat();
  assert.deepEqual(scheduleSummary(rows), {errors:{},total:40*60,days:5});
  assert.equal(validateSchedules(rows).length,10);
});
test('acepta sesiones contiguas y distingue los días al validar', () => {
  const rows=[{dia:1,inicio:'08:00',fin:'12:00'},{dia:1,inicio:'12:00',fin:'17:00'},{dia:2,inicio:'08:00',fin:'12:00'}];
  assert.deepEqual(scheduleSummary(rows).errors,{}); assert.equal(validateSchedules(rows).length,3);
});
test('señala día con horas incompletas, invertidas o superpuestas', () => {
  for (const rows of [
    [{dia:2,inicio:'',fin:'17:00'}],
    [{dia:2,inicio:'22:00',fin:'06:00'}],
    [{dia:2,inicio:'08:00',fin:'12:00'},{dia:2,inicio:'11:00',fin:'13:00'}]
  ]) { assert.ok(scheduleSummary(rows).errors[2]); assert.throws(()=>validateSchedules(rows)); }
});
test('semana vacía representa cero días con acceso y catálogo vacío tiene una salida útil', () => {
  assert.deepEqual(scheduleSummary([]), {errors:{},total:0,days:0});
  assert.match(scheduleView([]),/No hay facturadores/); assert.doesNotMatch(scheduleView([]),/<form/);
});
