'use strict';

/**
 * BotController — Controlador genérico do bot CPU.
 * Usa Strategy Pattern: NÃO decide o que jogar.
 * Responsável por ler estado, executar ações e delegar decisões ao "Cérebro do Deck".
 */
function BotController(strategy, logger) {
	this.strategy = strategy;
	this.logger = logger || new BotLogger();
	this.gameState = new BotGameState();
	this.actionDelay = { min: 800, max: 1800 };
	this.botSocket = null; // Será setado pelo bot-server.js
	this._responseId = 1; // Começa em 1! O server IO igora id=0 (lastId inicia em 0)
	this._pendingSelectLabels = [];
	this._gameOver = false;
}

/**
 * Gera um delay aleatório humanizado.
 */
BotController.prototype.randomDelay = function () {
	return Math.floor(Math.random() * (this.actionDelay.max - this.actionDelay.min)) + this.actionDelay.min;
};

/**
 * Envia resposta ao servidor (simula o jogador respondendo).
 * O botSocket._doEmit simula uma msg vinda do "cliente bot" para o servidor.
 */
BotController.prototype.respond = function (label, input) {
	if (this._gameOver) return;
	if (input === undefined) input = [];
	var responseData = {
		id: this._responseId++,
		data: {
			label: label,
			input: input
		}
	};
	this.logger.log('Respondendo: ' + label + ' → [' + input.toString() + ']', 'action');
	if (this.botSocket) {
		this.botSocket._doEmit('gameMessage', responseData);
	}
};

/**
 * Chamado quando o servidor envia uma mensagem de jogo ao bot.
 * msg = { buffer: [{ id, data: [msgObj1, msgObj2, ...] }] }
 */
BotController.prototype.handleGameMessage = function (msg) {
	if (this._gameOver) return;
	var self = this;

	if (!msg || !msg.buffer) {
		this.logger.warn('Mensagem inválida recebida');
		return;
	}

	msg.buffer.forEach(function (buf) {
		var data = buf.data;
		if (!data || !data.length) return;

		// Coletar todas as mensagens SELECT deste batch
		var selectMsgs = [];
		var needsOkResponse = false;
		var okLabel = '';
		var payEnerMsg = null;
		var selectNumberMsg = null;
		var selectTextMsg = null;
		var selectCardIdMsg = null;
		var confirmMsg = null;

		data.forEach(function (msgObj) {
			self.processMessage(msgObj);

			switch (msgObj.type) {
				case 'SELECT':
					selectMsgs.push(msgObj.content);
					break;
				case 'SHOW_CARDS':
				case 'SHOW_CARDS_BY_ID':
				case 'SHOW_COLORS':
				case 'SHOW_TYPES':
				case 'SHOW_EFFECTS':
				case 'SHOW_TEXT':
					needsOkResponse = true;
					okLabel = 'OK';
					break;
				case 'PAY_ENER':
					payEnerMsg = msgObj.content;
					break;
				case 'SELECT_NUMBER':
					selectNumberMsg = msgObj.content;
					break;
				case 'SELECT_TEXT':
					selectTextMsg = msgObj.content;
					break;
				case 'SELECT_CARD_ID':
					selectCardIdMsg = msgObj.content;
					break;
				case 'CONFIRM':
					confirmMsg = msgObj.content;
					break;
				case 'WIN':
					self._gameOver = true;
					self.logger.success('Bot VENCEU!');
					break;
				case 'LOSE':
					self._gameOver = true;
					self.logger.error('Bot PERDEU!');
					break;
			}
		});

		if (self._gameOver) return;

		// Responder com delay humanizado
		var delay = self.randomDelay();

		if (selectMsgs.length > 0) {
			setTimeout(function () {
				self.handleSelectMessages(selectMsgs);
			}, delay);
		} else if (payEnerMsg) {
			setTimeout(function () {
				self.handlePayEner(payEnerMsg);
			}, delay);
		} else if (selectNumberMsg) {
			setTimeout(function () {
				self.handleSelectNumber(selectNumberMsg);
			}, delay);
		} else if (selectTextMsg) {
			setTimeout(function () {
				self.handleSelectText(selectTextMsg);
			}, delay);
		} else if (selectCardIdMsg) {
			setTimeout(function () {
				self.handleSelectCardId(selectCardIdMsg);
			}, delay);
		} else if (confirmMsg) {
			setTimeout(function () {
				self.handleConfirm(confirmMsg);
			}, delay);
		} else if (needsOkResponse) {
			setTimeout(function () {
				self.respond(okLabel);
			}, Math.min(delay, 500));
		}
	});
};

/**
 * Processa uma mensagem individual para atualizar o estado.
 */
