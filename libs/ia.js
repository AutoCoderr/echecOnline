const {getPath, possibleMouvement, action, coorToCaseName} = require("./echecs");

class IA {
	iaStarting;
	callback;
	tree;
	profondeurMax;
	taille;
	currentPlayer;
	echec;
	player;

	constructor(currentPlayer, echec, player) {
		this.iaStarting = false;
		this.currentPlayer = currentPlayer;
		this.echec = echec;
		this.player = player;
		this.taille = 0;
	}

	applyIa(profondeurMax = 4) {
		if (!this.player.playing) {
			return;
		}
		if (this.iaStarting) {
			return;
		}
		this.iaStarting = true;
		this.profondeurMax = profondeurMax;
		console.log("Veuillez patienter...");
		this.startIa(async (A,B) => {
			action(coorToCaseName(A.l,A.c),coorToCaseName(B.l,B.c), null, this.player);
		});
	}

	startIa(callback) {
		const possiblesMouvs = [];
		for (let l=0;l<this.echec.length;l++) {
			for (let c=0;c<this.echec[l].length;c++) {
				if (this.echec[l][c]%10 == this.currentPlayer) {
					const mouvs = getPath(l, c, this.echec);
					if (mouvs.length > 0) {
						let tentative = 0;
						let m = rand(0, mouvs.length - 1);
						while (!possibleMouvement(l, c, mouvs[m].l, mouvs[m].c, this.echec, this.currentPlayer, this.player.infosCase) && tentative < 10) {
							m = rand(0, mouvs.length - 1);
							tentative += 1;
						}
						if (possibleMouvement(l, c, mouvs[m].l, mouvs[m].c, this.echec, this.currentPlayer, this.player.infosCase)) {
							possiblesMouvs.push({A: {l, c}, B: {l: mouvs[m].l, c: mouvs[m].c}});
						}
					}
				}
			}
		}
		const mouv = possiblesMouvs[rand(0,possiblesMouvs.length-1)];
		callback(mouv.A,mouv.B);
	}


}

function rand(a,b) {
	return a+Math.floor(Math.random()*(b-a+1));
}

module.exports = {
	IA
}
