'use strict';

/**
 * WhiteHopeStrategy — Cérebro do deck WHITE_HOPE.
 * Implementa IA baseada em Utility Scoring para todas as decisões do jogo.
 */
function WhiteHopeStrategy(logger) {
	this.name = 'White Hope';
	this.logger = logger || new BotLogger('[WHITE_HOPE]');
	this.lastArtPid = 0; // Rastreia a última Art ativada para context no TARGET
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

		case 'LAUNCH':
			return this.handleLaunch(msg, gameState);

		default:
			// Fallback genérico
			return this.handleGenericSelect(msg, gameState);
	}
};

// ============================================================
// HANDLERS ESPECÍFICOS
// ============================================================

/**
 * Mulligan: trocar cartas de nível alto (3+).
 */
WhiteHopeStrategy.prototype.handleRedraw = function (msg, gameState) {
	var options = msg.options || [];
	var selection = [];

	for (var i = 0; i < options.length; i++) {
		var sid = options[i];
		var info = gameState.getCardInfo(sid);
		if (info && info.level >= 3) {
			selection.push(i);
		}
	}

	var description = selection.length > 0 ?
		'Descartando ' + selection.length + ' carta(s) nível 3+' :
		'Manter mão (sem cartas nível 3+)';

	return this.makeResult('DISCARD_AND_REDRAW', selection, 80, options.length, description);
};

/**
 * Charge: colocar carta no ener baseando-se no seu valor estratégico, poupando Win Conditions e Defesas.
 */
