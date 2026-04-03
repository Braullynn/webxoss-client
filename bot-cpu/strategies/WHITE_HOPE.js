'use strict';

/**
 * WhiteHopeStrategy — Cérebro do deck WHITE_HOPE.
 * Implementa IA baseada em Utility Scoring para todas as decisões do jogo.
 */
function WhiteHopeStrategy(logger) {
	this.name = 'White Hope';
	this.logger = logger || new BotLogger('[WHITE_HOPE]');
}

/**
 * ============================================================
 * MÉTODO PRINCIPAL — Avalia múltiplos SELECTs e retorna o melhor.
 * ============================================================
 */
WhiteHopeStrategy.prototype.evaluateSelects = function (selectMsgs, gameState) {
	var self = this;
	var evaluations = [];

	selectMsgs.forEach(function (msg) {
		var result = self.evaluateSingleSelect(msg, gameState);
		if (result) {
			evaluations.push(result);
		}
	});

	if (!evaluations.length) return null;

	// Ordena por score e retorna o melhor
	evaluations.sort(function (a, b) { return b.score - a.score; });

	if (evaluations.length > 1) {
		evaluations.forEach(function (ev) {
			self.logger.scoring(ev.label + ' [' + ev.selectedIndexes + ']', ev.score);
		});
		self.logger.bestAction(evaluations[0].label, evaluations[0].score);
	}

	return evaluations[0];
};

/**
 * Avalia um único SELECT e retorna { label, selectedIndexes, score, optionCount }
 */
WhiteHopeStrategy.prototype.evaluateSingleSelect = function (msg, gameState) {
	var label = msg.label;
	var options = msg.options || [];
	var min = msg.min || 0;
	var max = msg.max || 0;

	switch (label) {
		// ======= SETUP =======
		case 'LEVEL0_LRIG':
			return this.makeResult(label, [0], 90, options.length, 'Escolher LRIG lv0');

		case 'DISCARD_AND_REDRAW':
			return this.handleRedraw(msg, gameState);

		// ======= ENER PHASE =======
		case 'CHARGE':
			return this.handleCharge(msg, gameState);

		case 'END_ENER_PHASE':
			return this.makeResult(label, [], 50, 0, 'Fim Ener Phase');

		// ======= GROW PHASE =======
		case 'GROW':
			return this.handleGrow(msg, gameState);

		case 'END_GROW_PHASE':
			return this.makeResult(label, [], 40, 0, 'Fim Grow Phase');

		// ======= MAIN PHASE =======
		case 'SUMMON_SIGNI':
			return this.handleSummonSigni(msg, gameState);

		case 'SUMMON_SIGNI_ZONE':
			return this.handleSummonZone(msg, gameState);

		case 'USE_SPELL':
			return this.handleUseSpell(msg, gameState);

		case 'TRASH_SIGNI':
			return this.handleTrashSigni(msg, gameState);

		case 'USE_ACTION_EFFECT':
			return this.handleActionEffect(msg, gameState);

		case 'END_MAIN_PHASE':
			return this.makeResult(label, [], 15, 0, 'Fim Main Phase');

		case 'RESONA':
			return this.handleResona(msg, gameState);

		// ======= ATTACK PHASE =======
		case 'SIGNI_ATTACK':
			return this.handleSigniAttack(msg, gameState);

		case 'END_SIGNI_ATTACK_STEP':
			return this.makeResult(label, [], 10, 0, 'Fim SIGNI Attack Step');

		case 'LRIG_ATTACK':
			return this.handleLrigAttack(msg, gameState);

		case 'END_LRIG_ATTACK_STEP':
			return this.makeResult(label, [], 10, 0, 'Fim LRIG Attack Step');

		case 'END_ARTS_STEP':
			return this.makeResult(label, [], 50, 0, 'Fim Arts Step');

		// ======= ARTS =======
		case 'USE_ARTS':
		case 'SPELL_CUT_IN':
			return this.handleArts(msg, gameState);

		// ======= END PHASE =======
		case 'DISCARD':
			return this.handleDiscard(msg, gameState);

		// ======= GUARD =======
		case 'GUARD':
			return this.handleGuard(msg, gameState);

		// ======= GENERIC / EFFECTS =======
		case 'TARGET':
			return this.handleTarget(msg, gameState);

		case 'CHOOSE_EFFECT':
		case 'SPELL_EFFECT':
		case 'ARTS_EFFECT':
			return this.handleChooseEffect(msg, gameState);

		case 'PROTECT':
			return this.handleProtect(msg, gameState);

		default:
			// Fallback genérico
			return this.handleGenericSelect(msg, gameState);
	}
};

// ============================================================
// HANDLERS ESPECÍFICOS
// ============================================================

/**
 * Redraw: manter a mão, não trocar nada (estratégia conservadora).
 */
WhiteHopeStrategy.prototype.handleRedraw = function (msg, gameState) {
	return this.makeResult('DISCARD_AND_REDRAW', [], 80, msg.options ? msg.options.length : 0, 'Manter mão');
};

