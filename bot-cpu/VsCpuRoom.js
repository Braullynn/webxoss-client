'use strict';

/**
 * VsCpuRoom — Tela de preparação VS CPU.
 * Cria a UI para escolher decks e iniciar a partida.
 */
function VsCpuRoom() {
	this.overlay = null;
	this._built = false;
}

/**
 * Constrói o HTML da tela de preparação.
 */
VsCpuRoom.prototype.build = function () {
	if (this._built) return;

	var overlay = document.createElement('div');
	overlay.id = 'vs-cpu-overlay';

	overlay.innerHTML =
		'<div class="vs-cpu-container">' +
			'<h1 class="vs-cpu-title">⚔ <span>VS</span> CPU</h1>' +

			'<div class="vs-cpu-section">' +
				'<label>Seu Deck</label>' +
				'<select id="vs-cpu-player-deck"></select>' +
			'</div>' +

			'<div class="vs-cpu-divider">' +
				'<span class="line"></span>' +
				'<span class="vs-text">VS</span>' +
				'<span class="line"></span>' +
			'</div>' +

			'<div class="vs-cpu-section">' +
				'<label>Deck da CPU</label>' +
				'<select id="vs-cpu-cpu-deck"></select>' +
				'<div class="vs-cpu-cpu-info" id="vs-cpu-cpu-info">' +
					'<span class="cpu-badge">CPU</span>' +
					'<span class="cpu-desc" id="vs-cpu-cpu-desc">Selecione um deck</span>' +
				'</div>' +
			'</div>' +

			'<div class="vs-cpu-buttons">' +
				'<button class="btn-vs-cpu-back" id="vs-cpu-btn-back">Voltar</button>' +
				'<button class="btn-vs-cpu-start" id="vs-cpu-btn-start">⚔ OBEN!</button>' +
			'</div>' +
		'</div>';

	document.body.appendChild(overlay);
	this.overlay = overlay;
	this._built = true;

	// Eventos
	var self = this;
	document.getElementById('vs-cpu-btn-back').addEventListener('click', function () {
		self.hide();
	});
	document.getElementById('vs-cpu-btn-start').addEventListener('click', function () {
		self.startGame();
	});
	document.getElementById('vs-cpu-cpu-deck').addEventListener('change', function () {
		self.updateCpuInfo();
	});
};

/**
 * Exibe a tela de preparação.
 */
VsCpuRoom.prototype.show = function () {
	this.build();
	this.populateDecks();
	this.updateCpuInfo();
	this.overlay.classList.add('active');
};

/**
 * Esconde a tela de preparação.
 */
VsCpuRoom.prototype.hide = function () {
	if (this.overlay) {
		this.overlay.classList.remove('active');
	}
};

/**
 * Popula os dropdowns de deck.
 */
VsCpuRoom.prototype.populateDecks = function () {
	var playerSelect = document.getElementById('vs-cpu-player-deck');
	var cpuSelect = document.getElementById('vs-cpu-cpu-deck');

	// Limpar
	playerSelect.innerHTML = '';
	cpuSelect.innerHTML = '';

	// Decks do jogador (do localStorage, mesma lógica do DeckManager)
	var deckNames = [];
	try {
		deckNames = JSON.parse(localStorage.getItem('deck_filenames')) || [];
	} catch (e) {
		console.warn('[VS CPU] Erro ao ler decks:', e);
	}

	if (deckNames.length === 0) {
		var opt = document.createElement('option');
		opt.value = '';
		opt.textContent = '— Nenhum deck salvo —';
		playerSelect.appendChild(opt);
	} else {
		deckNames.forEach(function (name) {
			var opt = document.createElement('option');
			opt.value = name;
			opt.textContent = name;
			playerSelect.appendChild(opt);
		});
	}

	// Decks da CPU (do BotDecks registry)
	var cpuDecks = BotDecks.getAvailableDecks();
	cpuDecks.forEach(function (key) {
		var data = BotDecks.getDeck(key);
		var opt = document.createElement('option');
		opt.value = key;
		opt.textContent = data.name;
		cpuSelect.appendChild(opt);
	});
};

/**
 * Atualiza a descrição do deck da CPU selecionado.
 */
VsCpuRoom.prototype.updateCpuInfo = function () {
	var cpuSelect = document.getElementById('vs-cpu-cpu-deck');
	var descEl = document.getElementById('vs-cpu-cpu-desc');
	var selected = cpuSelect.value;
	var data = BotDecks.getDeck(selected);

	if (data) {
		descEl.textContent = data.description || data.name;
	} else {
		descEl.textContent = 'Selecione um deck';
	}
};

/**
 * Inicia a partida VS CPU.
 */
VsCpuRoom.prototype.startGame = function () {
	var playerDeck = document.getElementById('vs-cpu-player-deck').value;
	var cpuDeck = document.getElementById('vs-cpu-cpu-deck').value;

	if (!playerDeck) {
		alert('Selecione seu deck antes de iniciar!');
		return;
	}

	if (!cpuDeck) {
		alert('Selecione o deck da CPU!');
		return;
	}

	// Verificar se o deck do jogador existe no localStorage
	var deckData = null;
	try {
		deckData = JSON.parse(localStorage.getItem('deck_file_' + playerDeck));
	} catch (e) {
		// ignore
	}

	if (!deckData) {
		alert('Deck "' + playerDeck + '" não encontrado!');
		return;
	}

	console.log('[VS CPU] Iniciando partida: Player=' + playerDeck + ' vs CPU=' + cpuDeck);

	// Abrir o servidor VS CPU (Option A: window.open)
	var serverUrl = 'bot-cpu/bot-server.html?playerDeck=' +
		encodeURIComponent(playerDeck) +
		'&cpuDeck=' + encodeURIComponent(cpuDeck);

	var serverWin = window.open(serverUrl);

	if (!serverWin) {
		alert('Não foi possível abrir a janela do servidor.\nPermita popups para este site!');
		return;
	}

	// Esconder a tela de preparação
	this.hide();
};

window.VsCpuRoom = VsCpuRoom;
