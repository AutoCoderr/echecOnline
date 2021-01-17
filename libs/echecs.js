let players = {},
	playerSearching = {};

let dataInfoCase = {
	1: { // pions
		justTwoDeplacment: false
	},
	0: { //tous le mondes
		nb: 0,
		isLastDeplacment: false
	}
}

const positionInitales = {0: {0: 32, 1: 22, 2: 42, 3: 52, 4: 62, 5: 42, 6: 22, 7: 32},
						  1: {0: 12, 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12, 7: 12},

						  6: {0: 11, 1: 11, 2: 11, 3: 11, 4: 11, 5: 11, 6: 11, 7: 11},
						  7: {0: 31, 1: 21, 2: 41, 3: 51, 4: 61, 5: 41, 6: 21, 7: 31}};

/*const positionInitales = {0: {0: 0,  1: 0,  2: 0,  3: 0,  4: 62, 5: 0,  6: 0, 7: 32}, // Test echec et mat avec possibilité de roque
						  1: {0: 12, 1: 51,  2: 12, 3: 12,4: 12, 5: 12, 6: 0, 7: 12},
						  2: {                                                 7: 0},
	                      5: {                                   5: 0               },
						  6: {0: 11, 1: 11, 2: 11, 3: 11, 4: 11, 5: 11, 6: 11, 7: 11},
						  7: {0: 31, 1: 21, 2: 41, 3: 0, 4: 61, 5: 41, 6: 21, 7: 31}};*/

/*const positionInitales = {0: {0: 32, 1: 22, 2: 42, 3: 52, 4: 62, 5: 42, 6: 22, 7: 32}, // Positions initiales pour un coup du berger
						  1: {0: 12, 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12, 7: 12},
						  4: {              2: 41                                   },
						  5: {                            4: 11                     },
						  6: {0: 11, 1: 11, 2: 11, 3: 11, 4: 0, 5: 11, 6: 11, 7: 11 },
						  7: {0: 31, 1: 21, 2: 41, 3: 51, 4: 61, 5: 0, 6: 21, 7: 31}};*/
//const positionInitales = {3: {3: 62}, 5: {3: 61}, 7: {2: 51}};

let IA;
function setIA(UneIA) {
	IA = UneIA;
}

