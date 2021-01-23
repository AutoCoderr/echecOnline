let http = require('http'),
    url = require('url'),
    fs = require('fs');
const {playerSearching, players, startGame, remplace, action, callbackAction, caseNameToCoor, gameOver, startIa} = require("./libs/echecs");

/*
legende :
0 = case vide

11 = pion blanc
12 = pion noir

21 = cavalier blanc
22 = cavalier noir

31 = tour blanche
32 = tour noire

41 = fou blanc
42 = fou noir

51 = reine blanche
52 = reine noire

61 = roi blanc
62 = roi noir
*/

const extByMimes = {
    "application/javascript": ["js","mjs"],
    "text/html": ["html","htm"]
}
let mimesByExt = {}
for (let mime in extByMimes) {
    for (let ext of extByMimes[mime]) {
        mimesByExt[ext] = mime;
    }
}
function getMimeByExt(ext) {
    return mimesByExt[ext] ? mimesByExt[ext] : "text/plain";
}

const server = http.createServer(function(req, res) { // --------------------------> LE SERVEUR HTTP <------------------------------------------------------
    let page = url.parse(req.url).pathname;
    const param = url.parse(req.url).query;
    if (page == "/") {
        page = "/index.html"
    } else if (page == "/socket.io" || page == "/socket.io/") {
        page = "/socket.io/socket.io.js"
    }
    page = __dirname + page
    const ext = page.split(".")[page.split(".").length-1]
    if (ext == "png" | ext == "jpg" | ext == "gif" | ext == "jpeg" | ext == "bmp" | ext == "tif" | ext == "tiff" | ext == "ico") {
        fs.readFile(page, function(error, content) {
            if(error){
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.end("ERROR 404 : Page not found");
            } else {
                res.writeHead(200, {"Content-Type": "image/" + ext});
                res.end(content);
            }
        });
    } else {
        fs.readFile(page, 'utf-8', function(error, content) {
            if(error | page.split("/")[page.split("/").length-1] == "serv.js"){
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.end("ERROR 404 : Page not found");
            } else {
                res.writeHead(200, {"Content-Type": getMimeByExt(ext)});
                res.end(content);
            }
        });
    }
});

const io = require('socket.io')(server);

