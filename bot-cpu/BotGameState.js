'use strict';

/**
 * BotGameState — Mantém o estado do jogo visível ao bot.
 * Rastreia cartas, zonas e PIDs conforme mensagens são recebidas.
 */
function BotGameState() {
	// SIDs das zonas do bot (guest)
	this.myZones = {};
	this.enemyZones = {};

	// Mapeamento SID → PID (quando revelado)
	this.sidToPid = {};

	// Mapeamento SID → zona SID
	this.sidToZone = {};

	// SIDs dos jogadores
	this.mySid = 0;
	this.enemySid = 0;

	// Cartas conhecidas por zona
	this.myHandSids = [];
	this.myFieldSids = [null, null, null]; // 3 SIGNI zones
	this.myLrigSid = null;
	this.myEnerSids = [];
	this.myTrashSids = [];
	this.myLifeCount = 7;

	this.enemyFieldSids = [null, null, null];
	this.enemyLrigSid = null;
	this.enemyEnerSids = [];
	this.enemyHandCount = 0;
	this.enemyLifeCount = 7;

	this.initialized = false;
	this.turnCount = 0;
}

/**
 * Inicializa o estado a partir da mensagem INIT.
 */
BotGameState.prototype.initialize = function (msg) {
	this.mySid = msg.player;
	this.enemySid = msg.opponent;

	// Guardar SIDs das zonas
	this.myZones = msg.playerZones;
	this.enemyZones = msg.opponentZones;

	// Mapear cartas do LRIG deck (temos PIDs)
	if (msg.playerZones.lrigDeckCardInfos) {
		msg.playerZones.lrigDeckCards.forEach(function (sid, idx) {
			var info = msg.playerZones.lrigDeckCardInfos[idx];
			if (info && info.pid) {
				this.sidToPid[sid] = info.pid;
			}
		}.bind(this));
	}

	this.initialized = true;
};

/**
 * Atualiza estado quando uma carta é movida.
 */
BotGameState.prototype.handleMoveCard = function (msg) {
	var cardSid = msg.card;
	var zoneSid = msg.zone;
	var pid = msg.pid;

	// Registrar PID se disponível
	if (pid) {
		this.sidToPid[cardSid] = pid;
	}

	// Atualizar mapeamento de zona
	this.sidToZone[cardSid] = zoneSid;
};

/**
 * Atualiza estado quando cartas são reveladas.
 */
BotGameState.prototype.handleInformCards = function (msg) {
	if (msg.cards && msg.pids) {
		msg.cards.forEach(function (sid, idx) {
			if (msg.pids[idx]) {
				this.sidToPid[sid] = msg.pids[idx];
			}
		}.bind(this));
	}
};

/**
 * Atualiza estado quando uma carta é virada para cima.
 */
BotGameState.prototype.handleFaceupCard = function (msg) {
	if (msg.card && msg.pid) {
		this.sidToPid[msg.card] = msg.pid;
	}
};

/**
 * Retorna o PID de um SID, ou 0 se desconhecido.
 */
BotGameState.prototype.getPid = function (sid) {
	return this.sidToPid[sid] || 0;
};

/**
 * Retorna info da carta de um SID (usa CardInfo global).
 */
BotGameState.prototype.getCardInfo = function (sid) {
	var pid = this.getPid(sid);
	if (!pid || typeof CardInfo === 'undefined') return null;
	return CardInfo[pid] || null;
};

window.BotGameState = BotGameState;
