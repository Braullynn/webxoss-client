'use strict';

/**
 * bot-server.js — Inicializador do servidor local VS CPU.
 * 
 * Melhora na Sincronização: Comanda os objetos Client/Room diretamente no
 * lado do servidor para garantir que a sala esteja correta antes do início.
 */

(function () {

// ==== Função de log no painel ====
var logEl = null;
function serverLog(text) {
	if (!logEl) logEl = document.getElementById('log');
	if (logEl) {
		logEl.textContent += text + '\n';
	}
	console.log('[VS-CPU-SERVER] ' + text);
}

// ==== Ler parâmetros da URL ====
function getParam(name) {
	var url = new URL(window.location.href);
	return url.searchParams.get(name) || '';
}

// ==== Criar o mock de io (igual ao testHelper.js) ====
var io = {
	on: function (name, handler) {
		io._handler = handler;
	},
	use: function () {}
};

var cfg = {
	MAX_ROOMS: 100,
	MAX_CLIENTS: 500,
	MAX_ROOM_NAME_LENGTH: 30,
	MAX_NICKNAME_LENGTH: 30,
	MAX_PASSWORD_LENGTH: 15
};

var roomManager = new RoomManager(cfg);

io._handler = function (socket) {
	roomManager.createClient(socket);
	return roomManager.clients[roomManager.clients.length - 1];
};

// ==== BotSocket: FakeSocket para o bot (não se comunica com janela) ====
function BotSocket(botController) {
	this._listeners = {};
	this.id = '<BOT-' + Math.random().toString(36).substr(2, 5) + '>';
	this.io = {
		reconnection: function () {},
		opts: { query: '' }
	};
	this.handshake = { address: '127.0.0.1' };
	this.disconnected = false;
	this.botController = botController;
}

BotSocket.prototype.on = function (name, handler) {
	if (!this._listeners[name]) this._listeners[name] = [];
	this._listeners[name].push(handler);
};

BotSocket.prototype.emit = function (name, data) {
	// Quando o servidor envia algo para o bot
	if (name === 'gameMessage') {
		var self = this;
		setTimeout(function () {
			self.botController.handleGameMessage(data);
		}, 50);
	} else if (name === 'game start') {
		serverLog('Game start recebido pelo bot!');
	}
};

BotSocket.prototype._doEmit = function (name, data) {
	var listeners = this._listeners[name];
	if (listeners) {
		listeners.forEach(function (listener) {
			listener(data);
		});
	}
};

BotSocket.prototype.removeAllListeners = function (name) {
	var listeners = this._listeners[name];
	if (listeners) {
		listeners.length = 0;
	}
};

BotSocket.prototype.disconnect = function () {};

// Criar o objeto global sockets[] que o FakeSocket original usa para se registrar
window.sockets = [];

function startVsCpu() {
	var playerDeckKey = getParam('playerDeck');
	var cpuDeckKey = getParam('cpuDeck') || 'WHITE_HOPE';

	serverLog('Iniciando VS CPU...');

	// 1. Abrir janela do cliente
	var clientPath = '../index.html?local=true';
	var absolutePath = new URL(clientPath, window.location.href).href;

	var clientWin = window.open(absolutePath);
	if (!clientWin) {
		serverLog('ERRO: Pop-up bloqueado! Permita popups para este site.');
		return;
	}

	clientWin.addEventListener('load', function () {
		serverLog('Janela do cliente carregada.');

		// 2. Inicializar cliente humano no servidor
		var humanSocket = new FakeSocket(clientWin);
		var humanClient = io._handler(humanSocket); // Obtém o objeto Client do servidor
		serverLog('Jogador conectado ao servidor.');

		// 3. Inicializar bot
		var logger = new BotLogger('[BOT]');
		var deckData = BotDecks.getDeck(cpuDeckKey);
		var strategy = new WhiteHopeStrategy(logger);
		var controller = new BotController(strategy, logger);
		var botSocket = new BotSocket(controller);
		controller.botSocket = botSocket;
		
		var botClient = io._handler(botSocket); // Obtém o objeto Client do bot
		serverLog('Bot conectado ao servidor.');

		// 4. Fluxo de Criação de Sala e Início (Chamadas Diretas)
		setTimeout(function () {
			var roomName = 'VS_CPU_' + Date.now();
			
			// Humano cria sala
			roomManager.createRoom(humanClient, {
				roomName: roomName,
				nickname: 'Player',
				password: '',
				mayusRoom: false
			});
			serverLog('Sala "' + roomName + '" criada.');

			setTimeout(function () {
				// Bot entra na sala
				roomManager.joinRoom(botClient, {
					roomName: roomName,
					nickname: 'CPU: ' + (deckData ? deckData.name : 'Bot'),
					password: ''
				});
				serverLog('Bot entrou na sala.');

				setTimeout(function () {
					// Bot fica pronto
					if (deckData) {
						botClient.ready(deckData.deck);
						serverLog('Bot pronto com deck ' + cpuDeckKey);
					}

					setTimeout(function () {
						// Carregar deck do jogador
						var playerDeckData = null;
						try {
							playerDeckData = JSON.parse(localStorage.getItem('deck_file_' + playerDeckKey));
						} catch (e) {
							serverLog('Erro ao carregar deck: ' + e.message);
						}

						if (!playerDeckData) {
							serverLog('ERRO: Deck do jogador não encontrado ou inválido!');
							return;
						}

						// Humano inicia partida
						humanClient.startGame({
							mainDeck: playerDeckData.mainDeck,
							lrigDeck: playerDeckData.lrigDeck,
							live: false
						});
						serverLog('═══════════════════════════════════');
						serverLog('  ⚔ PARTIDA INICIADA COM SUCESSO!');
						serverLog('═══════════════════════════════════');
					}, 200);
				}, 200);
			}, 200);
		}, 300);
	});
}

window.onload = function () {
	serverLog('VS CPU Server pronto.');
	setTimeout(startVsCpu, 500);
};

})();