io.sockets.on('connection', function (socket) {
    socket.on('login', function (pseudo) { // --------------------------------> LOGIN <--------------------------------------------
        if (typeof(socket.datas) != "undefined") {
            return;
        }
        let n = "";
        while(typeof(players[pseudo+n]) != "undefined") {
            if (players[pseudo+n].disconnected && players[pseudo+n].ip === remplace(socket.handshake.address,"::ffff:","")) {
                clearTimeout(players[pseudo+n].timeoutBeforeDeletingUser);
                destroySession(players[pseudo+n]);
                break;
            }
            if (n == "") {
                n = 2;
            } else {
                n += 1;
            }
        }
        pseudo = pseudo+n;
        let token = rand(10**14,10**15-1);
        while (playerHaveToken(token)) {
            token = rand(10**14,10**15-1);
        }
        players[pseudo] = {pseudo, token, level: null, adversaire: null, playerType: null, ip: remplace(socket.handshake.address,"::ffff:",""),
            socket, demmanded: "", playing: false, hisOwnTurn: null,
            voteToRestart: null, infosCase: null, scorePlayers: null, functionCoupSpecial: null, lastDeplacment: null, surrendDemmanded: false, isIA: false, simule: false};
        socket.datas = players[pseudo];
        console.log("new connected! : "+pseudo+" ("+players[pseudo].ip+")");
        socket.emit("connected", {pseudo, token})

        setTimeout(() => {
            displayPlayers(socket.broadcast,socket);
        },20);
    });

    socket.on('sendDemmand', function(pseudo) {
        if (typeof(socket.datas) == "undefined") {
            socket.emit("msg", {msg: "Le serveur a été relancé, veuillez actualiser", type: "error"});
            return;
        }

        if (typeof(players[pseudo]) == "undefined") {
            socket.emit("msg", {msg: "Ce joueur n'existe pas", type: "error"});
        } else if (players[pseudo].playing) {
            socket.emit("msg", {msg: "Ce joueur est dans une partie", type: "error"});
        } else {
            socket.datas.demmanded = pseudo;
            players[pseudo].socket.emit("demmand", socket.datas.pseudo);
        }
    });

    socket.on("acceptDemmand", function(pseudo) {
        if (typeof(socket.datas) == "undefined") {
            socket.emit("msg", {msg: "Le serveur a été relancé, veuillez actualiser", type: "error"});
            return;
        }

        if (typeof(players[pseudo]) == "undefined") {
            socket.emit("msg", {msg: "Ce joueur n'existe pas", type: "error"});
        } else if (players[pseudo].demmanded != socket.datas.pseudo) {
            socket.emit("msg", {msg: "Cet utilisateur ne vous a jamais envoyé de demmande", type: "error"});
        } else {
            players[pseudo].demmanded = "";
            startGame(players[pseudo],socket.datas);
        }
    });

    socket.on("playAgainstIA", function () {
        if (typeof(socket.datas) == "undefined") {
            socket.emit("msg", {msg: "Le serveur a été relancé, veuillez actualiser", type: "error"});
            return;
        }
        let n = 1;
        while(typeof(players["ia"+n]) != "undefined") {
            n += 1;
        }
        players["ia"+n] = {pseudo: "ia"+n, level: null, adversaire: null, playerType: null,
            demmanded: "", playing: false, hisOwnTurn: null,
            voteToRestart: null, infosCase: null, scorePlayers: null, functionCoupSpecial: null, lastDeplacment: null, surrendDemmanded: false, isIA: true};
        startGame(socket.datas,players["ia"+n]);
    });

    socket.on('displayPlayers', function () {
        let playersList = [];
        for (let unPseudo in players) {
            if (!players[unPseudo].playing) {
                playersList.push(unPseudo);
            }
        }
        socket.emit("displayPlayers", playersList);
    });

    socket.on('searchPlayer', function() {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        for (let unPseudo in playerSearching) {
            delete playerSearching[unPseudo];
            startGame(socket.datas,players[unPseudo]);
            break;
        }
        playerSearching[socket.datas.pseudo] = socket.datas;
    });

    socket.on("stopSearch", function () {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (typeof(playerSearching[socket.datas.pseudo]) == "undefined") {
            return;
        }
        delete playerSearching[socket.datas.pseudo];
    });

    socket.on("action", function (cases) {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (!socket.datas.playing) {
            return;
        }
        if (!socket.datas.hisOwnTurn) {
            return;
        }
        if (socket.datas.adversaire.disconnected) {
            socket.emit("msg", {type: "warning", msg: "Attendez plutôt que votre adversaire se reconnecte"});
            socket.emit("emptyChoicedCases");
            return;
        }
        if (typeof(cases.A) == "undefined" | typeof(cases.B) == "undefined") {
            return;
        }
        action(caseNameToCoor(cases.A),caseNameToCoor(cases.B),socket.datas).then((res) => {
            callbackAction(res.success, res.player, res.coupSpecial);
        });
    });

    socket.on("quitParty", function () {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (socket.datas.adversaire == null) {
            return;
        }
        if (socket.datas.adversaire.isIA) {
            delete players[socket.datas.adversaire.pseudo];
        } else {
            socket.datas.adversaire.voteToRestart = null;
            socket.datas.adversaire.socket.emit("quitParty");
            socket.datas.adversaire.adversaire = null;
        }

        socket.emit("quitParty");
        socket.datas.adversaire = null;
        socket.datas.voteToRestart = null;
    });

    socket.on("restart", function () {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (socket.datas.voteToRestart || socket.datas.voteToRestart == null) {
            return;
        }
        if (!socket.datas.adversaire.isIA) {
            socket.datas.voteToRestart = true;
            let nb;
            if (socket.datas.adversaire.voteToRestart) {
                nb = 2;
                setTimeout(() => {
                    startGame(socket.datas, socket.datas.adversaire);
                }, 400);
            } else {
                nb = 1;
            }
            socket.emit("voteToRestart", nb);
            socket.datas.adversaire.socket.emit("voteToRestart", nb);
        } else {
            startGame(socket.datas, socket.datas.adversaire);
        }
    });

    socket.on('disconnect', function() { // ----------------------> DECONNEXION D'UN CLIENT <---------------------------------------
        if (typeof(socket.datas) != "undefined") {

            socket.datas.disconnected = true;

            const player = socket.datas;

            console.log("'"+player.pseudo+"' lost connection ("+player.ip+")");
            console.log("'"+player.pseudo+"' will be disconnected in 30 seconds if he not reconnect")

            if (player.playing && !player.adversaire.isIA) {
                player.adversaire.socket.emit("msg", {type: "warning", msg: "Votre adversaire a momentanément perdu sa connexion,<br>"+
                                                                                            "vous pouvez attendre qu'il se reconnecte"});
            }

            displayPlayers(socket.broadcast);

            player.timeoutBeforeDeletingUser = setTimeout(() => {
                destroySession(player);
            }, 30000);
        }
    });

    socket.on("reconnection", function (datas) {
        const pseudo = datas.pseudo,
            token = datas.token;
        if (typeof(players[pseudo]) == "undefined") return;
        if (!players[pseudo].disconnected) return;
        if (players[pseudo].token !== token) return;

        const player = players[pseudo];
        console.log("Reconnection "+pseudo+" ("+player.ip+")");
        clearTimeout(player.timeoutBeforeDeletingUser);
        player.socket = socket;
        socket.datas = player;
        player.disconnected = false;
        socket.emit("emptyChoicedCases");
        socket.emit("msg", {type: "warning", msg: "Votre connexion a été rétablit!"})
        setTimeout(() => {
            socket.emit("msg", {type: "empty"});
        }, 2000);

        displayPlayers(socket.broadcast);
        if (player.playing && !player.adversaire.isIA) {
            player.adversaire.socket.emit("msg", {type: "warning", msg: "Votre adversaire est de nouveau connecté"});
            setTimeout(() => {
                player.adversaire.socket.emit("msg", {type: "empty"});
            }, 2000);
        }
    });

    socket.on("reponseCoupSpecial", function (rep) {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (typeof(socket.datas.functionCoupSpecial) != "function") {
            return;
        }
        const player = socket.datas;
        player.functionCoupSpecial(socket.datas,rep);
        if (player.adversaire.isIA) {
            startIa(player.adversaire);
        }
    });

    socket.on("demandSurrend", function () {
        let player = socket.datas;

        if (!player.playing || player.adversaire == null) {
            socket.emit("msg", {type: "error", msg: "Vous ne pouvez pas abandonner."});
        } else {
            if (!player.adversaire.isIA) {
                player.surrendDemmanded = true;
                player.adversaire.socket.emit("proposeSurrend");
            } else {
                gameOver(player.adversaire, player.adversaire.playerType);
            }
        }
    });

    socket.on("reponseSurrend", function (rep) {
        let player = socket.datas;

        if (!player.playing || player.adversaire == null) {
            socket.emit("msg", {type: "error", msg: "Vous ne pouvez pas abandonner."});
            return;
        }
        if (!player.adversaire.surrendDemmanded) {
            socket.emit("msg", {type: "error", msg: "Abandon impossible"});
            return;
        }

        if (rep == "decline") {
            player.adversaire.socket.emit("msg", {type: "info", msg: "Abandon refusé"});
        } else if (rep == "accept") {
            gameOver(player, player.playerType);
        } else {
            socket.emit("msg", {type: "error", msg: "Reponse invalide"});
        }
    });
});

function destroySession(player) {
    player.disconnected = false;
    delete players[player.pseudo];
    if (player.adversaire != null) {
        if (!player.adversaire.isIA) {
            player.adversaire.adversaire = null;
            player.adversaire.voteToRestart = null;
            player.adversaire.playing = false;
            player.adversaire.socket.emit("quitParty");
            player.adversaire.playerType = null;
            player.adversaire.level = null;
        } else
            delete players[player.adversaire.pseudo];
    }

    if (typeof(playerSearching[player.pseudo]) != "undefined") {
        delete playerSearching[player.pseudo];
    }
    console.log("disconnect "+player.pseudo+" ("+player.ip+")");
}

function displayPlayers(...sockets) {
    let playersList = [];
    for (let pseudo in players) {
        if (!players[pseudo].playing && !players[pseudo].disconnected) {
            playersList.push(pseudo);
        }
    }
    for (let socket of sockets) {
        socket.emit("displayPlayers", playersList);
    }
}

function playerHaveToken(token) {
    for (let pseudo in players) {
        if (players[pseudo].token === token) return true;
    }
    return false;
}

function rand(a,b) {
    return a+Math.floor(Math.random()*(b-a+1));
}

server.listen(3003);
