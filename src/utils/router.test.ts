import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToScreen, screenToPath } from './router';

test('router maps paths to screens correctly', () => {
  // Public Landing paths
  assert.equal(pathToScreen('/'), 'landing');
  assert.equal(pathToScreen('/landing'), 'landing');
  assert.equal(pathToScreen('/home/'), 'landing');

  // Login / Auth paths
  assert.equal(pathToScreen('/login'), 'login');
  assert.equal(pathToScreen('/entrar/'), 'login');
  assert.equal(pathToScreen('/auth'), 'login');

  // Admin Backoffice paths
  assert.equal(pathToScreen('/admin'), 'admin');
  assert.equal(pathToScreen('/admin/overview'), 'admin');

  // Customer Finance App paths
  assert.equal(pathToScreen('/app'), 'dashboard-inicio');
  assert.equal(pathToScreen('/app/'), 'dashboard-inicio');
  assert.equal(pathToScreen('/app/extrato'), 'transacoes');
  assert.equal(pathToScreen('/app/transacoes'), 'transacoes');
  assert.equal(pathToScreen('/app/orcamentos'), 'orcamentos');
  assert.equal(pathToScreen('/app/relatorios'), 'relatorios');
  assert.equal(pathToScreen('/app/perfil'), 'perfil');

  // Unknown paths default to landing
  assert.equal(pathToScreen('/unknown-slug'), 'landing');
});

test('router maps screens to clean browser paths correctly', () => {
  assert.equal(screenToPath('landing'), '/');
  assert.equal(screenToPath('login'), '/login');
  assert.equal(screenToPath('admin'), '/admin');
  assert.equal(screenToPath('dashboard-inicio'), '/app');
  assert.equal(screenToPath('transacoes'), '/app/extrato');
  assert.equal(screenToPath('orcamentos'), '/app/orcamentos');
  assert.equal(screenToPath('relatorios'), '/app/relatorios');
  assert.equal(screenToPath('perfil'), '/app/perfil');
});
