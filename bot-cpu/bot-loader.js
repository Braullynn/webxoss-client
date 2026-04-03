'use strict';

/**
 * bot-loader.js — Entry point do modo VS CPU no cliente.
 * Carrega os scripts necessários e liga o botão VS CPU ao fluxo.
 */
(function () {

	// Aguardar DOM carregar
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	function init() {
		// Carregar CSS
		loadCSS('bot-cpu/vs-cpu.css');

		// Carregar scripts do bot (apenas os do cliente)
		loadScript('bot-cpu/BotDecks.js', function () {
			loadScript('bot-cpu/VsCpuRoom.js', function () {
				setupButton();
			});
		});
	}

	/**
	 * Configura o botão VS CPU.
	 */
	function setupButton() {
		var btn = document.getElementById('button-vs-cpu');
		if (!btn) {
			console.warn('[VS CPU] Botão #button-vs-cpu não encontrado!');
			return;
		}

		var room = new VsCpuRoom();

		btn.addEventListener('click', function () {
			room.show();
		});

		console.log('%c[VS CPU] Modo VS CPU carregado e pronto!', 'color: #e94560; font-weight: bold');
	}

	/**
	 * Carrega um arquivo CSS dinamicamente.
	 */
	function loadCSS(href) {
		var link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = href;
		document.head.appendChild(link);
	}

	/**
	 * Carrega um script JS dinamicamente.
	 */
	function loadScript(src, callback) {
		var script = document.createElement('script');
		script.src = src;
		script.onload = callback || function () {};
		script.onerror = function () {
			console.error('[VS CPU] Erro ao carregar: ' + src);
		};
		document.head.appendChild(script);
	}

})();
