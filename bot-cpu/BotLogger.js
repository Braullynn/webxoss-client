'use strict';

/**
 * BotLogger — Sistema de logs coloridos para debug do bot CPU.
 * Todos os logs aparecem no console do navegador com cores distintas.
 */
function BotLogger(prefix) {
	this.prefix = prefix || '[BOT]';
	this.enabled = true;
}

BotLogger.prototype.log = function (msg, type) {
	if (!this.enabled) return;
	var colors = {
		'info':     'color: #2196F3; font-weight: bold',
		'decision': 'color: #4CAF50; font-weight: bold',
		'action':   'color: #FF9800; font-weight: bold',
		'score':    'color: #9C27B0; font-weight: bold',
		'error':    'color: #F44336; font-weight: bold',
		'phase':    'color: #00BCD4; font-weight: bold; font-size: 14px',
		'state':    'color: #607D8B; font-weight: normal',
		'warn':     'color: #FF5722; font-weight: bold',
		'success':  'color: #8BC34A; font-weight: bold'
	};
	var style = colors[type] || 'color: #9E9E9E';
	console.log('%c' + this.prefix + ' ' + msg, style);
};

BotLogger.prototype.phase = function (phaseName) {
	this.log('═══════════════════════════════════', 'phase');
	this.log('  ' + phaseName, 'phase');
	this.log('═══════════════════════════════════', 'phase');
};

BotLogger.prototype.decision = function (label, options, chosen, score) {
	this.log('Decisão para: ' + label, 'info');
	if (options !== undefined) {
		this.log('  Opções disponíveis: ' + options, 'state');
	}
	if (chosen !== undefined) {
		this.log('  ★ Escolha: ' + chosen, 'decision');
	}
	if (score !== undefined) {
		this.log('  Nota: ' + score, 'score');
	}
};

BotLogger.prototype.scoring = function (actionName, score) {
	this.log('  ├─ ' + actionName + ' → Nota: ' + score, 'score');
};

BotLogger.prototype.bestAction = function (actionName, score) {
	this.log('  └─ ★ Melhor: ' + actionName + ' (Nota: ' + score + ')', 'decision');
};

BotLogger.prototype.error = function (msg) {
	this.log('✖ ERRO: ' + msg, 'error');
};

BotLogger.prototype.warn = function (msg) {
	this.log('⚠ ' + msg, 'warn');
};

BotLogger.prototype.success = function (msg) {
	this.log('✔ ' + msg, 'success');
};

window.BotLogger = BotLogger;