WhiteHopeStrategy.prototype.handleCharge = function (msg, gameState) {
	if (!msg.options || !msg.options.length) {
		return this.makeResult('CHARGE', [], 30, 0, 'Sem cartas para charge');
	}

	var bestIdx = -1;
	var bestScore = -1;

	// Opcional: contar duplicatas na mão para encorajar o descarte de cartas repetidas
	var pidCounts = {};
	for (var j = 0; j < msg.options.length; j++) {
		var p = gameState.getPid(msg.options[j]);
		pidCounts[p] = (pidCounts[p] || 0) + 1;
	}

	for (var i = 0; i < msg.options.length; i++) {
		var sid = msg.options[i];
		var info = gameState.getCardInfo(sid);
		var pid = gameState.getPid(sid);
		
		// Score base para qualquer carta ser colocada no Ener
		var score = 50; 

		if (info) {
			var cardLevel = info.level !== undefined ? info.level : 0;
			
			// Identifica cartas com GUARD (Crucial para sobreviver aos ataques da LRIG)
			// Adapte "info.guard" ou a string "Servant" de acordo com o que sua engine retornar na variável info.
			var isGuard = info.guard === true || (info.classes && info.classes.indexOf('Servant') !== -1) || (info.text && info.text.indexOf('Guard') !== -1);
			var isSpell = info.type === 'Spell';

			// 1. PROTEGER DEFESAS: Nunca priorizar Guardiões/Servants, a não ser que a mão esteja entupida deles.
			if (isGuard) {
				score -= 40; 
			}

			// 2. PROTEGER WIN CONDITIONS: Penalidade severa para jogar atacantes principais no Ener.
			if (cardLevel >= 3) {
				score -= 30;
			}

			// 3. FODDER DE ENER: SIGNIs de nível 1 e 2 perdem utilidade no late game, ótimos para virar recurso.
			if (cardLevel === 1 || cardLevel === 2) {
				score += 20; 
			}

			// 4. SPELLS: Geralmente são situacionais. Bons para dar Ener se não for o momento de usá-los.
			if (isSpell) {
				score += 10;
			}
			
			// 5. REDUNDÂNCIA: Bônus por duplicatas. Se temos mais de uma cópia dessa carta na mão, é seguro descartar uma.
			if (pidCounts[pid] > 1) {
				score += 15;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestIdx = i;
		}
	}

	// 6. PULAR O CHARGE SE A MÃO SÓ TIVER CARTAS VITAIS
	// No WIXOSS você não é obrigado a dar Charge. Se sua mão está pequena (<= 3) 
	// e a "melhor" carta ainda tem score muito baixo (indicando que só sobraram Guards ou Nível 3+), pulamos a fase.
	var handSize = msg.options.length;
	if (bestScore <= 30 && handSize <= 3) {
		this.logger.log('CHARGE: Pular charge para poupar Guards e cartas nível 3+ (Mão pequena)', 'action');
		// Mandar array vazio [] instrui a engine a não selecionar nada e seguir o jogo.
		return this.makeResult('CHARGE', [], 80, msg.options.length, 'Pular Charge (Poupar mão vital)');
	}

	// Se chegamos até aqui, encontramos um alvo aceitável para o Ener.
	if (bestIdx !== -1) {
		return this.makeResult('CHARGE', [bestIdx], 70, msg.options.length, 'Charge inteligente (Score: ' + bestScore + ')');
	}

	// Fallback genérico caso tudo falhe
	return this.makeResult('CHARGE', [0], 30, msg.options.length, 'Charge fall-back (Fallback)');
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

	var bestIdx = 0;
	var bestScore = -1;

	for (var i = 0; i < msg.options.length; i++) {
		var sid = msg.options[i];
		var info = gameState.getCardInfo(sid);

		var score = 55;
		var enerCostTotal = 0;

		if (info) {
			var colors = ['White', 'Black', 'Red', 'Blue', 'Green', 'Colorless'];
			for (var c = 0; c < colors.length; c++) {
				enerCostTotal += (info['cost' + colors[c]] || 0);
			}
		}

		if (gameState.shouldSaveEnerForGrow() && enerCostTotal > 0) {
			score = 10;
		} else if (enerCostTotal === 0) {
			score = 75; // Bônus para spells gratuitas
		}

		if (score > bestScore) {
			bestScore = score;
			bestIdx = i;
		}
	}

	if (bestScore < 10) return null;

	return this.makeResult('USE_SPELL', [bestIdx], bestScore, msg.options.length, 'Usar Spell');
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

	var score = 50;
	if (gameState.shouldSaveEnerForGrow()) {
		score = 10;
	}

	return this.makeResult('USE_ACTION_EFFECT', [0], score, msg.options.length, 'Usar Action Effect');
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

	var bestIdx = -1;
	var bestScore = -1;

	// O WIXOSS tem 3 colunas. Precisamos saber qual SIGNI ataca qual zona oponente.
	// O select de SIGNI_ATTACK geralmente dá as opções de zonas/índices que podem atacar.
	for (var i = 0; i < msg.options.length; i++) {
		var zoneIdx = msg.options[i]; // No motor, a opção de ataque é o índice da zona (0, 1, 2)
		var attackerSid = gameState.myFieldSids[zoneIdx];
		var defenderSid = gameState.enemyFieldSids[zoneIdx];

		var attackerInfo = gameState.getCardInfo(attackerSid);
		var defenderInfo = gameState.getCardInfo(defenderSid);

		var score = 0;

		if (!defenderSid) {
			// Zona vazia: dano direto! Prioridade máxima.
			score = 95;
		} else if (attackerInfo && defenderInfo) {
			if (attackerInfo.power > defenderInfo.power) {
				// Atacante mais forte: banimento garantido.
				score = 85;
			} else if (attackerInfo.power === defenderInfo.power) {
				// Empate: o defensor é destruido.
				// Geralmente vale a pena se for para limpar o campo.
				score = 80;
			} else {
				// Atacante mais fraco: o ataque é bloqueado. 
				// atacar contra mais forte é "ação desnecessária" (tapped e vulnerável).
				score = 1;
			}
		} else {
			// Fallback se não tivermos info da carta
			score = 60;
		}

		if (score > bestScore) {
			bestScore = score;
			bestIdx = i;
		}
	}

	if (bestIdx === -1 || bestScore < 10) return null;

	return this.makeResult('SIGNI_ATTACK', [bestIdx], bestScore, msg.options.length, 'SIGNI Ataque!');
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

	var bestIdx = 0;
	var bestScore = -1;

	for (var i = 0; i < msg.options.length; i++) {
		var sid = msg.options[i];
		var pid = gameState.getPid(sid);
		var score = 20;

		if (gameState.isDefensiveTiming()) {
			// No turno do oponente, arts defensivas são muito valiosas.
			score = 75;

			if (pid === 111) { // Baroque Defense
				score = 80; // Prioridade alta para bloquear ataques
			} else if (pid === 109) { // Rococo Boundary (Remoção)
				// Se o oponente tiver apenas 1 SIGNI, talvez seja melhor poupar a Art de "até 2"
				var enemyCount = gameState.enemyFieldSids.filter(function (id) { return !!id; }).length;
				if (enemyCount < 2) {
					this.logger.log('Poupar Rococo (PID 109): poucos alvos em campo.', 'score');
					score = 15;
				}
			}
		} else {
			// No nosso turno
			if (pid === 111) {
				score = 5; // Nunca usar Baroque defensivo no ataque
			} else if (pid === 109) {
				score = 40; // Remoção no ataque pode ser bom, mas defensivamente é melhor
			} else {
				score = 10;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestIdx = i;
		}
	}

	if (msg.min > 0) {
		return this.makeResult(msg.label, [bestIdx], Math.max(bestScore, 60), msg.options.length, 'Usar Arts (Forçado)');
	}

	if (bestScore < 10) return null;

	var bestPid = gameState.getPid(msg.options[bestIdx]);
	this.lastArtPid = bestPid; // Salva contexto para o próximo TARGET
	var desc = 'Usar Art (PID: ' + bestPid + ')';
	return this.makeResult(msg.label, [bestIdx], bestScore, msg.options.length, desc);
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
	var options = msg.options || [];
	if (!options.length) {
		this.logger.warn('GUARD: Nenhuma carta disponível para guarda nas opções!');
		return null;
	}

	// Logging das cartas disponíveis para Guard (ajuda no debug)
	var availablePids = options.map(function (sid) { return gameState.getPid(sid); });
	this.logger.log('GUARD: Opções disponíveis (PIDs): ' + availablePids.join(','), 'info');

	var score = 70;
	// Se a vida estiver baixa, o GUARD é essencial
	if (gameState.myLifeCount <= 2) {
		score = 95;
		this.logger.log('GUARD: Vida crítica! Prioridade máxima.', 'score');
	} else if (gameState.myLifeCount <= 4) {
		score = 85;
	}

	if (msg.min > 0) {
		return this.makeResult('GUARD', [0], Math.max(score, 80), options.length, 'Guard (Obrigatório)');
	}

	return this.makeResult('GUARD', [0], score, options.length, 'Guard');
};

/**
 * Target: escolher alvo para efeito.
 */
WhiteHopeStrategy.prototype.handleTarget = function (msg, gameState) {
	if (!msg.options || !msg.options.length) {
		return this.makeResult('TARGET', [], 50, 0, 'Sem alvo');
	}

	var lastPid = this.lastArtPid;
	var bestIdx = 0;
	var bestValue = -1;

	for (var i = 0; i < msg.options.length; i++) {
		var sid = msg.options[i];
		var info = gameState.getCardInfo(sid);
		var isUp = gameState.isCardUp(sid);
		var value = 1;

		if (info) {
			// Valor base: Power + Level
			value = (info.power || 0) + (info.level || 0) * 10000;

			// Bonus por estar UP
			if (isUp) value += 1000000;

			// Lógica específica para WD01-008 (Baroque Defense)
			if (lastPid === 111) {
				var zoneIdx = gameState.getEnemyZoneIdx(sid);
				if (zoneIdx !== -1 && gameState.isMyZoneEmpty(zoneIdx)) {
					// SIGNI inimigo que atacaria direto! Prioridade máxima.
					value += 5000000;
					this.logger.log('WD01-008: Priorizando atacante direto na zona ' + zoneIdx, 'score');
				}
			}
		}

		if (value > bestValue) {
			bestValue = value;
			bestIdx = i;
		}
	}

	var selection = [];
	// Regra de quantidade:
	// Prioriza escolher o MAXimo possível quando permitido, especialmente para o Meta do deck
	var count = msg.max || msg.min || 1;
	count = Math.min(count, msg.options.length);

	// Montar seleção (garantindo que o melhor alvo esteja incluído)
	selection.push(bestIdx);
	for (var j = 0; j < msg.options.length && selection.length < count; j++) {
		if (j !== bestIdx) {
			selection.push(j);
		}
	}

	// Limpar lastArtPid após processar o TARGET
	this.lastArtPid = 0;

	var description = 'Selecionando ' + selection.length + ' alvo(s). Prioridade: ' + (gameState.getPid(msg.options[bestIdx]) || 'Desconhecido');
	return this.makeResult('TARGET', selection, 50, msg.options.length, description);
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
	var max = msg.max || 1;
	var opts = msg.options || [];

	// Priorizar buscar o máximo de cartas possível (especialmente em buscas no deck)
	var count = Math.min(max, opts.length);

	for (var i = 0; i < count; i++) {
		selection.push(i);
	}

	return this.makeResult(msg.label, selection, 30, opts.length, 'Genérico (Max): ' + msg.label);
};

/**
 * handleLaunch: Lida com ativação de Bursts e buscas no deck (label LAUNCH).
 */
WhiteHopeStrategy.prototype.handleLaunch = function (msg, gameState) {
	var opts = msg.options || [];
	var max = msg.max || 1;
	var selection = [];

	// Sempre selecionar o máximo possível em busca/ativamento
	if (opts.length > 0) {
		var count = Math.min(max, opts.length);
		this.logger.log('LAUNCH: Selecionando máximo (' + count + ')', 'action');
		for (var i = 0; i < count; i++) {
			selection.push(i);
		}
	}

	return this.makeResult('LAUNCH', selection, 95, opts.length, 'Ativando LAUNCH/Burst (Max)');
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
	if (!msg.cards || !msg.cards.length) return [];

	var availableMasks = msg.integers || []; // Máscaras das cartas na Ener Zone
	var requirements = msg.requirements ? msg.requirements.slice() : []; // Requisitos de custo ({count, mask})
	var selection = [];
	var usedIndices = {};

	// Ordena os requerimentos: máscaras coloridas específicas primeiro, incolor por último
	requirements.sort(function(a, b) {
		var maskA = a.mask || 0;
		var maskB = b.mask || 0;
		return maskB - maskA; 
	});

	// Tentar satisfazer cada requisito
	requirements.forEach(function (req) {
		var needed = req.count || 0;
		var mask = req.mask;

		for (var i = 0; i < availableMasks.length && needed > 0; i++) {
			if (usedIndices[i]) continue;

			var cardMask = availableMasks[i];
			// Se a máscara for 0 (Colorless/Qualquer), aceita qualquer cardMask.
			// Caso contrário, verifica se o bit correspondente está ligado.
			if (!mask || (cardMask & mask)) {
				selection.push(i);
				usedIndices[i] = true;
				needed--;
			}
		}
	});

	this.logger.log('Pagamento Ener:Selecionados ' + selection.length + ' cartões para custo.', 'action');
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
