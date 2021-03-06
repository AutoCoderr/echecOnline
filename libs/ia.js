const { parentPort } = require('worker_threads');
const {getPath, action, copyTab, copyObj, echecEtMat, getInfoCase} = require("./echecs");

class IA {
	iaStarting;
	tree;
	profondeurMax;
	taille;
	nbCoupureAlphaBeta;
	currentPlayer;
	echec;
	player;
	treeLevels;
	debug;

	constructor(currentPlayer, echec, player, debug = false) {
		this.iaStarting = false;
		this.currentPlayer = currentPlayer;
		this.echec = echec;
		this.player = player;
		this.taille = 0;
		this.nbCoupureAlphaBeta = {};
		this.treeLevels = {};
		this.debug = debug;
	}

	async applyIa(profondeurMax = 3) {
		if (!this.player.playing) {
			return;
		}
		if (this.iaStarting) {
			return;
		}
		this.iaStarting = true;
		this.profondeurMax = profondeurMax;

		console.log("start IA");
		console.log("Veuillez patienter...");

		const resIa = await this.startIa()

		console.log("IA executed");
		console.log(this.taille+" possibilités analysées");
		console.log("coupures alpha beta =>");
		console.log(this.nbCoupureAlphaBeta);
		return resIa;
	}

	async startIa() {
		this.taille = 0;
		this.tree = {echec: copyTab(this.echec), infosCase: copyObj(this.player.infosCase), scorePlayers: copyObj(this.player.scorePlayers), profondeur: 0};
		const oldTime = new Date();
		console.log("profondeurMax => "+this.profondeurMax);
		const score = await this.genTree(this.tree);
		const diff = (new Date()).getTime() - oldTime.getTime();
		console.log("Passed time : "+diff+" ms");

		let maxs = [this.tree.branchs[0]];
		for (let i=1;i<this.tree.branchs.length;i++) {
			if (this.tree.branchs[i].score === maxs[maxs.length-1].score) {
				maxs.push(this.tree.branchs[i]);
			} else if (this.tree.branchs[i].score > maxs[0].score) {
				maxs = [this.tree.branchs[i]]
			}
		}
		const max = maxs[rand(0,maxs.length-1)];
		return {A: {l: max.lA, c: max.cA}, B: {l: max.lB, c: max.cB}, coupSpecialReponse: max.coupSpecialReponse};
	}

	async genTree(tree, profondeur = 0, currentPlayerb = this.currentPlayer) {
		if (typeof(this.treeLevels[profondeur]) == "undefined") {
			this.treeLevels[profondeur] = 0;
		} else {
			this.treeLevels[profondeur] += 1;
		}
		if (profondeur >= this.profondeurMax) {
			return tree.score;
		}
		if (await echecEtMat({level: tree.echec, playerType: 1, scorePlayers: tree.scorePlayers, infosCase: tree.infosCase, simule: true}) ||
			await echecEtMat({level: tree.echec, playerType: 2, scorePlayers: tree.scorePlayers, infosCase: tree.infosCase, simule: true})) {
			return tree.score;
		}
		let coupureAlphaBeta = false;
		let toGet = null
		tree.branchs = [];
		for (let l=0;l<8;l++) {
			for (let c=0;c<8;c++) {
				if (typeof(tree.branchs) == "undefined") {
					tree.branchs = [];
				}
				let echec = tree.echec;
				let infosCase = tree.infosCase;
				if (echec[l][c]%10 == currentPlayerb) {
					let mouvs = getPath(l,c,echec);
					for (let i=0;i<mouvs.length;i++) {
						let echecb = copyObj(echec);
						let infosCaseb = copyObj(infosCase);
						let scorePlayersb = copyObj(tree.scorePlayers);
						let datas = await action({l,c},{l: mouvs[i].l,c: mouvs[i].c},{level: echecb,playerType: currentPlayerb,scorePlayers: scorePlayersb,infosCase: infosCaseb, simule: true, isIA: true});

						let { coupSpecial, success } = datas;

						if (coupSpecial !== undefined) {
							let reponses = coupSpecial.reponses, func = coupSpecial.func;
							this.taille += reponses.length;
							for (let j=0;j<reponses.length;j++) {
								let echecbb = copyObj(echecb);
								let infosCasebb = copyObj(infosCaseb);
								let scorePlayersbb = copyObj(scorePlayersb);

								await func({
									infosCase: infosCasebb,
									scorePlayers: scorePlayersbb,
									playerType: currentPlayerb,
									level: echecbb,
									simule: true},
									reponses[j]);

								let score = await this.getScore(scorePlayersbb,echecbb, infosCasebb, coupSpecial, reponses[j]);
								tree.branchs.push({
									lA: l,
									cA: c,
									lB: mouvs[i].l,
									cB: mouvs[i].c,
									coupSpecialReponse: reponses[j],
									echec: echecbb,
									infosCase: infosCasebb,
									scorePlayers: scorePlayersbb,
									score: score,
									profondeur: profondeur + 1,
									parent: tree,
									nbNode: tree.branchs.length
								});
								score = await this.genTree(tree.branchs[tree.branchs.length-1],profondeur+1,(currentPlayerb === 1 ? 2 : 1));
								if ((profondeur%2 === 1 & score < toGet) || // applique l'algo mini max
									(profondeur%2 === 0 & score > toGet) ||
									toGet == null) {
									toGet = score;
								}
								coupureAlphaBeta = this.alphaBeta(tree,score,coupureAlphaBeta);
								if (coupureAlphaBeta) {
									break;
								}
							}
							if (coupureAlphaBeta) {
								break;
							}
						} else {
							if (success) {
								this.taille += 1;

								let score = await this.getScore(scorePlayersb,echecb, infosCaseb);

								tree.branchs.push({lA: l, cA: c, lB: mouvs[i].l, cB: mouvs[i].c, echec: echecb, infosCase: infosCaseb,
									scorePlayers: scorePlayersb, score: score, profondeur: profondeur+1, parent: tree, coupSpecial: null, nbNode: tree.branchs.length});
								score = await this.genTree(tree.branchs[tree.branchs.length-1],profondeur+1,(currentPlayerb == 1 ? 2 : 1));
								if ((profondeur%2 == 1 & score < toGet) | // applique l'algo mini max
									(profondeur%2 == 0 & score > toGet) |
									toGet == null) {
									toGet = score;
								}
								coupureAlphaBeta = this.alphaBeta(tree,score,coupureAlphaBeta);
								if (coupureAlphaBeta) {
									if (typeof(this.nbCoupureAlphaBeta[profondeur]) == "undefined") {
										this.nbCoupureAlphaBeta[profondeur] = 1
									} else {
										this.nbCoupureAlphaBeta[profondeur] += 1
									}
									break;
								}
							}
						}
					}
				}
			}
			if (coupureAlphaBeta) {
				break;
			}
		}
		if (toGet != null) {
			tree.score = toGet;
		}
		return tree.score;
	}