async function callbackAction(success,player,coupSpecial) {
	let currentPlayerb = player.playerType;
	let echec = player.level;
	choicedCases = [];
	if (!player.isIA) {
		if (!success) {
			player.socket.emit("msg", {type: "error", msg: "Mouvement impossible"});
			player.socket.emit("emptyChoicedCases");
			return;
		}
		player.socket.emit("msg", {type: "empty"});
	}
	if (await echecEtMat(player.adversaire)) {
		gameOver(player,player.playerType);
		return;
	} else if (await echecEtMat(player)) {
		gameOver(player.adversaire,player.adversaire.playerType);
		return;
	}
	if (typeof(coupSpecial) == "object" && !player.isIA) {
		player.functionCoupSpecial = coupSpecial.func;
		player.socket.emit("coupSpecial", {msg: coupSpecial.msg, reponses: coupSpecial.reponses});
		return;
	}
	player.hisOwnTurn = false;
	player.adversaire.hisOwnTurn = true;
	if (!player.isIA) {
		player.socket.emit("displayLevel", {
			tab: player.level,
			playerType: player.playerType,
			hisOwnTurn: player.hisOwnTurn,
			echec: isEchec(currentPlayerb, echec),
			lastDeplacment: player.lastDeplacment
		});
	}
	if (!player.adversaire.isIA) {
		player.adversaire.socket.emit("displayLevel", {
			tab: player.level,
			playerType: player.adversaire.playerType,
			hisOwnTurn: player.adversaire.hisOwnTurn,
			echec: isEchec(player.adversaire.playerType, echec),
			lastDeplacment: player.lastDeplacment
		});
	} else {
		player.socket.emit("msg", {type: 'info', msg: "L'ia réfléchit..."})
		let ia = new IA(player.adversaire.playerType,echec, player.adversaire);
		setTimeout(() => {
			ia.applyIa().then(() => {
				player.socket.emit("msg", {type: "empty"});
			});
		}, 100);
	}
}
//let count = 0;
async function action(A,B,player,) {
	let echec = player.level;
	let currentPlayerb = player.playerType;
	let scorePlayersb = player.scorePlayers;
	let infosCase = player.infosCase;

	const lA = A.l, cA = A.c, lB = B.l, cB = B.c;

	if (!possibleMouvement(lA, cA, lB, cB, echec, currentPlayerb, infosCase)) {
		return {success: false, player};
	}
	if (!player.simule) {
		player.lastDeplacment.lA = lA;
		player.lastDeplacment.cA = cA;
		player.lastDeplacment.lB = lB;
		player.lastDeplacment.cB = cB;
	}

	let thisInfoCase = getInfoCase(lA,cA,infosCase);
	if (thisInfoCase != null) {
		thisInfoCase.nb += 1;
	}
	let cD, lD, lI, cI;
	let listMouv;
	switch(Math.floor(echec[A.l][A.c]/10)) {
		case 1: //pion
			if (cB > cA) {
				cD = 1;
			} else if (cB < cA) {
				cD = -1;
			} else {
				cD = 0;
			}
			if (lB > lA) {
				lD = 1;
			} else if (lB < lA) {
				lD = -1;
			} else {
				lD = 0;
			}
			listMouv = [];
			lI = lA;
			cI = cA;
			while (lI != lB | cI != cB) {
				lI += lD;
				cI += cD;
				listMouv.push({l: lI, c: cI});
			}
			await deplace(lA,cA,listMouv,10+currentPlayerb,player);
			const lP = listMouv[listMouv.length-1].l;
			const cP = listMouv[listMouv.length-1].c;
			if (listMouv[0].c != cA &
				((currentPlayerb == 1 & getElem(echec,lP+1,cP)%10 == 2 & getInfoCase(lP+1,cP,infosCase).isLastDeplacment & getInfoCase(lP+1,cP,infosCase).justTwoDeplacment) |
					(currentPlayerb == 2 & getElem(echec,lP-1,cP)%10 == 1 & getInfoCase(lP-1,cP,infosCase).isLastDeplacment & getInfoCase(lP-1,cP,infosCase).justTwoDeplacment))) {
				if (currentPlayerb == 1) {
					scorePlayersb[echec[lP+1][cP]%10][Math.floor(echec[lP+1][cP]/10)] -= 1;
					echec[lP+1][cP] = 0;
				} else if (currentPlayerb == 2) {
					scorePlayersb[echec[lP-1][cP]%10][Math.floor(echec[lP-1][cP]/10)] -= 1;
					echec[lP-1][cP] = 0;
				}
				if (!player.isIA)
					player.socket.emit("displayLevel", {tab: player.level, playerType: player.playerType});
				if (!player.adversaire.isIA)
					player.adversaire.socket.emit("displayLevel", {tab: player.level, playerType: player.adversaire.playerType});
			}
			thisInfoCase = getInfoCase(lB,cB,infosCase);
			thisInfoCase.isLastDeplacment = true;
			for (let i=0;i<infosCase.length;i++) {
				if (infosCase[i].l != lB & infosCase[i].c != cB & infosCase[i].isLastDeplacment) {
					infosCase[i].isLastDeplacment = false;
				}
			}
			if (Math.sqrt((lB-lA)**2) == 2) {
				thisInfoCase.justTwoDeplacment = true;
			} else {
				thisInfoCase.justTwoDeplacment = false;
			}
			if ((currentPlayerb == 1 & lB == 0) | (currentPlayerb == 2 & lB == 7)) {
				return{
					success: true,
					player,
					coupSpecial: {
						func: (player,rep) => {
							promotion(lB,cB,player,rep);
						},
						msg: "Par quoi voulez vous remplacer ce pion?",
						reponses: ["Cavalier","Tour","Fou","Reine"],
						name: "promotion"
					}
				};
			}
			return {success: true,player};
		case 2: //cavalier
			listMouv = [];
			if ((lB-lA)**2 == 1) {
				if (cB < cA) {
					listMouv.push({l: lA, c: cA-1});
				} else {
					listMouv.push({l: lA, c: cA+1});
				}
				listMouv.push({l: lA, c: cB});
				listMouv.push({l: lB, c: cB});
			} else if ((cB-cA)**2 == 1) {
				if (lB < lA) {
					listMouv.push({l: lA-1, c: cA});
				} else {
					listMouv.push({l: lA+1, c: cA});
				}
				listMouv.push({l: lB, c: cA})
				listMouv.push({l: lB, c: cB});
			}
			await deplace(lA,cA,listMouv,20+currentPlayerb,player);
			thisInfoCase = getInfoCase(lB,cB,infosCase);
			thisInfoCase.isLastDeplacment = true;
			for (let i=0;i<infosCase.length;i++) {
				if (infosCase[i].l != lB & infosCase[i].c != cB & infosCase[i].isLastDeplacment) {
					infosCase[i].isLastDeplacment = false;
				}
			}
			return {success: true, player};
		case 3: //tour
			if (cB != cA) {
				lD = 0;
				if (cB > cA) {
					cD = 1;
				} else {
					cD = -1;
				}
			} else if (lB != lA) {
				cD = 0;
				if (lB > lA) {
					lD = 1;
				} else {
					lD = -1;
				}
			}
			listMouv = [];
			lI = lA;
			cI = cA;
			while (lI != lB | cI != cB) {
				lI += lD;
				cI += cD;
				listMouv.push({l: lI, c: cI});
			}
			await deplace(lA,cA,listMouv,30+currentPlayerb,player);
			thisInfoCase = getInfoCase(lB,cB,infosCase);
			thisInfoCase.isLastDeplacment = true;
			for (let i=0;i<infosCase.length;i++) {
				if (infosCase[i].l != lB & infosCase[i].c != cB & infosCase[i].isLastDeplacment) {
					infosCase[i].isLastDeplacment = false;
				}
			}
			if (thisInfoCase.nb == 1 ) {
				if (echec[lB][cB-1] == 60+currentPlayerb & getInfoCase(lB,cB-1,infosCase).nb == 0) {
					return {
						success: true,
						player,
						coupSpecial: {
							func: (player,rep) => {
								roque(lB,cB,lB,cB-1,player,rep);
							},
							msg: "Effectuer un roque?",
							reponses: ["oui","non"],
							name: "roque"
						}
					};
				} else if (echec[lB][cB+1] == 60+currentPlayerb & getInfoCase(lB,cB+1,infosCase).nb == 0) {
					return {
						success: true,
						player,
						coupSpecial: {
							func: (player,rep) => {
								roque(lB,cB,lB,cB+1,player,rep);
							},
							msg: "Effectuer un roque?",
							reponses: ["oui","non"],
							name: "roque"
						}
					};
				}
			}
			return {success: true,player};
		case 4: // fou
			lD = 0;
			cD = 0;
			if (lB > lA) {
				lD = 1;
			} else if (lB < lA) {
				lD = -1;
			}
			if (cB > cA) {
				cD = 1
			} else if (cB < cA) {
				cD = -1;
			}
			listMouv = [];
			lI = lA;
			cI = cA;
			while (lI != lB | cI != cB) {
				lI += lD;
				cI += cD;
				listMouv.push({l: lI, c: cI});
			}
			await deplace(lA,cA,listMouv,40+currentPlayerb,player);
			thisInfoCase = getInfoCase(lB,cB,infosCase);
			thisInfoCase.isLastDeplacment = true;
			for (let i=0;i<infosCase.length;i++) {
				if (infosCase[i].l != lB & infosCase[i].c != cB & infosCase[i].isLastDeplacment) {
					infosCase[i].isLastDeplacment = false;
				}
			}
			return {success: true,player};
		case 5: // reine
			lD = 0;
			cD = 0;
			if (lB > lA) {
				lD = 1;
			} else if (lB < lA) {
				lD = -1;
			}
			if (cB > cA) {
				cD = 1
			} else if (cB < cA) {
				cD = -1;
			}
			listMouv = [];
			lI = lA;
			cI = cA;
			while (lI != lB | cI != cB) {
				lI += lD;
				cI += cD;
				listMouv.push({l: lI, c: cI});
			}
			await deplace(lA,cA,listMouv,50+currentPlayerb,player);
			thisInfoCase = getInfoCase(lB,cB,infosCase);
			thisInfoCase.isLastDeplacment = true;
			for (let i=0;i<infosCase.length;i++) {
				if (infosCase[i].l != lB & infosCase[i].c != cB & infosCase[i].isLastDeplacment) {
					infosCase[i].isLastDeplacment = false;
				}
			}
			return {success: true,player};
		case 6: // roi
			listMouv = [{l: lB, c: cB}];
			await deplace(lA,cA,listMouv,60+currentPlayerb, player);
			thisInfoCase = getInfoCase(lB,cB,infosCase);
			thisInfoCase.isLastDeplacment = true;
			for (let i=0;i<infosCase.length;i++) {
				if (infosCase[i].l != lB & infosCase[i].c != cB & infosCase[i].isLastDeplacment) {
					infosCase[i].isLastDeplacment = false;
				}
			}
			return {success: true,player};
	}
}