/**
 * Charge: colocar a primeira carta disponível no ener.
 */
WhiteHopeStrategy.prototype.handleCharge = function (msg, gameState) {
	if (!msg.options || !msg.options.length) {
		return this.makeResult('CHARGE', [], 30, 0, 'Sem cartas para charge');
	}
	// Sempre fazer charge (pegar a primeira carta da mão)
	return this.makeResult('CHARGE', [0], 70, msg.options.length, 'Charge carta');
};

/**
 * Grow: crescer o LRIG se possível.
 */
WhiteHopeStrategy.prototype.handleGrow = function (msg, gameState) {
	if (!msg.options || !msg.options.length) {
		return null;
	}
	// Prioridade alta para grow — sempre crescer quando possível
	// Escolher a última opção (geralmente o maior level)
	var idx = msg.options.length - 1;
	return this.makeResult('GROW', [idx], 85, msg.options.length, 'Grow LRIG');
};

/**
 * Summon SIGNI: invocar um SIGNI da mão.
 * Usa utility scoring baseado no poder e level da carta.
 */
WhiteHopeStrategy.prototype.handleSummonSigni = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;

	var bestIdx = 0;
	var bestScore = 0;

	for (var i = 0; i < msg.options.length; i++) {
		var sid = msg.options[i];
		var info = gameState.getCardInfo(sid);
		var score = 60; // Base score para summon

		if (info) {
			// Quanto maior o level, melhor
			score += (info.level || 0) * 15;
			// Quanto mais poder, melhor
			score += ((info.power || 0) / 1000) * 5;
		}

		if (score > bestScore) {
			bestScore = score;
			bestIdx = i;
		}
	}

	return this.makeResult('SUMMON_SIGNI', [bestIdx], bestScore, msg.options.length, 'Invocar SIGNI');
};

/**
 * Escolher zona para summon: pegar a primeira zona disponível.
 */
WhiteHopeStrategy.prototype.handleSummonZone = function (msg, gameState) {
	if (!msg.options || !msg.options.length) {
		// Opcional — cancelar (output [])
		return this.makeResult('SUMMON_SIGNI_ZONE', [], 20, 0, 'Cancelar summon');
	}
	return this.makeResult('SUMMON_SIGNI_ZONE', [0], 80, msg.options.length, 'Zona para SIGNI');
};

/**
 * Use Spell: usar um feitiço da mão.
 */
WhiteHopeStrategy.prototype.handleUseSpell = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;
	// Usar o primeiro feitiço disponível com nota moderada
	return this.makeResult('USE_SPELL', [0], 55, msg.options.length, 'Usar Spell');
};

/**
 * Trash SIGNI: baixa prioridade (não queremos descartar SIGNIs).
 */
WhiteHopeStrategy.prototype.handleTrashSigni = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;
	// Só descarta se obrigatório (min > 0)
	if (msg.min > 0) {
		return this.makeResult('TRASH_SIGNI', [0], 5, msg.options.length, 'Descartar SIGNI (forçado)');
	}
	return null; // Não aparece como opção
};

/**
 * Action Effect: usar efeito de ação.
 */
WhiteHopeStrategy.prototype.handleActionEffect = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;
	return this.makeResult('USE_ACTION_EFFECT', [0], 50, msg.options.length, 'Usar Action Effect');
};

/**
 * Resona: invocar SIGNI ressonância.
 */
WhiteHopeStrategy.prototype.handleResona = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;
	return this.makeResult('RESONA', [0], 45, msg.options.length, 'Resona SIGNI');
};

/**
 * SIGNI Attack: atacar com SIGNI — alta prioridade.
 */
WhiteHopeStrategy.prototype.handleSigniAttack = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;
	// Sempre atacar quando possível
	return this.makeResult('SIGNI_ATTACK', [0], 90, msg.options.length, 'SIGNI Ataque!');
};

/**
 * LRIG Attack: atacar com LRIG — alta prioridade.
 */
WhiteHopeStrategy.prototype.handleLrigAttack = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;
	return this.makeResult('LRIG_ATTACK', [0], 88, msg.options.length, 'LRIG Ataque!');
};

/**
 * Arts: usar arts na attack phase.
 */
WhiteHopeStrategy.prototype.handleArts = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;
	if (msg.min > 0) {
		return this.makeResult(msg.label, [0], 60, msg.options.length, 'Usar Arts');
	}
	// Opcional: não usar por padrão
	return this.makeResult(msg.label, [], 20, msg.options.length, 'Pular Arts');
};

/**
 * Discard: descartar cartas (end phase, mão > 6).
 */
WhiteHopeStrategy.prototype.handleDiscard = function (msg, gameState) {
	// Obrigado a descartar — escolher as primeiras cartas necessárias
	var selection = [];
	var count = msg.min || 1;
	for (var i = 0; i < count && i < (msg.options ? msg.options.length : 0); i++) {
		selection.push(i);
	}
	return this.makeResult('DISCARD', selection, 100, msg.options ? msg.options.length : 0, 'Descartando ' + count + ' carta(s)');
};