BotController.prototype.processMessage = function (msgObj) {
	switch (msgObj.type) {
		case 'INIT':
			this.gameState.initialize(msgObj.content);
			this.logger.success('Jogo iniciado! Bot inicializado.');
			break;
		case 'MOVE_CARD':
			this.gameState.handleMoveCard(msgObj.content);
			break;
		case 'INFORM_CARDS':
			this.gameState.handleInformCards(msgObj.content);
			break;
		case 'FACEUP_CARD':
			this.gameState.handleFaceupCard(msgObj.content);
			break;
		case 'SET_COLOR':
			this.logger.log('Cores definidas', 'state');
			break;
	}
};

/**
 * Lida com múltiplas mensagens SELECT simultâneas.
 * O bot avalia cada opção e escolhe a melhor ação.
 */
BotController.prototype.handleSelectMessages = function (selectMsgs) {
	if (this._gameOver) return;
	var self = this;

	this.logger.log('Recebidos ' + selectMsgs.length + ' SELECT(s): ' +
		selectMsgs.map(function (m) { return m.label; }).join(', '), 'info');

	// Detecção de Turno: Certos labels garantem que é o nosso turno ou o do oponente
	selectMsgs.forEach(function (msg) {
		var l = msg.label;
		// Se estamos fazendo ações proativas, é nosso turno
		if (l === 'GROW' || l === 'END_ENER_PHASE' || l === 'SUMMON_SIGNI' || l === 'SIGNI_ATTACK' || l === 'LRIG_ATTACK' || l === 'CHARGE') {
			self.gameState.isMyTurn = true;
		}
		// Se estamos apenas reagindo a ataques, é turno do oponente
		if (l === 'GUARD' || l === 'PROTECT') {
			self.gameState.isMyTurn = false;
		}
	});

	// Avaliar cada SELECT usando a strategy
	var bestAction = this.strategy.evaluateSelects(selectMsgs, this.gameState);

	if (bestAction) {
		this.logger.decision(bestAction.label, bestAction.optionCount, bestAction.selectedIndexes, bestAction.score);
		this.respond(bestAction.label, bestAction.selectedIndexes);
	} else {
		// Fallback: responder ao primeiro SELECT com seleção mínima
		var firstMsg = selectMsgs[0];
		var fallbackSelection = [];
		if (firstMsg.min > 0 && firstMsg.options && firstMsg.options.length > 0) {
			for (var i = 0; i < firstMsg.min && i < firstMsg.options.length; i++) {
				fallbackSelection.push(i);
			}
		}
		this.logger.warn('Fallback: ' + firstMsg.label + ' → [' + fallbackSelection + ']');
		this.respond(firstMsg.label, fallbackSelection);
	}
};

/**
 * Lida com PAY_ENER — o bot paga ener automaticamente.
 */
BotController.prototype.handlePayEner = function (msg) {
	if (this._gameOver) return;
	this.logger.log('Pagando ener...', 'action');

	if (msg.cancelable) {
		// Se pode cancelar, delega à strategy
		var shouldPay = this.strategy.shouldPayEner(msg, this.gameState);
		if (!shouldPay) {
			this.respond('PAY_ENER', null);
			return;
		}
	}

	// Escolher os ener necessários automaticamente (pegar os primeiros na lista)
	var selection = this.strategy.selectEnerPayment(msg, this.gameState);
	this.respond('PAY_ENER', selection);
};

/**
 * Lida com SELECT_NUMBER.
 */
BotController.prototype.handleSelectNumber = function (msg) {
	if (this._gameOver) return;
	var num = this.strategy.selectNumber(msg, this.gameState);
	this.logger.log('SELECT_NUMBER(' + msg.label + '): ' + num, 'action');
	this.respond(msg.label, num);
};

/**
 * Lida com SELECT_TEXT.
 */
BotController.prototype.handleSelectText = function (msg) {
	if (this._gameOver) return;
	var idx = this.strategy.selectText(msg, this.gameState);
	this.logger.log('SELECT_TEXT(' + msg.label + '): index ' + idx, 'action');
	this.respond(msg.label, idx);
};

/**
 * Lida com SELECT_CARD_ID.
 */
BotController.prototype.handleSelectCardId = function (msg) {
	if (this._gameOver) return;
	// Fallback: retorna 0
	this.logger.warn('SELECT_CARD_ID não implementado, retornando 0');
	this.respond(msg.label, 0);
};

/**
 * Lida com CONFIRM.
 */
BotController.prototype.handleConfirm = function (msg) {
	if (this._gameOver) return;
	var answer = this.strategy.handleConfirm(msg, this.gameState);
	this.logger.log('CONFIRM: ' + answer, 'action');
	this.respond('OK', answer);
};

window.BotController = BotController;