function timeoutAwait(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	})
}

async function deplace(lP,cP,listMouv,type, player, ms = 500) {
	let echec = player.level;
	let scorePlayersb = player.scorePlayers;
	let currentPlayerb = player.currentPlayer;
	let infosCase = player.infosCase;

	for (let i=0;i<listMouv.length;i++) {
		if (echec[listMouv[i].l][listMouv[i].c] != 0) {
			if (Math.floor(type/10) == 1 & listMouv[i].c == cP) {
				//return {echec: echecb, scorePlayers: scorePlayersb, infosCase: infosCaseb};
				return;
			} else if (Math.floor(type/10) != 2 | i == listMouv.length-1) {
				if (echec[listMouv[i].l][listMouv[i].c]%10 != currentPlayerb & echec[listMouv[i].l][listMouv[i].c] != 0) {
					scorePlayersb[echec[listMouv[i].l][listMouv[i].c]%10][Math.floor(echec[listMouv[i].l][listMouv[i].c]/10)] -= 1;
					let thisInfoCase = getInfoCase(lP,cP,infosCase);
					thisInfoCase.l = listMouv[i].l;
					thisInfoCase.c = listMouv[i].c;
					echec[lP][cP] = 0;
					echec[listMouv[i].l][listMouv[i].c] = type;
					//return {echec: echecb, scorePlayers: scorePlayersb, infosCase: infosCaseb};
				}
				return;
			}
		} else {
			echec[lP][cP] = 0;
			echec[listMouv[i].l][listMouv[i].c] = type;
			let thisInfoCase = getInfoCase(lP,cP,infosCase);
			thisInfoCase.l = listMouv[i].l;
			thisInfoCase.c = listMouv[i].c;
			lP = listMouv[i].l;
			cP = listMouv[i].c;
			if (!player.simule) {
				if (!player.isIA)
					player.socket.emit("displayLevel", {tab: player.level, playerType: player.playerType});
				if (!player.adversaire.isIA) {
					player.adversaire.socket.emit("displayLevel", {tab: player.level, playerType: player.adversaire.playerType});
				}
				await timeoutAwait(ms);
			}
		}
	}
}