/**
 * Guard: usar guard quando possível.
 */
WhiteHopeStrategy.prototype.handleGuard = function (msg, gameState) {
	if (!msg.options || !msg.options.length) return null;
	if (msg.min > 0) {
		return this.makeResult('GUARD', [0], 70, msg.options.length, 'Guard!');
	}
	// Opcional: guardar se possível
	return this.makeResult('GUARD', [0], 65, msg.options.length, 'Guard (opcional)');
};

/**
 * Target: escolher alvo para efeito.
 */
WhiteHopeStrategy.prototype.handleTarget = function (msg, gameState) {
	if (!msg.options || !msg.options.length) {
		return this.makeResult('TARGET', [], 50, 0, 'Sem alvo');
	}
	// Escolher o primeiro alvo disponível
	var selection = [];
	var count = msg.min || 1;
	for (var i = 0; i < count && i < msg.options.length; i++) {
		selection.push(i);
	}
	return this.makeResult('TARGET', selection, 50, msg.options.length, 'Selecionando alvo');
};

/**
 * Choose Effect: escolher efeito.
 */
WhiteHopeStrategy.prototype.handleChooseEffect = function (msg, gameState) {
	var selection = [];
	var count = msg.min || 1;
	var opts = msg.options || [];
	for (var i = 0; i < count && i < opts.length; i++) {
		selection.push(i);
	}
	return this.makeResult(msg.label, selection, 50, opts.length, 'Escolhendo efeito');
};

/**
 * Protect: proteger (substituir banish).
 */
WhiteHopeStrategy.prototype.handleProtect = function (msg, gameState) {
	if (!msg.options || !msg.options.length) {
		return this.makeResult('PROTECT', [], 40, 0, 'Sem proteção');
	}
	if (msg.min > 0) {
		return this.makeResult('PROTECT', [0], 60, msg.options.length, 'Proteger SIGNI');
	}
	// Opcional: proteger se disponível
	return this.makeResult('PROTECT', [0], 55, msg.options.length, 'Proteção opcional');
};

/**
 * Fallback genérico para SELECTs não tratados.
 */
WhiteHopeStrategy.prototype.handleGenericSelect = function (msg, gameState) {
	this.logger.warn('SELECT genérico: ' + msg.label);
	var selection = [];
	var min = msg.min || 0;
	var opts = msg.options || [];

	if (min > 0) {
		for (var i = 0; i < min && i < opts.length; i++) {
			selection.push(i);
		}
	}
	return this.makeResult(msg.label, selection, 30, opts.length, 'Genérico: ' + msg.label);
};

// ============================================================
// MÉTODOS AUXILIARES PARA OUTROS TIPOS DE MENSAGEM
// ============================================================

/**
 * Decide se deve pagar ener (quando cancelável).
 */
WhiteHopeStrategy.prototype.shouldPayEner = function (msg, gameState) {
	return true; // Sempre pagar por padrão
};

/**
 * Seleciona cartas de ener para pagar custo.
 * msg.cards = SIDs disponíveis, msg.integers = custo necessário por cor.
 */
WhiteHopeStrategy.prototype.selectEnerPayment = function (msg, gameState) {
	// Selecionar as primeiras cartas (solução simples)
	if (!msg.cards || !msg.cards.length) return [];
	var selection = [];
	var needed = 0;
	if (msg.requirements) {
		msg.requirements.forEach(function (req) {
			needed += (req.count || 0);
		});
	}
	if (needed <= 0) needed = 1;
	for (var i = 0; i < needed && i < msg.cards.length; i++) {
		selection.push(i);
	}
	return selection;
};

/**
 * Seleciona um número.
 */
WhiteHopeStrategy.prototype.selectNumber = function (msg, gameState) {
	// Retorna o valor default ou o mínimo
	return msg.defaultValue || msg.min || 0;
};

/**
 * Seleciona texto (índice).
 */
WhiteHopeStrategy.prototype.selectText = function (msg, gameState) {
	return 0; // Primeira opção
};

/**
 * Lida com confirmação.
 */
WhiteHopeStrategy.prototype.handleConfirm = function (msg, gameState) {
	return true; // Sempre confirmar
};

// ============================================================
// UTILITÁRIOS
// ============================================================

/**
 * Cria um objeto resultado padronizado.
 */
WhiteHopeStrategy.prototype.makeResult = function (label, selectedIndexes, score, optionCount, description) {
	if (description) {
		this.logger.log(description + ' (score: ' + score + ')', 'score');
	}
	return {
		label: label,
		selectedIndexes: selectedIndexes,
		score: score,
		optionCount: optionCount || 0
	};
};

window.WhiteHopeStrategy = WhiteHopeStrategy;