	alphaBeta(tree, score, coupureAlphaBeta) {
		if (tree.nbNode > 0) { // applique la coupure alpha beta
			for (let n=0;n<tree.nbNode;n++) {
				const nodeScore = tree.parent.branchs[n].score;
				if ((tree.profondeur%2 == 0 & score >= nodeScore) |
					(tree.profondeur%2 == 1 & score < nodeScore)) {
					coupureAlphaBeta = true;
					break;
				}
			}
		}
		return coupureAlphaBeta;
	}


	async getScore(scorePlayersbb,echecbb, infosCasebb , coupSpecial = null, reponse = null) {
		const scorePlayers = this.player.scorePlayers,
			currentPlayer = this.player.playerType,
			echec = this.echec,
			infosCase = this.player.infosCase;

		let score = 0;
		for (let piece in scorePlayers[1]) {
			if (piece != 6) { // ce n'est pas le roi
				if (scorePlayersbb[1][piece] < scorePlayers[1][piece]) {
					score -= scoreObjets[piece];
					if (currentPlayer === 2) score += 1;
				} else if (scorePlayersbb[1][piece] > scorePlayers[1][piece]) {
					score += scoreObjets[piece];
					if (currentPlayer === 1) score += 1;
				}
				if (scorePlayersbb[2][piece] < scorePlayers[2][piece]) {
					score += scoreObjets[piece];
					if (currentPlayer === 1) score += 1;
				} else if (scorePlayersbb[2][piece] > scorePlayers[2][piece]) {
					score -= scoreObjets[piece];
					if (currentPlayer === 2) score += 1;
				}
			}
		}
		if (await echecEtMat({level: echecbb,playerType: 1, scorePlayers: scorePlayersbb, infosCase: infosCasebb, simule: true})) {
			score -= 10000000;
		}
		if (await echecEtMat({level: echecbb,playerType: 2, scorePlayers: scorePlayersbb, infosCase: infosCasebb, simule: true})) {
			score += 10000000;
		}
		if (currentPlayer == 2) {
			score *= -1;
		} // Si un roi ou une tour se sont déplacés durant ce coup spécial, et que ce n'est pas un roque, décrémenter le score
		if ((coupSpecial == null) || (coupSpecial.name !== "roque" || reponse === "non")) {
			if ((currentPlayer == 1 & ((echec[7][4] == 61 & echecbb[7][4] != 61) | (echec[7][0] == 31 & echecbb[7][0] != 31 & echec[7][7] == 31 & echecbb[7][7] != 31))) |
				(currentPlayer == 2 & ((echec[0][4] == 61 & echecbb[0][4] != 61) | (echec[0][0] == 31 & echecbb[0][0] != 31 & echec[0][7] == 31 & echecbb[0][7] != 31)))) {
				score -= 1;
			} else if (getInfoCase((currentPlayer === 1 ? 7 : 0),4,infosCase).nb === 0 && getInfoCase((currentPlayer === 1 ? 7 : 0),4,infosCasebb).nb > 0 ||
				(getInfoCase((currentPlayer === 1 ? 7 : 0),0,infosCase).nb === 0 && getInfoCase((currentPlayer === 1 ? 7 : 0),0,infosCasebb).nb > 0 && Math.floor(echecbb[(currentPlayer === 1 ? 7 : 0)][0]/10) === 3 &
					getInfoCase((currentPlayer === 1 ? 7 : 0),7,infosCase).nb === 0 && getInfoCase((currentPlayer === 1 ? 7 : 0),7,infosCasebb).nb > 0 && Math.floor(echecbb[(currentPlayer === 1 ? 7 : 0)][7]/10) === 3)) {
				score -= 1;
			}
		}
		// Si un roque à été fait, incrementer le score
		if (coupSpecial != null && coupSpecial.name === "roque" && reponse === "oui") {
			score += 1;
		}
		return score;
	}
}

function rand(a,b) {
	return a+Math.floor(Math.random()*(b-a+1));
}

const scoreObjets = {
	1: 1, // pion
	2: 3, // cavalier
	3: 5, // tour
	4: 3, // fou
	5: 9 // reine
}

module.exports = {
	IA
}

parentPort.on("message", player => {
	let ia = new IA(player.playerType,player.level, player);
	setTimeout(() => {
		ia.applyIa().then(resIa => {
			parentPort.postMessage(resIa);
			setTimeout(() => {
				process.exit(0);
			}, 50);
		});
	}, 100);
});