function possibleMouvement(lA,cA,lB,cB,echec,currentPlayerb,infosCase) {
	if (lA >= echec.length) {
		return false;
	}
	if (cA >= echec[lA].length) {
		return false;
	}
	if (lB >= echec.length) {
		return false;
	}
	if (cB >= echec[lB].length) {
		return false;
	}
	if (echec[lA][cA] == 0 | echec[lA][cA]%10 != currentPlayerb) {
		return false;
	}
	if (lA == lB & cA == cB) {
		return false;
	}

	switch(Math.floor(echec[lA][cA]/10)) {
		case 1: // pion
			if (lB == lA & cB == cA) {
				return false;
			}
			if (
				(
					currentPlayerb === 1 &&
					(
						lB !== lA-1 ||
						cB !== cA ||
						(echec[lB][cB] !== 0 && cB === cA)
					)
				) ||
				(
					currentPlayerb === 2 &&
					(
						lB !== lA+1 ||
						cB !== cA ||
						(
							echec[lB][cB] !== 0 &&
							cB === cA
						)
					)
				)
			) { // deplacement en ligne droite
				if (
					(
						currentPlayerb === 1 &&
						(
							(
								(
									lB === lA-1 &&
									(cB-cA)**2 === 1
								)
								&&
								echec[lB][cB]%10 !== 2 &&
								(
									getElem(echec,lB+1,cB)%10 !== 2 ||
									!getInfoCase(lB+1,cB,infosCase).isLastDeplacment ||
									!getInfoCase(lB+1,cB,infosCase).justTwoDeplacment
								)
								||
								echec[lB][cB]%10 === 1
							)
							||
							(
								lB === lA-2 &&
								(
									getInfoCase(lA,cA,infosCase).nb > 0 ||
									cB-cA !== 0
								)
							)
							||
							(
								lB !== lA-1 &&
								lB !== lA-2
							)
							||
							(
								lB === lA-1 &&
								cB !== cA-1 &&
								cB !== cA+1
							)
							||
							(
								echec[lB][cB] !== 0 &&
								cB === cA
							)
						)
					)
					||
					(
						currentPlayerb === 2 &&
						(
							(
								(
									lB === lA+1 &&
									(cB-cA)**2 === 1
								)
								&&
								echec[lB][cB]%10 !== 1 &&
								(
									getElem(echec,lB-1,cB)%10 !== 1 ||
									!getInfoCase(lB-1,cB,infosCase).isLastDeplacment ||
									!getInfoCase(lB-1,cB,infosCase).justTwoDeplacment
								)
								||
								echec[lB][cB]%10 === 2
							)
							||
							(
								lB === lA+2 &&
								(
									getInfoCase(lA,cA,infosCase).nb > 0 ||
									cB-cA !== 0
								)
							)
							||
							(
								lB !== lA+1 &&
								lB !== lA+2
							)
							||
							(
								lB === lA+1 &&
								cB !== cA-1 &&
								cB !== cA+1
							)
							||
							(
								echec[lB][cB] !== 0 &&
								cB === cA
							)
						)
					)
				) {
					return false;
				}
			}
			break;
		case 2: // cavalier
			if (lB == lA & cB == cA) {
				return false;
			}
			if (echec[lB][cB]%10 == currentPlayerb) {
				return false;
			}
			if (Math.sqrt((lB-lA)**2) == 2) {
				if (cB != cA+1 & cB != cA-1) {
					return false;
				}
			} else if (Math.sqrt((cB-cA)**2) == 2) {
				if (lB != lA-1 & lB != lA+1) {
					return false;
				}
			} else {
				return false;
			}
			break;
		case 3: // tour
			if ((lB != lA & cB != cA) | (lB == lA & cB == cA)) {
				return false;
			}
			if (echec[lB][cB]%10 == currentPlayerb) {
				return false;
			}
			break;
		case 4: //fou
			if (lB == lA & cB == cA) {
				return false;
			}
			if (echec[lB][cB]%10 == currentPlayerb) {
				return false;
			}
			if (Math.sqrt((lB-lA)**2) != Math.sqrt((cB-cA)**2)) {
				return false;
			}
			break;
		case 5: //reine
			if (lB == lA & cB == cA) {
				return false;
			}
			if (echec[lB][cB]%10 == currentPlayerb) {
				return false;
			}
			if ((Math.sqrt((lB-lA)**2) != Math.sqrt((cB-cA)**2)) &
				(lB != lA & cB != cA)) {
				return false;
			}
			break;
		case 6: //roi
			if (lB == lA & cB == cA) {
				return false;
			}
			if (echec[lB][cB]%10 == currentPlayerb) {
				return false;
			}
			if ((lB-lA)**2 > 1 | (cB-cA)**2 > 1) {
				return false;
			}
			break;
	}
	let echecb = copyTab(echec);
	echecb[lB][cB] = echecb[lA][cA];
	echecb[lA][cA] = 0;
	if (isEchec(currentPlayerb,echecb)) {
		return false;
	}
	return true;
}

