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

	// Novas propriedades para IA inteligente
	this.isMyTurn = false;
	this.myLrigLevel = 0;
	this.myEnerCount = 0;

	// Rastreador de estado UP/DOWN (default true)
	this.sidToUp = {}; 
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
	if (msg.playerZones && msg.playerZones.lrigDeckCardInfos) {
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

	// Remover de zona antiga (se necessário para coleções)
	// Para simplificar, vamos reconstruir as coleções básicas que a IA usa
	this.sidToZone[cardSid] = zoneSid;

	// Atualizar propriedades específicas
	this.updateCollections();

	// Rastrear nível da LRIG
	if (zoneSid === this.myZones.lrig && pid) {
		var info = this.getCardInfo(cardSid);
		if (info && info.level !== undefined) {
			this.myLrigLevel = info.level;
		}
	}
};

/**
 * Reatribui as coleções de SIDs baseadas no mapeamento sidToZone.
 */
BotGameState.prototype.updateCollections = function () {
	this.myHandSids = [];
	this.myEnerSids = [];
	this.myFieldSids = [null, null, null];
	this.enemyFieldSids = [null, null, null];

	var self = this;
	for (var sid in this.sidToZone) {
		var z = this.sidToZone[sid];
		var nSid = parseInt(sid);

		if (z === this.myZones.hand) {
			this.myHandSids.push(nSid);
		} else if (z === this.myZones.ener) {
			this.myEnerSids.push(nSid);
		} else if (z === this.myZones.lrig) {
			this.myLrigSid = nSid;
		} else if (z === this.enemyZones.lrig) {
			this.enemyLrigSid = nSid;
		} else {
			// SIGNI Zones (normalmente array de 3 SIDs em myZones.signi)
			if (this.myZones.signi) {
				var myIdx = this.myZones.signi.indexOf(z);
				if (myIdx !== -1) this.myFieldSids[myIdx] = nSid;
			}
			if (this.enemyZones.signi) {
				var enIdx = this.enemyZones.signi.indexOf(z);
				if (enIdx !== -1) this.enemyFieldSids[enIdx] = nSid;
			}
		}
	}

	this.myEnerCount = this.myEnerSids.length;
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
 * Atualiza estado quando uma carta é colocada em pé (UP).
 */
BotGameState.prototype.handleUpCard = function (msg) {
	if (msg.card) {
		this.sidToUp[msg.card] = true;
	}
};

/**
 * Atualiza estado quando uma carta é virada (DOWN).
 */
BotGameState.prototype.handleDownCard = function (msg) {
	if (msg.card) {
		this.sidToUp[msg.card] = false;
	}
};

/**
 * Retorna se uma carta está em pé (UP).
 */
BotGameState.prototype.isCardUp = function (sid) {
	// Se não soubermos, assumimos que está UP (default do motor)
	return this.sidToUp[sid] !== false;
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

/**
 * Retorna se o bot deve poupar energia para o Grow da LRIG.
 * Regra: Se LRIG < lvl 4 e ener <= 1.
 */
BotGameState.prototype.shouldSaveEnerForGrow = function () {
	return this.myLrigLevel < 4 && this.myEnerCount <= 1;
};

/**
 * Retorna se a zona do bot no índice especificado (0, 1, 2) está vazia.
 */
BotGameState.prototype.isMyZoneEmpty = function (zoneIdx) {
	return !this.myFieldSids[zoneIdx];
};

/**
 * Retorna se a zona do oponente no índice especificado (0, 1, 2) está vazia.
 */
BotGameState.prototype.isEnemyZoneEmpty = function (zoneIdx) {
	return !this.enemyFieldSids[zoneIdx];
};

/**
 * Retorna o SID do SIGNI inimigo que está "em frente" à zona do bot zoneIdx.
 */
BotGameState.prototype.getEnemySigniInZone = function (zoneIdx) {
	return this.enemyFieldSids[zoneIdx] || null;
};

/**
 * Retorna qual zona (0-2) contém uma determinada carta (SID) no campo do oponente.
 * Retorna -1 se não estiver no campo.
 */
BotGameState.prototype.getEnemyZoneIdx = function (sid) {
	return this.enemyFieldSids.indexOf(sid);
};

/**
 * Atualiza contagem de vida quando uma vida é perdida.
 */
BotGameState.prototype.handleCrash = function (msg) {
	if (msg.player === this.mySid) {
		this.myLifeCount = Math.max(0, this.myLifeCount - msg.count);
	} else {
		this.enemyLifeCount = Math.max(0, this.enemyLifeCount - msg.count);
	}
};

/**
 * Atualiza contagem de vida via mensagem explícita.
 */
BotGameState.prototype.handleLifeCount = function (msg) {
	if (msg.player === this.mySid) {
		this.myLifeCount = msg.count;
	} else {
		this.enemyLifeCount = msg.count;
	}
};

/**
 * Retorna se estamos em um timing defensivo (turno do oponente).
 */
BotGameState.prototype.isDefensiveTiming = function () {
	return !this.isMyTurn;
};

window.BotGameState = BotGameState;
