let http = require('http'),
    url = require('url'),
    fs = require('fs');
const {playerSearching, players, startGame, remplace, action, setIA} = require("./libs/echecs");
const { IA } = require("./libs/ia");
setIA(IA);

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
            if (n == "") {
                n = 2;
            } else {
                n += 1;
            }
        }
        pseudo = pseudo+n;
        players[pseudo] = {pseudo: pseudo, level: null, adversaire: null, playerType: null,
            socket: socket, demmanded: "", playing: false, hisOwnTurn: null,
            voteToRestart: null, infoCase: null, scorePlayers: null, functionCoupSpecial: null, lastDeplacment: null, surrendDemmanded: false};
        socket.datas = players[pseudo];
        console.log("new connected! : "+pseudo+" ("+remplace(socket.handshake.address,"::ffff:","")+")");
        socket.emit("newPseudo", pseudo)

        setTimeout(() => {
            let playersList = [];
            for (let unPseudo in players) {
                if (!players[unPseudo].playing) {
                    playersList.push(unPseudo);
                }
            }
            socket.emit("displayPlayers", playersList);
            socket.broadcast.emit("displayPlayers", playersList);
        },20);
    });

    socket.on('sendDemmand', function(pseudo) {
        if (typeof(socket.datas) == "undefined") {
            socket.emit("msg", {msg: "Le serveur à été relancé, veuillez actualiser", type: "error"});
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
            socket.emit("msg", {msg: "Le serveur à été relancé, veuillez actualiser", type: "error"});
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
            socket.emit("msg", {msg: "Le serveur à été relancé, veuillez actualiser", type: "error"});
            return;
        }
        let n = 1;
        while(typeof(players["ia"+n]) != "undefined") {
            n += 1;
        }
        players["ia"+n] = {pseudo: "ia"+n, level: null, adversaire: null, playerType: null,
            demmanded: "", playing: false, hisOwnTurn: null,
            voteToRestart: null, infoCase: null, scorePlayers: null, functionCoupSpecial: null, lastDeplacment: null, surrendDemmanded: false, isIA: true};
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
        if (typeof(cases.A) == "undefined" | typeof(cases.B) == "undefined") {
            return;
        }
        action(cases.A,cases.B,null,socket.datas);
    });

    socket.on("quitParty", function () {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (socket.datas.adversaire == null) {
            return;
        }
        socket.datas.adversaire.voteToRestart = null;
        socket.datas.voteToRestart = null;

        socket.datas.adversaire.socket.emit("quitParty");
        socket.emit("quitParty");

        socket.datas.adversaire.adversaire = null;
        socket.datas.adversaire = null;
    });

    socket.on("restart", function () {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (socket.datas.voteToRestart | socket.datas.voteToRestart == null) {
            return;
        }
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
    });

    socket.on('disconnect', function() { // ----------------------> DECONNEXION D'UN CLIENT <---------------------------------------
        if (typeof(socket.datas) != "undefined") {
            if (socket.datas.adversaire != null) {
                if (!socket.datas.adversaire.isIA) {
                    socket.datas.adversaire.adversaire = null;
                    socket.datas.adversaire.voteToRestart = null;
                    socket.datas.adversaire.playing = false;
                    socket.datas.adversaire.socket.emit("quitParty");
                    socket.datas.adversaire.playerType = null;
                    socket.datas.adversaire.level = null;
                } else
                    delete players[socket.datas.adversaire.pseudo];
            }

            const pseudo = socket.datas.pseudo;
            if (typeof(playerSearching[pseudo]) != "undefined") {
                delete playerSearching[pseudo];
            }
            console.log("disconnect "+pseudo+" ("+remplace(socket.handshake.address,"::ffff:","")+")");
            delete players[pseudo];
            let playersList = [];
            for (let pseudo in players) {
                if (!players[pseudo].playing) {
                    playersList.push(pseudo);
                }
            }
            socket.broadcast.emit("displayPlayers", playersList);
        }
    });

    socket.on("reponseCoupSpecial", function (rep) {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (typeof(socket.datas.functionCoupSpecial) != "function") {
            return;
        }
        socket.datas.functionCoupSpecial(socket.datas,rep);
    });

    socket.on("demandSurrend", function () {
        let player = socket.datas;

        if (!player.playing || player.adversaire == null) {
            socket.emit("msg", {type: "error", msg: "Vous ne pouvez pas abandonner."});
        } else {
            player.surrendDemmanded = true;
            player.adversaire.socket.emit("proposeSurrend");
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

server.listen(3003);