function getInfoCase(l,c,infosCase) {
	for (let i=0;i<infosCase.length;i++) {
		if (infosCase[i].l == l & infosCase[i].c == c) {
			return infosCase[i];
		}
	}
	let emptyObject = {};
	for (let keyA in dataInfoCase) {
		for (let keyB in dataInfoCase[keyA]) {
			emptyObject[keyB] = dataInfoCase[keyA][keyB];
		}
	}
	return emptyObject;
}

function startGame(J1,J2) {
	J1.playing = true;
	J2.playing = true;

	J1.hisOwnTurn = true;
	J2.hisOwnTurn = false;

	J1.playerType = 1;
	J2.playerType = 2;

	J1.adversaire = J2;
	J2.adversaire = J1;

	let scorePlayers = {1: {}, 2: {}};
	let infosCase = [];

	let tab = genEchecTab(infosCase,scorePlayers);

	J1.scorePlayers = scorePlayers;
	J2.scorePlayers = scorePlayers;

	J1.infosCase = infosCase;
	J2.infosCase = infosCase;

	J1.level = tab;
	J2.level = tab;

	J1.lastDeplacment = {};
	J2.lastDeplacment = J1.lastDeplacment;

	J1.socket.emit("displayLevel", {tab: tab, playerType: 1, hisOwnTurn: J1.hisOwnTurn});
	if (!J2.isIA) {
		J2.socket.emit("displayLevel", {tab: tab, playerType: 2, hisOwnTurn: J2.hisOwnTurn});
	}

	let playersList = [];
	for (let unPseudo in players) {
		if (!players[unPseudo].playing) {
			playersList.push(unPseudo);
		}
	}

	for (let pseudo in players) {
		if (pseudo != J1.pseudo & pseudo != J2.pseudo) {
			players[pseudo].socket.emit("displayPlayers", playersList);
		}
	}
}

function genEchecTab(infosCase, scorePlayers) {
	let tab = [];
	for (let l=0;l<8;l++) {
		tab.push([]);
		for (let c=0;c<8;c++) {
			if (typeof(positionInitales[l]) != "undefined") {
				if (typeof(positionInitales[l][c]) != "undefined" && positionInitales[l][c] !== 0) {
					tab[l].push(positionInitales[l][c]);
					if (typeof(scorePlayers[positionInitales[l][c]%10][Math.floor(positionInitales[l][c]/10)]) == "undefined") {
						scorePlayers[positionInitales[l][c]%10][Math.floor(positionInitales[l][c]/10)] = 1;
					} else {
						scorePlayers[positionInitales[l][c]%10][Math.floor(positionInitales[l][c]/10)] += 1;
					}
					infosCase.push({l: l, c: c, type: Math.floor(tab[l][c]/10)})
					for (let key in dataInfoCase[0]) {
						infosCase[infosCase.length-1][key] = dataInfoCase[0][key];
					}
					if (typeof(dataInfoCase[Math.floor(tab[l][c]/10)]) != "undefined") {
						for (let key in dataInfoCase[Math.floor(tab[l][c]/10)]) {
							infosCase[infosCase.length-1][key] = dataInfoCase[Math.floor(tab[l][c]/10)][key];
						}
					}
				}
			}
			if (typeof(tab[l][c]) == "undefined") {
				tab[l].push(0);
			}
		}
	}
	return tab;
}

