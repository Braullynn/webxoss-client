'use strict';

/**
 * BotDecks — Registry de decks disponíveis para a CPU.
 * Cada deck tem: nome, dados do deck, e referência à strategy.
 */
var BotDecks = {
	'WHITE_HOPE': {
		name: 'White Hope',
		description: 'Deck básico branco focado em defesa e controle.',
		deck: {
			mainDeck: [
				112, 113, 114, 115, 116, 117, 118, 119, 120, 121,
				112, 113, 114, 115, 116, 117, 118, 119, 120, 121,
				112, 113, 114, 115, 116, 117, 118, 119, 120, 121,
				112, 113, 114, 115, 116, 117, 118, 119, 120, 121
			],
			lrigDeck: [104, 105, 106, 107, 108, 109, 110, 111]
		},
		strategyClass: 'WhiteHopeStrategy'
	}
	// Futuros decks podem ser adicionados aqui:
	// 'RED_AMBITION': { ... },
	// 'BLUE_PETITION': { ... },
};

/**
 * Retorna a lista de nomes de decks disponíveis para CPU.
 */
BotDecks.getAvailableDecks = function () {
	var names = [];
	for (var key in BotDecks) {
		if (typeof BotDecks[key] === 'object' && BotDecks[key].name) {
			names.push(key);
		}
	}
	return names;
};

/**
 * Retorna os dados de um deck específico.
 */
BotDecks.getDeck = function (deckKey) {
	return BotDecks[deckKey] || null;
};

window.BotDecks = BotDecks;