function coorToCaseName(l,c) {
	const numToLetter = {0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H'};
	if (typeof(numToLetter[c]) == "undefined") {
		console.log("ERROR => coorToCaseName : bad cell number");
	}

	return numToLetter[c]+(8-l);
}

function caseNameToCoor(cellName) {
	if (typeof(cellName) != "string") {
		console.log("ERROR => caseNameToCoor : cellName not a string");
		return;
	}
	if (cellName.length != 2) {
		console.log("ERROR => caseNameToCoor : cellName bad length");
		return;
	}
	const letterToNum = {a: 0, A: 0, b: 1, B: 1, c: 2, C: 2, d: 3, D: 3, e: 4, E: 4, f: 5, F: 5, g: 6, G: 6, h: 7, H: 7};

	if (typeof(letterToNum[cellName[0]]) == "undefined") {
		console.log("ERROR => caseNameToCoor : bad letter");
		return;
	}

	if (parseInt(cellName[1]) < 1 | parseInt(cellName[1]) > 8) {
		console.log("ERROR => caseNameToCoor : incorrect line Number");
		return;
	}

	return {l: 8-parseInt(cellName[1]), c: letterToNum[cellName[0]]};
}

function gameOver(player, winner) {
	if (!player.playing) {
		return;
	}
	player.playing = false;
	player.adversaire.playing = false;

	let echec = player.level;
	if (!player.isIA)
		player.socket.emit("displayLevel", {tab: echec, playerType: player.playerType});
	if (!player.adversaire.isIA)
		player.adversaire.socket.emit("displayLevel", {tab: echec, playerType: player.adversaire.playerType});

	if (winner == null) {
		if (!player.isIA)
			player.socket.emit("endGame", {playerType: player.playerType, opponentIsIA: player.adversaire.isIA});
		if (!player.adversaire.isIA)
			player.adversaire.socket.emit("endGame", {playerType: player.adversaire.playerType, opponentIsIA: player.isIA});
	} else {
		if (!player.isIA)
			player.socket.emit("endGame", {playerType: player.playerType, winner: winner, opponentIsIA: player.adversaire.isIA});
		if (!player.adversaire.isIA)
			player.adversaire.socket.emit("endGame", {playerType: player.adversaire.playerType, winner: winner, opponentIsIA: player.isIA});
	}

	player.playerType = null;
	player.adversaire.playerType = null;

	player.lastDeplacment = null;
	player.adversaire.lastDeplacment = null;

	player.level = null;
	player.adversaire.level = null;

	player.voteToRestart = false;
	player.adversaire.voteToRestart = false;
}

function promotion(l,c,player,rep) {
	let echec = player.level;
	let currentPlayer = player.playerType;
	let scorePlayers = player.scorePlayers;
	if (rep == "Cavalier") {
		scorePlayers[currentPlayer][2] += 1;
		echec[l][c] = 20+currentPlayer;
		scorePlayers[currentPlayer][1] -= 1;
	} else if (rep == "Tour") {
		scorePlayers[currentPlayer][3] += 1;
		echec[l][c] = 30+currentPlayer;
		scorePlayers[currentPlayer][1] -= 1;
	} else if (rep == "Fou") {
		scorePlayers[currentPlayer][4] += 1;
		echec[l][c] = 40+currentPlayer;
		scorePlayers[currentPlayer][1] -= 1;
	} else if (rep == "Reine") {
		scorePlayers[currentPlayer][5] += 1;
		echec[l][c] = 50+currentPlayer;
		scorePlayers[currentPlayer][1] -= 1;
	}
	if (!player.simule) {
		player.hisOwnTurn = false;
		player.adversaire.hisOwnTurn = true;
		if (!player.isIA) {
			player.socket.emit("displayLevel", {
				tab: player.level,
				playerType: player.playerType,
				hisOwnTurn: player.hisOwnTurn,
				echec: isEchec(player.playerType, echec),
				lastDeplacment: player.lastDeplacment
			});
		}
		if (!player.adversaire.isIA) {
			player.adversaire.socket.emit("displayLevel", {
				tab: player.level,
				playerType: player.adversaire.playerType,
				hisOwnTurn: player.adversaire.hisOwnTurn,
				echec: isEchec(player.adversaire.playerType, echec),
				lastDeplacment: player.lastDeplacment
			});
		}
		player.functionCoupSpecial = null;
	}
}

function roque(lT,cT,lR,cR,player,rep) {
	let echec = player.level;
	if (rep == "oui") {
		let infosCase = player.infosCase;
		let thisInfoCase = getInfoCase(lR,cR,infosCase);
		if (cT == cR+1) {
			thisInfoCase.c = cT+1;
			echec[lR][cR] = 0;
			echec[lR][cT+1] = 60+player.playerType;
		} else if (cT == cR-1) {
			thisInfoCase.c = cT-1;
			echec[lR][cR] = 0;
			echec[lR][cT-1] = 60+player.playerType;
		}
	}
	if (!player.simule) {
		player.hisOwnTurn = false;
		player.adversaire.hisOwnTurn = true;
		if (!player.isIA) {
			player.socket.emit("displayLevel", {
				tab: player.level,
				playerType: player.playerType,
				hisOwnTurn: player.hisOwnTurn,
				echec: isEchec(player.playerType, echec),
				lastDeplacment: player.lastDeplacment
			});
		}
		if (!player.adversaire.isIA) {
			player.adversaire.socket.emit("displayLevel", {
				tab: player.level,
				playerType: player.adversaire.playerType,
				hisOwnTurn: player.adversaire.hisOwnTurn,
				echec: isEchec(player.adversaire.playerType, echec),
				lastDeplacment: player.lastDeplacment
			});
		}
		player.functionCoupSpecial = null;
	}
}

function isEchec(currentPlayer,echec) {
	for (let l=0;l<echec.length;l++) {
		for (let c=0;c<echec[l].length;c++) {
			if (echec[l][c]%10 != currentPlayer & echec[l][c] != 0) {
				let mouvs = getPath(l,c,echec);
				for (let i=0;i<mouvs.length;i++) {
					if (echec[mouvs[i].l][mouvs[i].c] == 60+currentPlayer) {
						return true;
					}
				}
			}
		}
	}
	return false;
}

function getPath(l,c,echec) {
	if (echec[l][c] == 0) {
		return [];
	}
	const currentPlayer = echec[l][c]%10;
	const type = Math.floor(echec[l][c]/10);

	let mouvs = [];
	let lB,cB,coefs;
	switch(type) {
		case 1: // pion
			if (currentPlayer == 1 & l-1 >= 0) {
				if (echec[l-1][c] == 0) {
					mouvs.push({l: l-1, c: c});
				}
				if (c-1 >= 0) {
					if (echec[l-1][c-1]%10 != currentPlayer) {
						mouvs.push({l: l-1, c: c-1});
					}
				}
				if (c+1 < echec[l-1].length) {
					if (echec[l-1][c+1]%10 != currentPlayer) {
						mouvs.push({l: l-1, c: c+1});
					}
				}
			} else if (currentPlayer == 2 & l+1 < echec.length) {
				if (echec[l+1][c] == 0) {
					mouvs.push({l: l+1, c: c});
				}
				if (c-1 >= 0) {
					if (echec[l+1][c-1]%10 != currentPlayer) {
						mouvs.push({l: l+1, c: c-1});
					}
				}
				if (c+1 < echec[l+1].length) {
					if (echec[l+1][c+1]%10 != currentPlayer) {
						mouvs.push({l: l+1, c: c+1});
					}
				}
			}
			break;
		case 2: // cavalier
			if (l-2 >= 0) {
				if (c-1 >= 0) {
					if (echec[l-2][c-1]%10 != currentPlayer) {
						mouvs.push({l: l-2, c: c-1});
					}
				}
				if (c+1 < echec[l].length) {
					if (echec[l-2][c+1]%10 != currentPlayer) {
						mouvs.push({l: l-2, c: c+1});
					}
				}
			}
			if (l+2 < echec.length) {
				if (c-1 >= 0) {
					if (echec[l+2][c-1]%10 != currentPlayer) {
						mouvs.push({l: l+2, c: c-1});
					}
				}
				if (c+1 < echec[l].length) {
					if (echec[l+2][c+1]%10 != currentPlayer) {
						mouvs.push({l: l+2, c: c+1});
					}
				}
			}
			if (c-2 >= 0) {
				if (l-1 >= 0) {
					if (echec[l-1][c-2]%10 != currentPlayer) {
						mouvs.push({l: l-1, c: c-2});
					}
				}
				if (l+1 < echec.length) {
					if (echec[l+1][c-2]%10 != currentPlayer) {
						mouvs.push({l: l+1, c: c-2});
					}
				}
			}
			if (c+2 < echec[l].length) {
				if (l-1 >= 0) {
					if (echec[l-1][c+2]%10 != currentPlayer) {
						mouvs.push({l: l-1, c: c+2});
					}
				}
				if (l+1 < echec.length) {
					if (echec[l+1][c+2]%10 != currentPlayer) {
						mouvs.push({l: l+1, c: c+2});
					}
				}
			}
			break;
		case 3: // tour
			lB = l-1;

			while (lB >= 0) {
				if (echec[lB][c]%10 == currentPlayer) {
					break;
				}
				if (lB < echec.length-1) {
					if (echec[lB+1][c]%10 == (currentPlayer == 1 ? 2 : 1)) {
						break;
					}
				}
				mouvs.push({l: lB, c: c});
				lB -= 1;
			}
			lB = l+1;
			while (lB < echec.length) {
				if (echec[lB][c]%10 == currentPlayer) {
					break;
				}
				if (lB > 0) {
					if (echec[lB-1][c]%10 == (currentPlayer == 1 ? 2 : 1)) {
						break;
					}
				}
				mouvs.push({l: lB, c: c});
				lB += 1;
			}
			cB = c-1;
			while (cB >= 0) {
				if (echec[l][cB]%10 == currentPlayer) {
					break;
				}
				if (cB < echec[0].length-1) {
					if (echec[l][cB+1]%10 == (currentPlayer == 1 ? 2 : 1)) {
						break;
					}
				}
				mouvs.push({l: l, c: cB});
				cB -= 1;
			}
			cB = c+1;
			while (cB < echec[l].length) {
				if (echec[l][cB]%10 == currentPlayer) {
					break;
				}
				if (cB > 0) {
					if (echec[l][cB-1]%10 == (currentPlayer == 1 ? 2 : 1)) {
						break;
					}
				}
				mouvs.push({l: l, c: cB});
				cB += 1;
			}
			break;
		case 4: //fou
			coefs = [{coefL: -1, coefC: -1},{coefL: -1, coefC: 1}, {coefL: 1, coefC: -1}, {coefL: 1, coefC: 1}];

			for (let i=0;i<coefs.length;i++) {
				const coefL = coefs[i].coefL;
				const coefC = coefs[i].coefC;
				lB = l+coefL;
				cB = c+coefC;
				while (lB >= 0 & lB < echec.length & cB >= 0 & cB < echec[0].length) {
					if (echec[lB][cB]%10 == currentPlayer) {
						break;
					}
					if (lB+coefL*(-1) >= 0 & lB+coefL*(-1) < echec.length & cB+coefC*(-1) >= 0 & cB+coefC*(-1) < echec[0].length) {
						if (echec[lB+coefL*(-1)][cB+coefC*(-1)]%10 == (currentPlayer == 1 ? 2 : 1)) {
							break;
						}
					}
					mouvs.push({l: lB, c: cB});
					lB += coefL;
					cB += coefC;
				}
			}
			break;
		case 5: //reine
			coefs = [{coefL: -1, coefC: -1},{coefL: -1, coefC: 1}, {coefL: 1, coefC: -1}, {coefL: 1, coefC: 1},
				{coefL: -1, coefC: 0},{coefL: 1, coefC: 0},{coefL: 0, coefC: -1},{coefL: 0, coefC: 1}];

			for (let i=0;i<coefs.length;i++) {
				const coefL = coefs[i].coefL;
				const coefC = coefs[i].coefC;
				lB = l+coefL;
				cB = c+coefC;
				while (lB >= 0 & lB < echec.length & cB >= 0 & cB < echec[0].length) {
					if (echec[lB][cB]%10 == currentPlayer) {
						break;
					}
					if (lB+coefL*(-1) >= 0 & lB+coefL*(-1) < echec.length & cB+coefC*(-1) >= 0 & cB+coefC*(-1) < echec[0].length) {
						if (echec[lB+coefL*(-1)][cB+coefC*(-1)]%10 == (currentPlayer == 1 ? 2 : 1)) {
							break;
						}
					}
					mouvs.push({l: lB, c: cB});
					lB += coefL;
					cB += coefC;
				}
			}
			break;
		case 6: // roi
			coefs = [{coefL: -1, coefC: -1},{coefL: -1, coefC: 1}, {coefL: 1, coefC: -1}, {coefL: 1, coefC: 1},
				{coefL: -1, coefC: 0},{coefL: 1, coefC: 0},{coefL: 0, coefC: -1},{coefL: 0, coefC: 1}];
			for (let i=0;i<coefs.length;i++) {
				const coefL = coefs[i].coefL;
				const coefC = coefs[i].coefC;
				lB = l+coefL;
				cB = c+coefC;
				if (lB >= 0 & lB < echec.length & cB >= 0 & cB < echec[0].length) {
					if (echec[lB][cB]%10 != currentPlayer) {
						mouvs.push({l: lB, c: cB});
					}
				}
			}
			break;
	}
	return mouvs;
}

async function echecEtMat(player) {
	let { level: echec, playerType: currentPlayer, scorePlayers, infosCase } = player;

	if (!isEchec(currentPlayer,echec)) {
		return false;
	}

	for (let l=0;l<echec.length;l++) {
		for (let c=0;c<echec[l].length;c++) {
			if (echec[l][c]%10 == currentPlayer) {
				let mouvs = getPath(l,c,echec);
				for (let i=0;i<mouvs.length;i++) {
					let echecb = copyTab(echec);
					let falsePlayer = {
						level: echecb,
						playerType: currentPlayer,
						scorePlayers: scorePlayers,
						infosCase: infosCase,
						simule: true
					};
					let { success } = await action({l, c}, {
						l: mouvs[i].l,
						c: mouvs[i].c
					}, falsePlayer);

					if (success) {
						return false;
					}
				}
			}
		}
	}
	return true;
}

function getElem(echec,l,c) {
	if (typeof(echec[l]) == "undefined") {
		return 0;
	}
	if (typeof(echec[l][c]) == "undefined") {
		return 0;
	}
	return echec;
}

function remplace(str, A, B) {
	while(str.replace(A,B) != str) {
		str = str.replace(A,B);
	}
	return str;
}

function copyTab(tab) {
	let tab2 = [];
	for (let i=0;i<tab.length;i++) {
		if (typeof(tab[i]) != "object") {
			tab2.push(tab[i]);
		} else {
			tab2.push(copyObj(tab[i]));
		}
	}
	return tab2;
}

function copyObj(obj) {
	if (Array.isArray(obj)) {
		return copyTab(obj);
	} else {
		return copyDict(obj);
	}
}

function copyDict(dict) {
	let dict2 = {};
	for (let key in dict) {
		if (typeof(dict[key]) != "object") {
			dict2[key] = dict[key];
		} else {
			dict2[key] = copyObj(dict[key]);
		}
	}
	return dict2;
}

module.exports = {
	players,
	startGame,
	playerSearching,
	remplace,
	action,
	callbackAction,
	setIA,
	getPath,
	copyTab,
	copyObj,
	echecEtMat,
	getInfoCase,
	caseNameToCoor,
	gameOver
}
